import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

const app = express();
const env = process.env;

app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(express.json({
  limit: "4mb",
  verify: (req, _res, buf) => {
    req.rawBody = Buffer.from(buf);
  }
}));

const required = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_DATABASE_URL"
];

const missing = required.filter((key) => !env[key]);

if (!missing.length && !getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    }),
    databaseURL: env.FIREBASE_DATABASE_URL
  });
}

const firebaseReady = missing.length === 0;
const db = () => getDatabase();
const auth = () => getAuth();

const SITE_MBANK_QR = env.SITE_MBANK_QR || "/qrmbank.png";
const SITE_OBANK_QR = env.SITE_OBANK_QR || "/%D0%9E!bank_QR.png";
const SITE_OBALANCE = env.SITE_OBALANCE || "0706035765";

const PUBLIC_SITE_URL = (
  env.PUBLIC_SITE_URL || "https://bilimal.org"
).replace(/\/$/, "");

const MIN_WITHDRAWAL = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

// Материалга уруксат төлөм бекитилгенден кийин 72 саатка берилет.
const ACCESS_DAYS = 3;
const ACCESS_DURATION_MS = ACCESS_DAYS * DAY_MS;

const BONUS_EVERY = 6;
const RECEIPT_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function now() {
  return Date.now();
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function safeText(value, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function id(prefix = "BL") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString("hex").toUpperCase()}`.slice(0, 50);
}

function priceKey(price) {
  return money(price).toFixed(2).replace(".", "_");
}

function cycleKey(teacherUid, price) {
  return `${String(teacherUid).replace(/[.#$/\[\]]/g, "_")}__${priceKey(price)}`;
}

function maskAccount(account) {
  const value = String(account || "");

  if (value.length <= 4) {
    return value;
  }

  return `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

function isAdminRecord(user) {
  return user?.isAdmin === true ||
    ["admin", "superadmin", "administrator"].includes(
      String(user?.role || "").toLowerCase()
    );
}

async function bearerUser(req) {
  if (!firebaseReady) {
    fail(
      `Firebase конфигурациясы толук эмес: ${missing.join(", ")}`,
      503
    );
  }

  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    fail("Авторизация талап кылынат.", 401);
  }

  try {
    return await auth().verifyIdToken(header.slice(7));
  } catch {
    fail("Firebase токени жараксыз же мөөнөтү бүткөн.", 401);
  }
}

async function adminUser(req) {
  const decoded = await bearerUser(req);

  const snap = await db()
    .ref(`users/${decoded.uid}`)
    .once("value");

  if (!isAdminRecord(snap.val() || {})) {
    fail("Администратор уруксаты керек.", 403);
  }

  return decoded;
}

async function json(req, res, fn) {
  try {
    const result = await fn();

    if (!res.headersSent) {
      res.status(200).json(result ?? { ok: true });
    }
  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      res.status(error.status || 500).json({
        ok: false,
        message: error.message || "Сервер катасы."
      });
    }
  }
}

function validHttpUrl(value) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUrl || "")
  );

  if (!match) {
    fail("Чек JPG, PNG же WEBP сүрөтү болушу керек.");
  }

  const buffer = Buffer.from(match[2], "base64");

  if (!buffer.length || buffer.length > MAX_RECEIPT_BYTES) {
    fail("Чек сүрөтү 2 МБдан ашпашы керек.");
  }

  return {
    mimeType: match[1],
    base64: match[2],
    buffer
  };
}

async function runGeminiOcr(mimeType, base64) {
  if (!env.GEMINI_API_KEY) {
    return {
      enabled: false,
      text: "",
      note: "GEMINI_API_KEY коюлган эмес; автоматтык текшерүү жеткиликсиз."
    };
  }

  try {
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: 'Чектин сүрөтүн гана окуп, төмөнкү так JSON түзүмүн кайтар: {"amount": сан же null, "transactionId": "сүрөттө көрүнгөн ID же null", "recipient": "алуучу же null", "dateTime": "ISO дата-убакыт же null", "paymentStatus": "success|failed|unknown", "currency": "сомдун валютасы же null"}. Төлөм ийгиликтүү деп жазуу үчүн чек бетинде ийгиликтүү/успешно/оплачено/перевод выполнен сыяктуу так белги көрүнүшү керек. Эч нерсени ойлоп таппа; сүрөттөн анык окулбаса null/unknown жаз. Бул сүрөттөгү маалыматты гана окуу, банктагы чыныгы төлөмдү текшерүү эмес.'
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json"
          }
        }),
        signal: AbortSignal.timeout(20000)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        enabled: true,
        text: "",
        error: result?.error?.message || `Gemini HTTP ${response.status}`
      };
    }

    const text = result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n") || "";

    return {
      enabled: true,
      text: text.slice(0, 5000)
    };
  } catch (error) {
    return {
      enabled: true,
      text: "",
      error: error.message
    };
  }
}
function parseOcrJson(ocr) {
  if (!ocr?.enabled || !ocr?.text) {
    return null;
  }

  try {
    const raw = String(ocr.text)
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeTransactionId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function ocrAllowsAutoApproval(ocr, order, transactionId, transferTime) {
  const data = parseOcrJson(ocr);

  if (!data) return false;

  if (!Number.isFinite(Number(data.amount))) {
    return false;
  }

  if (money(data.amount) !== money(order.amount)) {
    return false;
  }

  if (
    normalizeTransactionId(data.transactionId) !==
    normalizeTransactionId(transactionId)
  ) {
    return false;
  }

  if (!/^success$/i.test(String(data.paymentStatus || ""))) {
    return false;
  }

  const receiptDate = Date.parse(String(data.dateTime || ""));

  if (!Number.isFinite(receiptDate)) {
    return false;
  }

  if (Math.abs(receiptDate - transferTime) > 10 * 60 * 1000) {
    return false;
  }

  if (now() - receiptDate > RECEIPT_MAX_AGE_MS) {
    return false;
  }

  if (receiptDate > now() + 2 * 60 * 1000) {
    return false;
  }

  // Эгер чектен алуучу так окулса, төлөм алуучусу да салыштырылат.
  const recipient = String(data.recipient || "").trim();

  if (!recipient) {
    return false;
  }

  const expectedMethods = order.paymentMethods || {};
  const expectedValues = [
    expectedMethods.obalance,
    order.target === "site" ? SITE_OBALANCE : ""
  ]
    .filter(Boolean)
    .map(normalizeTransactionId);

  const normalizedRecipient = normalizeTransactionId(recipient);

  if (
    expectedValues.length &&
    !expectedValues.some((value) => value && normalizedRecipient.includes(value))
  ) {
    return false;
  }

  return true;
}

async function approveOrderAutomatically(order, receiptFields) {
  const orderRef = db().ref(`payment_orders/${order.orderId}`);
  const cycleRef = db().ref(`payment_cycles/${order.cycleKey}`);

  let cycleState = null;

  const cycleResult = await cycleRef.transaction((current) => {
    const count = Number(current?.successfulCount || 0);
    const expectedTarget = count % 5 === 4 ? "site" : "teacher";

    if (expectedTarget !== order.target) {
      cycleState = {
        conflict: true,
        expectedTarget
      };

      return;
    }

    cycleState = {
      conflict: false,
      count
    };

    return {
      successfulCount: count + 1,
      updatedAt: now(),
      lastOrderId: order.orderId
    };
  });

  if (!cycleResult.committed || cycleState?.conflict) {
    await orderRef.update({
      ...receiptFields,
      status: "pending_review",
      autoReviewNote: "Сатуу кезеги өзгөргөндүктөн кол менен текшерүү керек.",
      updatedAt: now()
    });

    return false;
  }

  const itemSnap = await db()
    .ref(`market_items/${order.productId}`)
    .once("value");

  const item = itemSnap.val();

  if (!item) {
    await orderRef.update({
      ...receiptFields,
      status: "pending_review",
      autoReviewNote: "Материал табылган жок; кол менен текшерүү керек.",
      updatedAt: now()
    });

    return false;
  }

  const approvedAt = now();
  const expiresAt = approvedAt + ACCESS_DURATION_MS;

  await orderRef.update({
    ...receiptFields,
    status: "approved",
    approvedAt,
    updatedAt: approvedAt,
    expiresAt,
    reviewedBy: "automatic_ocr_match",
    autoApproved: true,
    autoReviewNote:
      "Сүрөттөн сумма, транзакция ID, статус жана убакыт дал келди. Бул банк API тастыктоосу эмес."
  });

  await db()
    .ref(`users/${order.buyerUid}/purchases/${order.productId}`)
    .set({
      productId: order.productId,
      title: order.productTitle,
      fileUrl: item.fileUrl || "",
      storagePath: item.storagePath || "",
      fileName: item.fileName || "",
      orderId: order.orderId,
      status: "approved",
      price: order.amount,
      createdAt: approvedAt,
      purchasedAt: approvedAt,
      expiresAt,
      teacherUid: order.teacherUid,
      target: order.target,
      transactionId: order.transactionId,
      accessDays: ACCESS_DAYS
    });

  const sale = {
    orderId: order.orderId,
    productId: order.productId,
    title: order.productTitle,
    amount: order.amount,
    buyerUid: order.buyerUid,
    approvedAt,
    paymentMethod: "QR",
    autoApproved: true
  };

  if (order.target === "teacher") {
    await db()
      .ref(`users/${order.teacherUid}/marketSales/${order.orderId}`)
      .set(sale);
  } else {
    await db()
      .ref(`site_qr_sales/${order.orderId}`)
      .set({
        ...sale,
        teacherUid: order.teacherUid
      });
  }

  return true;
}

function paymentMethodsFor(target, teacherProfile) {
  if (target === "teacher") {
    return {
      mbankQr: teacherProfile?.mbankQr || "",
      obankQr: teacherProfile?.obankQr || "",
      obalance: teacherProfile?.obalance || ""
    };
  }

  return {
    mbankQr: SITE_MBANK_QR,
    obankQr: SITE_OBANK_QR,
    obalance: SITE_OBALANCE
  };
}

function publicPaymentOrder(order) {
  return {
    ok: true,
    orderId: order.orderId,
    status: order.status,
    amount: order.amount,
    title: order.productTitle,
    target: order.target,
    targetLabel: order.target === "teacher" ? "Мугалим" : "Bilimal",
    paymentMethods: order.paymentMethods,
    createdAt: order.createdAt,
    receiptDeadline: order.createdAt + RECEIPT_MAX_AGE_MS
  };
}

async function getUser(uid) {
  const snap = await db()
    .ref(`users/${uid}`)
    .once("value");

  return snap.val() || {};
}

async function getItem(productId) {
  const snap = await db()
    .ref(`market_items/${productId}`)
    .once("value");

  if (!snap.exists()) {
    fail("Материал табылган жок.", 404);
  }

  const item = snap.val();

  if (String(item.status || "published") !== "published") {
    fail("Бул материал азыр сатылбайт.");
  }

  return item;
}
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    ok: true,
    service: "bilimal-market-api",
    provider: "QR receipt review",
    firebaseReady,
    configured: missing.length === 0,
    missing
  });
});

// Материалды жарыялоо.
app.post("/api/materials", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);

  const {
    title,
    subject,
    type,
    price,
    fileUrl,
    storagePath,
    fileName,
    description
  } = req.body || {};

  if (!title || !subject || !type || (!fileUrl && !storagePath)) {
    fail("Материалдын аталышы, предмети, түрү жана файлы/шилтемеси милдеттүү.");
  }

  if (fileUrl && !validHttpUrl(fileUrl)) {
    fail("Материалдын шилтемеси http/https болушу керек.");
  }

  if (
    storagePath &&
    !String(storagePath).startsWith(`market_uploads/${user.uid}/`)
  ) {
    fail("Жүктөлгөн файл бул мугалимге тиешелүү эмес.", 403);
  }

  let cleanPrice = money(price);

  if (cleanPrice < 0 || cleanPrice > 100000) {
    fail("Баасы туура эмес.");
  }

  const itemsSnap = await db()
    .ref("market_items")
    .once("value");

  let count = 0;

  itemsSnap.forEach((child) => {
    if (child.val()?.authorUid === user.uid) {
      count++;
    }
  });

  const isBonus = (count + 1) % BONUS_EVERY === 0;

  if (isBonus) {
    cleanPrice = 0;
  }

  const ref = db().ref("market_items").push();
  const timestamp = now();

  const item = {
    id: ref.key,
    title: safeText(title, 200),
    subject: safeText(subject, 100),
    type: safeText(type, 200),
    price: cleanPrice,
    fileUrl: fileUrl ? String(fileUrl).trim() : "",
    storagePath: storagePath ? safeText(storagePath, 500) : "",
    fileName: safeText(fileName, 180),
    description: safeText(description, 1000),
    authorUid: user.uid,
    authorEmail: user.email || "",
    status: "published",
    createdAt: timestamp,
    updatedAt: timestamp,
    bonusFree: isBonus
  };

  await ref.set(item);

  return {
    ok: true,
    id: ref.key,
    price: cleanPrice,
    bonusFree: isBonus,
    message: isBonus
      ? "Материал жарыяланды. 6-материал акысыз кылынды."
      : "Материал ийгиликтүү жарыяланды."
  };
}));

app.delete("/api/materials/:id", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);

  const ref = db()
    .ref(`market_items/${safeText(req.params.id, 150)}`);

  const snap = await ref.once("value");

  if (!snap.exists()) {
    fail("Материал табылган жок.", 404);
  }

  if (snap.val().authorUid !== user.uid) {
    fail("Бул материалды өчүрүүгө уруксат жок.", 403);
  }

  await ref.remove();

  return { ok: true };
}));

// Мугалимдин төлөм реквизиттерин көрүү.
app.get("/api/teacher/payment-profile", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);

  const snap = await db()
    .ref(`users/${user.uid}/paymentProfile`)
    .once("value");

  return {
    ok: true,
    profile: snap.val() || null
  };
}));

// Мугалимдин төлөм реквизиттерин сактоо.
app.post("/api/teacher/payment-profile", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);

  const mbankQr = safeText(req.body?.mbankQr, 1500);
  const obankQr = safeText(req.body?.obankQr, 1500);
  const obalance = safeText(req.body?.obalance, 30).replace(/\s+/g, "");

  if (mbankQr && !validHttpUrl(mbankQr)) {
    fail("MBank QR үчүн https/http сүрөт шилтемесин киргизиңиз.");
  }

  if (obankQr && !validHttpUrl(obankQr)) {
    fail("O!Bank QR үчүн https/http сүрөт шилтемесин киргизиңиз.");
  }

  if (obalance && !/^[0-9+()-]{9,20}$/.test(obalance)) {
    fail("O!Balance номери туура эмес.");
  }

  if (!mbankQr && !obankQr && !obalance) {
    fail("Кеминде бир төлөм реквизитин толтуруңуз.");
  }

  const profile = {
    mbankQr,
    obankQr,
    obalance,
    updatedAt: now()
  };

  await db()
    .ref(`users/${user.uid}/paymentProfile`)
    .set(profile);

  return {
    ok: true,
    profile,
    message: "Төлөм реквизиттери сакталды."
  };
}));

// QR төлөм заказын түзүү.
app.post("/api/payments/create", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const productId = safeText(req.body?.productId, 150);

  if (!productId) {
    fail("productId керек.");
  }

  const item = await getItem(productId);
  const amount = money(item.price);

  if (amount <= 0) {
    fail("Бул материал акысыз.");
  }

  if (item.authorUid === user.uid) {
    fail("Өз материалыңызды сатып алуу мүмкүн эмес.");
  }

  const existing = await db()
    .ref(`users/${user.uid}/purchases/${productId}`)
    .once("value");

  const purchase = existing.val();

  if (
    purchase?.status === "approved" &&
    Number(purchase.expiresAt) > now()
  ) {
    return {
      ok: true,
      alreadyOwned: true,
      status: "approved",
      expiresAt: purchase.expiresAt,
      orderId: purchase.orderId || null
    };
  }

  if (purchase?.status === "pending_review") {
    return {
      ok: true,
      pendingReview: true,
      message: "Бул материалдын чеги текшерилүүдө. Жаңы төлөм түзүүнүн кереги жок."
    };
  }

  if (purchase?.status === "awaiting_receipt" && purchase.orderId) {
    const oldOrderSnap = await db()
      .ref(`payment_orders/${purchase.orderId}`)
      .once("value");

    if (
      oldOrderSnap.exists() &&
      oldOrderSnap.val().status === "awaiting_receipt" &&
      now() <= Number(oldOrderSnap.val().receiptDeadline)
    ) {
      return publicPaymentOrder(oldOrderSnap.val());
    }
  }

  const profile = await getUser(item.authorUid);
  const teacherProfile = profile.paymentProfile || {};
  const methodsTeacher = paymentMethodsFor("teacher", teacherProfile);

  const key = cycleKey(item.authorUid, amount);

  const cycleSnap = await db()
    .ref(`payment_cycles/${key}`)
    .once("value");

  const successfulCount = Number(
    cycleSnap.val()?.successfulCount || 0
  );

  // Бир баадагы ар бир мугалимдин алгачкы 4 төлөмү мугалимге,
  // 5-төлөм Bilimal'га түшөт. Андан кийин цикл кайталанат.
  const target = successfulCount % 5 === 4
    ? "site"
    : "teacher";

  if (
    target === "teacher" &&
    !methodsTeacher.mbankQr &&
    !methodsTeacher.obankQr &&
    !methodsTeacher.obalance
  ) {
    fail(
      "Бул мугалим төлөм реквизиттерин кошо элек.",
      409
    );
  }

  const orderId = id("QR");
  const createdAt = now();

  const order = {
    orderId,
    buyerUid: user.uid,
    buyerEmail: user.email || "",
    teacherUid: item.authorUid,
    teacherEmail: item.authorEmail || "",
    productId,
    productTitle: safeText(item.title, 200),
    amount,
    cycleKey: key,
    cycleIndex: successfulCount + 1,
    target,
    paymentMethods: paymentMethodsFor(target, teacherProfile),
    status: "awaiting_receipt",
    createdAt,
    updatedAt: createdAt,
    receiptDeadline: createdAt + RECEIPT_MAX_AGE_MS,
    siteQrMbank: SITE_MBANK_QR,
    siteQrObank: SITE_OBANK_QR,
    siteObalance: SITE_OBALANCE
  };

  await db()
    .ref(`payment_orders/${orderId}`)
    .set(order);

  await db()
    .ref(`users/${user.uid}/purchases/${productId}`)
    .set({
      productId,
      title: item.title,
      orderId,
      status: "awaiting_receipt",
      createdAt,
      price: amount,
      teacherUid: item.authorUid
    });

  return publicPaymentOrder(order);
}));
app.post("/api/payments/receipt", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);

  const orderId = safeText(req.body?.orderId, 80);
  const transactionId = safeText(req.body?.transactionId, 120);
  const transferTime = Number(req.body?.transferTime);
  const receiptDataUrl = req.body?.receiptDataUrl;

  if (!orderId || !transactionId || !transferTime || !receiptDataUrl) {
    fail("Заказ, транзакция ID, төлөм убактысы жана чек сүрөтү талап кылынат.");
  }

  const currentTime = now();
  const age = currentTime - transferTime;

  if (age > RECEIPT_MAX_AGE_MS) {
    fail("Чектеги төлөм убактысы 2 сааттан эски. Жаңы чек жүктөңүз.");
  }

  if (age < -2 * 60 * 1000) {
    fail("Төлөм убактысы келечекте көрсөтүлгөн. Датаны текшериңиз.");
  }

  const parsed = parseDataUrl(receiptDataUrl);

  const orderRef = db().ref(`payment_orders/${orderId}`);
  const snap = await orderRef.once("value");

  if (!snap.exists()) {
    fail("Заказ табылган жок.", 404);
  }

  const order = snap.val();

  if (order.buyerUid !== user.uid) {
    fail("Бул заказ сизге тиешелүү эмес.", 403);
  }

  if (order.status !== "awaiting_receipt") {
    fail("Бул заказга чек мурда жөнөтүлгөн же заказ жабылган.", 409);
  }

  if (currentTime > Number(order.receiptDeadline)) {
    fail("Заказдын мөөнөтү өтүп кетти. Жаңы заказ түзүңүз.", 409);
  }

  const receiptHash = crypto
    .createHash("sha256")
    .update(parsed.buffer)
    .digest("hex");

  const transactionHash = crypto
    .createHash("sha256")
    .update(transactionId.toLowerCase())
    .digest("hex");

  const transactionRef = db()
    .ref(`used_transactions/${transactionHash}`);

  const receiptRef = db()
    .ref(`used_receipts/${receiptHash}`);

  const transactionReservation = await transactionRef.transaction((current) => {
    if (current && current.orderId !== orderId) {
      return;
    }

    return {
      orderId,
      createdAt: now()
    };
  });

  if (!transactionReservation.committed) {
    fail("Бул транзакция ID мурда колдонулган.", 409);
  }

  const receiptReservation = await receiptRef.transaction((current) => {
    if (current && current.orderId !== orderId) {
      return;
    }

    return {
      orderId,
      createdAt: now()
    };
  });

  if (!receiptReservation.committed) {
    fail("Бул чек сүрөтү мурда колдонулган.", 409);
  }

  const ocr = await runGeminiOcr(
    parsed.mimeType,
    parsed.base64
  );

  const receiptFields = {
    transactionId,
    transactionHash,
    receiptHash,
    receiptDataUrl,
    receiptMimeType: parsed.mimeType,
    transferTime,
    ocrResult: ocr,
    receiptSubmittedAt: now(),
    updatedAt: now()
  };

  // Бардык маанилүү маалыматтар чектен туура окулса гана
  // автоматтык уруксат берүү аракетин жасайбыз.
  const autoEligible = ocrAllowsAutoApproval(
    ocr,
    order,
    transactionId,
    transferTime
  );

  if (autoEligible) {
    const approved = await approveOrderAutomatically(
      order,
      receiptFields
    );

    if (approved) {
      return {
        ok: true,
        status: "approved",
        expiresAt: now() + ACCESS_DURATION_MS,
        accessDays: ACCESS_DAYS,
        message: "Чек автоматтык текшерүүдөн өттү. Материалга 3 күндүк жеткиликтүүлүк берилди."
      };
    }

    const refreshed = await orderRef.once("value");

    return {
      ok: true,
      status: refreshed.val()?.status || "pending_review",
      message: "Чек кошумча текшерүүгө жөнөтүлдү."
    };
  }

  await orderRef.update({
    ...receiptFields,
    status: "pending_review",
    autoReviewNote: ocr?.enabled
      ? "Чектеги маалыматтар заказ менен толук дал келген жок; администратор текшерет."
      : "Gemini OCR жеткиликсиз; администратор текшерет."
  });

  await db()
    .ref(`users/${user.uid}/purchases/${order.productId}`)
    .update({
      status: "pending_review",
      transactionId,
      updatedAt: now()
    });

  return {
    ok: true,
    status: "pending_review",
    message: "Чек кабыл алынды, бирок бардык маалыматтар так дал келген жок. Администратор текшерет."
  };
}));

app.get("/api/payments/status", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const orderId = safeText(req.query.orderId, 80);

  if (!orderId) {
    fail("orderId керек.");
  }

  const snap = await db()
    .ref(`payment_orders/${orderId}`)
    .once("value");

  if (!snap.exists()) {
    fail("Заказ табылган жок.", 404);
  }

  const order = snap.val();

  if (
    order.buyerUid !== user.uid &&
    !isAdminRecord(await getUser(user.uid))
  ) {
    fail("Бул заказды көрүүгө уруксат жок.", 403);
  }

  const active = order.status === "approved" &&
    Number(order.expiresAt) > now();

  return {
    ok: true,
    orderId,
    status: active ? "approved" : (
      order.status === "approved" ? "expired" : order.status
    ),
    expiresAt: order.expiresAt || null,
    accessDays: active ? ACCESS_DAYS : null,
    message: active
      ? "Төлөм тастыкталды. Материалга 3 күндүк жеткиликтүүлүк берилди."
      : order.status === "pending_review"
        ? "Чек кошумча текшерилүүдө."
        : order.status === "rejected"
          ? (order.reviewNote || "Төлөм четке кагылды.")
          : order.status === "approved"
            ? "Материалга жеткиликтүүлүк мөөнөтү аяктады."
            : "Төлөм күтүлүүдө."
  };
}));
// Администратордун текшерүү кезеги.
app.get("/api/admin/payments", (req, res) => json(req, res, async () => {
  await adminUser(req);

  const snap = await db()
    .ref("payment_orders")
    .once("value");

  const items = [];

  snap.forEach((child) => {
    const order = child.val() || {};

    if (["pending_review", "receipt_rejected"].includes(order.status)) {
      items.push({
        orderId: order.orderId,
        buyerUid: order.buyerUid,
        buyerEmail: order.buyerEmail,
        teacherUid: order.teacherUid,
        teacherEmail: order.teacherEmail,
        productId: order.productId,
        productTitle: order.productTitle,
        amount: order.amount,
        target: order.target,
        status: order.status,
        createdAt: order.createdAt,
        transferTime: order.transferTime,
        transactionId: order.transactionId,
        receiptDataUrl: order.receiptDataUrl,
        ocrResult: order.ocrResult || null,
        autoReviewNote: order.autoReviewNote || "",
        reviewNote: order.reviewNote || ""
      });
    }
  });

  items.sort(
    (a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)
  );

  return {
    ok: true,
    items
  };
}));

// Кол менен текшерилген төлөмдү бекитүү.
app.post("/api/admin/payments/:id/approve", (req, res) => json(req, res, async () => {
  const admin = await adminUser(req);

  const orderId = safeText(req.params.id, 80);
  const orderRef = db().ref(`payment_orders/${orderId}`);
  const snap = await orderRef.once("value");

  if (!snap.exists()) {
    fail("Заказ табылган жок.", 404);
  }

  const order = snap.val();

  if (order.status !== "pending_review") {
    fail("Бул төлөм бекитүүгө даяр эмес.", 409);
  }

  const cycleRef = db().ref(`payment_cycles/${order.cycleKey}`);
  let cycleState = null;

  const cycleResult = await cycleRef.transaction((current) => {
    const count = Number(current?.successfulCount || 0);
    const expectedTarget = count % 5 === 4 ? "site" : "teacher";

    if (expectedTarget !== order.target) {
      cycleState = {
        conflict: true,
        expectedTarget
      };

      return;
    }

    cycleState = {
      conflict: false,
      count
    };

    return {
      successfulCount: count + 1,
      updatedAt: now(),
      lastOrderId: orderId
    };
  });

  if (!cycleResult.committed || cycleState?.conflict) {
    fail(
      "Төлөм кезегинин абалы өзгөргөн. Жаңы заказ түзүп, төлөм реквизиттерин кайра текшериңиз.",
      409
    );
  }

  const itemSnap = await db()
    .ref(`market_items/${order.productId}`)
    .once("value");

  const item = itemSnap.val();

  if (!item) {
    fail("Материал табылган жок.", 404);
  }

  const approvedAt = now();
  const expiresAt = approvedAt + ACCESS_DURATION_MS;

  await orderRef.update({
    status: "approved",
    approvedAt,
    updatedAt: approvedAt,
    expiresAt,
    reviewedBy: admin.uid,
    autoApproved: false
  });

  await db()
    .ref(`users/${order.buyerUid}/purchases/${order.productId}`)
    .set({
      productId: order.productId,
      title: order.productTitle,
      fileUrl: item.fileUrl || "",
      storagePath: item.storagePath || "",
      fileName: item.fileName || "",
      orderId,
      status: "approved",
      price: order.amount,
      createdAt: approvedAt,
      purchasedAt: approvedAt,
      expiresAt,
      teacherUid: order.teacherUid,
      target: order.target,
      transactionId: order.transactionId,
      accessDays: ACCESS_DAYS
    });

  const sale = {
    orderId,
    productId: order.productId,
    title: order.productTitle,
    amount: order.amount,
    buyerUid: order.buyerUid,
    approvedAt,
    paymentMethod: "QR",
    autoApproved: false
  };

  if (order.target === "teacher") {
    await db()
      .ref(`users/${order.teacherUid}/marketSales/${orderId}`)
      .set(sale);
  } else {
    await db()
      .ref(`site_qr_sales/${orderId}`)
      .set({
        ...sale,
        teacherUid: order.teacherUid
      });
  }

  return {
    ok: true,
    expiresAt,
    accessDays: ACCESS_DAYS,
    message: "Төлөм бекитилди. Материалга 3 күндүк уруксат берилди."
  };
}));

// Төлөмдү четке кагуу.
app.post("/api/admin/payments/:id/reject", (req, res) => json(req, res, async () => {
  await adminUser(req);

  const orderId = safeText(req.params.id, 80);
  const ref = db().ref(`payment_orders/${orderId}`);
  const snap = await ref.once("value");

  if (!snap.exists()) {
    fail("Заказ табылган жок.", 404);
  }

  const order = snap.val();

  if (order.status !== "pending_review") {
    fail("Бул төлөм текшерүү кезегинде эмес.", 409);
  }

  const note = safeText(
    req.body?.note || "Чек тастыкталган жок. Туура чекти кайра жөнөтүңүз.",
    500
  );

  await ref.update({
    status: "rejected",
    reviewNote: note,
    reviewedAt: now(),
    updatedAt: now()
  });

  await db()
    .ref(`users/${order.buyerUid}/purchases/${order.productId}`)
    .update({
      status: "rejected",
      reviewNote: note,
      updatedAt: now()
    });

  return {
    ok: true,
    message: "Төлөм четке кагылды."
  };
}));

// Мугалимдин акча чыгаруу реквизитин сактоо.
app.post("/api/cards/add", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const method = safeText(req.body?.method, 60);
  const account = safeText(req.body?.account, 100);

  if (!method || account.length < 5) {
    fail("Төлөм ыкмасын жана толук реквизитти киргизиңиз.");
  }

  const card = {
    method,
    account,
    masked: `${method}: ${maskAccount(account)}`,
    updatedAt: now()
  };

  await db()
    .ref(`users/${user.uid}/payoutCard`)
    .set(card);

  return {
    ok: true,
    card: {
      method,
      masked: card.masked
    }
  };
}));

app.get("/api/cards", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);

  const snap = await db()
    .ref(`users/${user.uid}/payoutCard`)
    .once("value");

  const card = snap.val();

  return {
    ok: true,
    card: card
      ? {
          method: card.method,
          masked: card.masked
        }
      : null
  };
}));

app.delete("/api/cards/:id", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);

  await db()
    .ref(`users/${user.uid}/payoutCard`)
    .remove();

  return { ok: true };
}));
// Мугалимдин акча чыгаруу өтүнүчүн түзүү.
app.post("/api/withdrawals/create", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const amount = money(req.body?.amount);

  if (amount < MIN_WITHDRAWAL || amount > 10000000) {
    fail(`Чыгаруу суммасы кеминде ${MIN_WITHDRAWAL} сом болушу керек.`);
  }

  const cardSnap = await db()
    .ref(`users/${user.uid}/payoutCard`)
    .once("value");

  const card = cardSnap.val();

  if (!card?.account) {
    fail("Алгач акча чыгаруу реквизитин сактаңыз.");
  }

  const withdrawalRef = db()
    .ref("withdrawals")
    .push();

  const withdrawal = {
    id: withdrawalRef.key,
    uid: user.uid,
    email: user.email || "",
    amount,
    cardMasked: card.masked,
    method: card.method,
    status: "pending",
    createdAt: now()
  };

  await withdrawalRef.set(withdrawal);

  await db()
    .ref(`users/${user.uid}/withdrawalReserved`)
    .transaction((current) => money(current) + amount);

  return {
    ok: true,
    id: withdrawalRef.key,
    amount,
    message: "Өтүнүч администраторго жөнөтүлдү."
  };
}));

// Администратор үчүн акча чыгаруу өтүнүчтөрү.
app.get("/api/admin/withdrawals", (req, res) => json(req, res, async () => {
  await adminUser(req);

  const snap = await db()
    .ref("withdrawals")
    .once("value");

  const items = [];

  snap.forEach((child) => {
    items.push({
      id: child.key,
      ...(child.val() || {})
    });
  });

  items.sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
  );

  return {
    ok: true,
    items
  };
}));

// Өтүнүчтү бекитүү — акча банк аркылуу өзүнчө которулат.
app.post("/api/admin/withdrawals/:id/approve", (req, res) => json(req, res, async () => {
  await adminUser(req);

  const ref = db()
    .ref(`withdrawals/${safeText(req.params.id, 150)}`);

  const snap = await ref.once("value");

  if (!snap.exists()) {
    fail("Өтүнүч табылган жок.", 404);
  }

  const withdrawal = snap.val();

  if (withdrawal.status !== "pending") {
    fail("Бул өтүнүч мурда иштетилген.", 409);
  }

  await ref.update({
    status: "approved_manual",
    approvedAt: now(),
    note: "Администратор кол менен төлөшү керек."
  });

  await db()
    .ref(`users/${withdrawal.uid}/withdrawalReserved`)
    .transaction((current) => Math.max(
      0,
      money(current) - money(withdrawal.amount)
    ));

  return {
    ok: true,
    message: "Өтүнүч бекитилди. Акчаны банк аркылуу которуп, төлөмдү эсепке белгилеңиз."
  };
}));

// Белгисиз API маршруттары.
app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    message: "API route табылган жок."
  });
});

export default app;
