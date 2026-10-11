import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";

const app = express();
const env = process.env;
const ACCESS_DURATION_MS = 72 * 60 * 60 * 1000;
const RECEIPT_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const ORDER_WINDOW_MS = 2 * 60 * 60 * 1000;
const SIGNED_UPLOAD_MS = 10 * 60 * 1000;
const SIGNED_VIEW_MS = 30 * 60 * 1000;
const MAX_MATERIAL_BYTES = 100 * 1024 * 1024;
const MAX_QR_BYTES = 2 * 1024 * 1024;
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const BONUS_EVERY = 6;

app.set("trust proxy", 1);
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const requiredCore = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_DATABASE_URL"
];
const missingCore = requiredCore.filter((key) => !env[key]);
const missing = [...missingCore];
if (!env.FIREBASE_STORAGE_BUCKET) missing.push("FIREBASE_STORAGE_BUCKET");

let firebaseReady = false;
let storageReady = false;
let database = null;
let authClient = null;
let bucket = null;

if (missingCore.length === 0) {
  try {
    const appOptions = {
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: String(env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n")
      }),
      databaseURL: env.FIREBASE_DATABASE_URL,
      ...(env.FIREBASE_STORAGE_BUCKET ? { storageBucket: env.FIREBASE_STORAGE_BUCKET } : {})
    };
    const firebaseApp = getApps().length ? getApps()[0] : initializeApp(appOptions);
    database = getDatabase(firebaseApp);
    authClient = getAuth(firebaseApp);
    firebaseReady = true;
    if (env.FIREBASE_STORAGE_BUCKET) {
      bucket = getStorage(firebaseApp).bucket(env.FIREBASE_STORAGE_BUCKET);
      storageReady = true;
    }
  } catch (error) {
    console.error("Firebase initialization failed:", error?.message || error);
  }
}

function now() { return Date.now(); }
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function safeText(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}
function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function newId(prefix = "BL") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}
function db() {
  if (!firebaseReady || !database) fail(`Firebase конфигурациясы толук эмес: ${missingCore.join(", ")}`, 503);
  return database;
}
function storage() {
  if (!storageReady || !bucket) fail("Firebase Storage даяр эмес. FIREBASE_STORAGE_BUCKET өзгөрмөсүн текшерип, Storage'ди иштетиңиз.", 503);
  return bucket;
}
async function bearerUser(req) {
  if (!firebaseReady || !authClient) fail("Firebase конфигурациясы толук эмес.", 503);
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) fail("Кирүү талап кылынат.", 401);
  try {
    return await authClient.verifyIdToken(header.slice(7));
  } catch {
    fail("Кирүү токени жараксыз же мөөнөтү бүткөн. Кайра кириңиз.", 401);
  }
}
function parseAllowlist(value) {
  return new Set(String(value || "").split(",").map((x) => x.trim()).filter(Boolean));
}
async function adminUser(req) {
  const user = await bearerUser(req);
  const uidAllowlist = parseAllowlist(env.BILIMAL_ADMIN_UIDS);
  const emailAllowlist = new Set([...parseAllowlist(env.BILIMAL_ADMIN_EMAILS)].map((email) => email.toLowerCase()));
  const allowed = user.admin === true ||
    uidAllowlist.has(user.uid) ||
    (user.email && emailAllowlist.has(user.email.toLowerCase()));
  if (!allowed) fail("Администратордук укук талап кылынат. BILIMAL_ADMIN_UIDS өзгөрмөсүн текшериңиз.", 403);
  return user;
}
async function json(req, res, handler) {
  try {
    const result = await handler();
    if (!res.headersSent) res.status(200).json(result ?? { ok: true });
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.status || 500).json({
        ok: false,
        message: error.status ? error.message : "Серверде ката кетти. Сервер журналын текшериңиз."
      });
    }
    if (!error.status) console.error(error);
  }
}
function extensionOf(filename) {
  return path.extname(String(filename || "").split(/[\\/]/).pop() || "").toLowerCase();
}
function safeFilename(filename) {
  const base = String(filename || "file").split(/[\\/]/).pop().replace(/[^\p{L}\p{N}._() -]/gu, "_").trim();
  return (base || "file").slice(0, 180);
}
const materialMimeByExt = new Map(Object.entries({
  ".doc": ["application/msword", "application/octet-stream"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
  ".pdf": ["application/pdf", "application/octet-stream"],
  ".ppt": ["application/vnd.ms-powerpoint", "application/octet-stream"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"],
  ".xls": ["application/vnd.ms-excel", "application/octet-stream"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
  ".txt": ["text/plain", "application/octet-stream"],
  ".rtf": ["application/rtf", "text/rtf", "application/octet-stream"],
  ".jpg": ["image/jpeg", "application/octet-stream"],
  ".jpeg": ["image/jpeg", "application/octet-stream"],
  ".png": ["image/png", "application/octet-stream"],
  ".webp": ["image/webp", "application/octet-stream"],
  ".mp4": ["video/mp4", "application/octet-stream"],
  ".webm": ["video/webm", "application/octet-stream"],
  ".zip": ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
  ".html": ["text/html", "application/octet-stream"],
  ".htm": ["text/html", "application/octet-stream"],
  ".css": ["text/css", "application/octet-stream"],
  ".js": ["text/javascript", "application/javascript", "application/octet-stream"],
  ".json": ["application/json", "application/octet-stream"]
}));
const imageMimeByExt = new Map([
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".png", "image/png"], [".webp", "image/webp"]
]);
function normalizeMime(value) { return String(value || "application/octet-stream").split(";")[0].trim().toLowerCase(); }
function validateUploadInfo(filename, contentType, size, purpose) {
  const ext = extensionOf(filename);
  const mime = normalizeMime(contentType);
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 1) fail("Файлдын өлчөмү туура эмес.");
  if (["teacher-mbank", "teacher-obank", "site-mbank", "site-obank", "receipt"].includes(purpose)) {
    if (bytes > MAX_QR_BYTES) fail("QR же чек сүрөтү 2 МБдан ашпашы керек.");
    const expected = imageMimeByExt.get(ext);
    if (!expected || (mime !== expected && mime !== "application/octet-stream")) {
      fail("Сүрөт JPG, PNG же WEBP форматында болушу керек.");
    }
    return { ext, mime: expected, maxBytes: MAX_QR_BYTES };
  }
  if (purpose !== "material") fail("Жүктөө максаты туура эмес.");
  if (bytes > MAX_MATERIAL_BYTES) fail("Материалдын файлы 100 МБдан ашпашы керек.");
  const expectedMimes = materialMimeByExt.get(ext);
  if (!expectedMimes) fail("Бул файл форматы колдоого алынбайт.");
  if (!expectedMimes.includes(mime)) fail(`Файлдын MIME түрү кеңейтүүсүнө туура келбейт: ${ext}`);
  return { ext, mime: mime === "application/octet-stream" ? expectedMimes[0] : mime, maxBytes: MAX_MATERIAL_BYTES };
}
async function signedUrl(filePath, action, expiresAt) {
  if (!filePath) return "";
  const f = storage().file(filePath);
  const [exists] = await f.exists();
  if (!exists) return "";
  const [url] = await f.getSignedUrl({
    version: "v4",
    action,
    expires: Math.max(now() + 60 * 1000, Math.min(Number(expiresAt) || (now() + SIGNED_VIEW_MS), now() + 2 * 60 * 60 * 1000))
  });
  return url;
}
async function checkStorageFile(filePath, expectedPrefix, maxBytes, allowedMimes = null) {
  const cleanPath = safeText(filePath, 500);
  if (!cleanPath || !cleanPath.startsWith(expectedPrefix) || cleanPath.includes("..")) fail("Файлдын сактагыч жолу уруксат берилген эмес.", 403);
  const f = storage().file(cleanPath);
  let metadata;
  try { [metadata] = await f.getMetadata(); } catch { fail("Жүктөлгөн файл табылган жок. Жүктөөнү кайра аткарыңыз.", 404); }
  const size = Number(metadata.size || 0);
  const mime = normalizeMime(metadata.contentType);
  if (!size || size > maxBytes) fail("Сактагычтагы файлдын өлчөмү чектен ашып же бош болуп калды.");
  if (allowedMimes && !allowedMimes.includes(mime)) fail("Сактагычтагы файлдын түрү уруксат берилген эмес.");
  return { file: f, metadata, size, mime, path: cleanPath };
}
function isTeacherPath(uid, pathValue) { return String(pathValue || "").startsWith(`payment_qr/teachers/${uid}/`); }
function validBalance(value) { const s = String(value || "").replace(/\s+/g, ""); return !s || /^[0-9+()\-]{9,20}$/.test(s); }
async function getUserRecord(uid) {
  const snap = await db().ref(`users/${uid}`).once("value");
  return snap.val() || {};
}
async function safeDisplayName(uid, email = "") {
  const profile = await getUserRecord(uid);
  const value = safeText(profile.displayName || profile.name || profile.fullName || "", 100);
  return value || "Мугалим";
}
function publicItem(id, item) {
  return {
    id,
    title: safeText(item.title, 200),
    subject: safeText(item.subject, 100),
    grade: safeText(item.grade, 30),
    type: safeText(item.type, 200),
    price: money(item.price),
    description: safeText(item.description, 1000),
    fileName: safeFilename(item.fileName || "material"),
    fileType: safeText(item.fileType || extensionOf(item.fileName || ""), 20),
    authorName: safeText(item.authorName || "Мугалим", 100),
    status: safeText(item.status || "published", 30),
    createdAt: Number(item.createdAt || 0),
    bonusFree: item.bonusFree === true,
    storageReady: Boolean(item.storagePath)
  };
}
async function getItem(productId, allowRemoved = false) {
  const idValue = safeText(productId, 150);
  if (!idValue) fail("Материалдын ID'и керек.");
  const snap = await db().ref(`market_items/${idValue}`).once("value");
  if (!snap.exists()) fail("Материал табылган жок.", 404);
  const item = snap.val() || {};
  if (!allowRemoved && String(item.status || "published") !== "published") fail("Бул материал азыр сатылбайт.", 404);
  return { id: idValue, ...item };
}
function expectedTarget(saleNumber) { return saleNumber % 5 === 0 ? "site" : "teacher"; }
async function reservationForTeacher(teacherUid) {
  const ref = db().ref(`payment_cycles/${teacherUid}`);
  const snap = await ref.once("value");
  return { ref, value: snap.val() || {} };
}
async function clearReservation(teacherUid, orderId) {
  if (!teacherUid || !orderId) return;
  const ref = db().ref(`payment_cycles/${teacherUid}`);
  await ref.transaction((current) => {
    if (!current || current.pendingOrderId !== orderId) return;
    return {
      ...current,
      pendingOrderId: null,
      pendingSaleNumber: null,
      pendingStatus: null,
      pendingExpiresAt: 0,
      updatedAt: now()
    };
  });
}
async function signedProfile(profile, expires = now() + SIGNED_VIEW_MS) {
  const p = profile || {};
  return {
    mbankQrPath: p.mbankQrPath || "",
    obankQrPath: p.obankQrPath || "",
    mbankQr: await signedUrl(p.mbankQrPath, "read", expires),
    obankQr: await signedUrl(p.obankQrPath, "read", expires),
    obalance: safeText(p.obalance, 30),
    updatedAt: Number(p.updatedAt || 0)
  };
}
async function paymentSnapshotForTarget(target, teacherUid, expiry) {
  if (target === "teacher") {
    const snap = await db().ref(`users/${teacherUid}/paymentProfile`).once("value");
    const profile = snap.val() || {};
    if (!profile.mbankQrPath && !profile.obankQrPath && !profile.obalance) {
      fail("Бул мугалим төлөм реквизиттерин кошо элек. Башка материал тандаңыз же авторго кайрылыңыз.", 409);
    }
    return {
      mbankQrPath: profile.mbankQrPath || "",
      obankQrPath: profile.obankQrPath || "",
      obalance: safeText(profile.obalance, 30),
      mbankQr: await signedUrl(profile.mbankQrPath, "read", expiry),
      obankQr: await signedUrl(profile.obankQrPath, "read", expiry)
    };
  }
  const snap = await db().ref("settings/sitePaymentProfile").once("value");
  const profile = snap.val() || {};
  if (!profile.mbankQrPath && !profile.obankQrPath && !profile.obalance) {
    fail("Сайттын төлөм реквизиттери администратор тарабынан киргизиле элек.", 503);
  }
  return {
    mbankQrPath: profile.mbankQrPath || "",
    obankQrPath: profile.obankQrPath || "",
    obalance: safeText(profile.obalance, 30),
    mbankQr: await signedUrl(profile.mbankQrPath, "read", expiry),
    obankQr: await signedUrl(profile.obankQrPath, "read", expiry)
  };
}
function safeOrder(order) {
  return {
    orderId: order.orderId,
    productId: order.productId,
    productTitle: order.productTitle,
    amount: money(order.amount),
    teacherUid: order.teacherUid,
    saleNumber: Number(order.saleNumber || 0),
    target: order.target,
    recipientName: order.target === "site" ? "Bilimal.org" : safeText(order.teacherName || "Мугалим", 100),
    paymentMethods: order.paymentMethods || {},
    paymentMethod: order.paymentMethod,
    status: order.status,
    createdAt: order.createdAt,
    receiptDeadline: order.receiptDeadline,
    expiresAt: order.expiresAt || null
  };
}
async function orderWithRefresh(order) {
  const snapshot = { ...(order.paymentMethods || {}) };
  const expiry = Math.min(Number(order.receiptDeadline || now() + SIGNED_VIEW_MS), now() + 2 * 60 * 60 * 1000);
  snapshot.mbankQr = await signedUrl(snapshot.mbankQrPath, "read", expiry);
  snapshot.obankQr = await signedUrl(snapshot.obankQrPath, "read", expiry);
  return { ...safeOrder(order), paymentMethods: snapshot };
}
async function releaseExpiredPending(teacherUid) {
  const ref = db().ref(`payment_cycles/${teacherUid}`);
  await ref.transaction((current) => {
    if (!current) return current;
    if (current.pendingOrderId && Number(current.pendingExpiresAt || 0) > now()) return;
    if (!current.pendingOrderId) return current;
    return { ...current, pendingOrderId: null, pendingExpiresAt: 0, updatedAt: now() };
  });
}
async function verifyOrderOwner(orderId, uid) {
  const snap = await db().ref(`payment_orders/${safeText(orderId, 100)}`).once("value");
  if (!snap.exists()) fail("Заказ табылган жок.", 404);
  const order = snap.val();
  if (order.buyerUid !== uid) fail("Бул заказ сизге тиешелүү эмес.", 403);
  return order;
}

app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    ok: true,
    service: "bilimal-market-api",
    configured: firebaseReady && storageReady,
    firebaseReady,
    storageReady,
    missing
  });
});

app.get("/api/admin/me", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const uids = parseAllowlist(env.BILIMAL_ADMIN_UIDS);
  const emails = new Set([...parseAllowlist(env.BILIMAL_ADMIN_EMAILS)].map((email) => email.toLowerCase()));
  return { ok: true, isAdmin: user.admin === true || uids.has(user.uid) || (user.email && emails.has(user.email.toLowerCase())) };
}));

// Public metadata only. No public file URL or Storage path is returned.
app.post("/api/admin/migrate-sale-cycles", (req, res) => json(req, res, async () => {
  const admin = await adminUser(req);
  const migrationRef = db().ref("settings/paymentCycleMigrationV2");
  const migrationSnap = await migrationRef.once("value");
  if (migrationSnap.exists()) fail("Сатуу кезегинин көчүрүүсү буга чейин аткарылган. Кайра иштетүүгө болбойт.", 409);
  const allOrdersSnap = await db().ref("payment_orders").once("value");
  const approved = [];
  const seen = new Set();
  allOrdersSnap.forEach((child) => {
    const order = child.val() || {};
    if (order.status !== "approved" || !order.teacherUid || !order.orderId || seen.has(order.orderId)) return;
    seen.add(order.orderId);
    approved.push({ teacherUid: order.teacherUid, orderId: order.orderId, approvedAt: Number(order.approvedAt || order.createdAt || 0) });
  });
  approved.sort((a, b) => a.approvedAt - b.approvedAt);
  const groups = new Map();
  for (const sale of approved) {
    const arr = groups.get(sale.teacherUid) || [];
    arr.push(sale); groups.set(sale.teacherUid, arr);
  }
  const updates = {};
  for (const [teacherUid, sales] of groups.entries()) {
    const currentSnap = await db().ref(`payment_cycles/${teacherUid}`).once("value");
    const current = currentSnap.val();
    if (current && (Number(current.successfulCount || 0) > 0 || current.pendingOrderId)) {
      fail(`Мугалимдин ${teacherUid} сатуу эсептегичи мурунтан бар. Коопсуз көчүрүү үчүн кол менен текшерүү керек.`, 409);
    }
    updates[`payment_cycles/${teacherUid}`] = {
      successfulCount: sales.length,
      pendingOrderId: null,
      pendingSaleNumber: null,
      pendingStatus: null,
      pendingExpiresAt: 0,
      lastOrderId: sales[sales.length - 1]?.orderId || null,
      migratedAt: now(),
      updatedAt: now()
    };
  }
  updates["settings/paymentCycleMigrationV2"] = { migratedAt: now(), adminUid: admin.uid, approvedOrders: approved.length, teachers: groups.size };
  await db().ref().update(updates);
  return { ok: true, migratedOrders: approved.length, teachers: groups.size, message: `Көчүрүү аяктады: ${groups.size} мугалим, ${approved.length} мурда бекитилген сатуу эсепке алынды.` };
}));

app.get("/api/materials", (req, res) => json(req, res, async () => {
  const snap = await db().ref("market_items").once("value");
  const items = [];
  snap.forEach((child) => {
    const item = child.val() || {};
    if (String(item.status || "published") === "published" && item.storagePath) items.push(publicItem(child.key, item));
  });
  items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return { ok: true, items };
}));

app.get("/api/me/materials", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const snap = await db().ref("market_items").once("value");
  const items = [];
  snap.forEach((child) => {
    const item = child.val() || {};
    if (item.authorUid === user.uid) items.push({ ...publicItem(child.key, item), status: item.status || "published" });
  });
  items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return { ok: true, items };
}));

app.get("/api/me/purchases", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const snap = await db().ref(`users/${user.uid}/purchases`).once("value");
  const items = [];
  snap.forEach((child) => {
    const p = child.val() || {};
    items.push({
      orderId: child.key,
      productId: p.productId,
      title: p.title,
      price: money(p.price),
      status: p.status,
      purchasedAt: Number(p.purchasedAt || p.createdAt || 0),
      expiresAt: Number(p.expiresAt || 0),
      accessDays: p.accessDays || 3
    });
  });
  items.sort((a, b) => b.purchasedAt - a.purchasedAt);
  return { ok: true, items };
}));

// Create a short-lived signed upload URL. All objects remain private.
app.post("/api/uploads/sign", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const purpose = safeText(req.body?.purpose, 40);
  const filename = safeFilename(req.body?.fileName || "file");
  const contentType = normalizeMime(req.body?.contentType);
  const size = Number(req.body?.size || 0);
  const check = validateUploadInfo(filename, contentType, size, purpose);
  let objectPath;
  if (purpose === "material") {
    objectPath = `market_uploads/${user.uid}/${crypto.randomUUID()}${check.ext}`;
  } else if (purpose === "teacher-mbank" || purpose === "teacher-obank") {
    objectPath = `payment_qr/teachers/${user.uid}/${crypto.randomUUID()}${check.ext}`;
  } else if (purpose === "site-mbank" || purpose === "site-obank") {
    await adminUser(req);
    objectPath = `payment_qr/site/${crypto.randomUUID()}${check.ext}`;
  } else if (purpose === "receipt") {
    const orderId = safeText(req.body?.orderId, 100);
    const order = await verifyOrderOwner(orderId, user.uid);
    if (!["awaiting_receipt", "pending_review"].includes(order.status)) fail("Бул заказга чек жүктөөгө болбойт.", 409);
    if (now() > Number(order.receiptDeadline || 0)) fail("Заказдын төлөм мөөнөтү бүттү. Жаңы заказ түзүңүз.", 409);
    objectPath = `payment_receipts/${user.uid}/${orderId}/${crypto.randomUUID()}${check.ext}`;
  } else {
    fail("Жүктөө максаты уруксат берилген эмес.");
  }
  const expiresAt = now() + SIGNED_UPLOAD_MS;
  const [uploadUrl] = await storage().file(objectPath).getSignedUrl({
    version: "v4", action: "write", expires: expiresAt, contentType: check.mime
  });
  return { ok: true, uploadUrl, storagePath: objectPath, contentType: check.mime, expiresAt, requiredHeaders: { "Content-Type": check.mime } };
}));

// Remove an unused upload after the metadata save failed.
app.delete("/api/uploads", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const objectPath = safeText(req.body?.storagePath, 500);
  const allowed = objectPath.startsWith(`market_uploads/${user.uid}/`) ||
    objectPath.startsWith(`payment_qr/teachers/${user.uid}/`);
  if (!allowed || objectPath.includes("..")) fail("Файлды өчүрүүгө укук жок.", 403);
  const [exists] = await storage().file(objectPath).exists();
  if (exists) await storage().file(objectPath).delete({ ignoreNotFound: true });
  return { ok: true };
}));

app.post("/api/materials", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const title = safeText(req.body?.title, 200);
  const subject = safeText(req.body?.subject, 100);
  const grade = safeText(req.body?.grade, 30);
  const type = safeText(req.body?.type, 200);
  const description = safeText(req.body?.description, 1000);
  const fileName = safeFilename(req.body?.fileName || "material");
  const storagePath = safeText(req.body?.storagePath, 500);
  const requestedPrice = money(req.body?.price);
  if (!title || !subject || !type || !storagePath) fail("Аталыш, предмет, материалдын түрү жана файл керек.");
  if (requestedPrice < 0 || requestedPrice > 100000) fail("Баасы 0–100000 сом арасында болушу керек.");
  const file = await checkStorageFile(storagePath, `market_uploads/${user.uid}/`, MAX_MATERIAL_BYTES);
  const ext = extensionOf(fileName);
  const allowedMimes = materialMimeByExt.get(ext);
  if (!allowedMimes) fail("Файлдын кеңейтүүсү уруксат берилген эмес.");
  if (!allowedMimes.includes(file.mime)) fail("Файлдын форматы менен сакталган MIME түрү дал келбейт.");

  const itemsSnap = await db().ref("market_items").once("value");
  let authorItemCount = 0;
  itemsSnap.forEach((child) => { if ((child.val() || {}).authorUid === user.uid) authorItemCount += 1; });
  const bonusFree = (authorItemCount + 1) % BONUS_EVERY === 0;
  const price = bonusFree ? 0 : requestedPrice;
  const idRef = db().ref("market_items").push();
  const authorName = await safeDisplayName(user.uid, user.email || "");
  const timestamp = now();
  const item = {
    id: idRef.key,
    title, subject, grade, type, price, description,
    storagePath: file.path,
    fileName,
    fileType: ext.replace(/^\./, ""),
    fileSize: file.size,
    contentType: file.mime,
    authorUid: user.uid,
    authorName,
    status: "published",
    createdAt: timestamp,
    updatedAt: timestamp,
    bonusFree
  };
  await idRef.set(item);
  return {
    ok: true,
    id: idRef.key,
    price,
    bonusFree,
    message: bonusFree ? "Материал жарыяланды. Ар бир алтынчы жүктөлгөн материал акысыз болот." : "Материал ийгиликтүү жарыяланды."
  };
}));

app.delete("/api/materials/:id", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const itemRef = db().ref(`market_items/${safeText(req.params.id, 150)}`);
  const snap = await itemRef.once("value");
  if (!snap.exists()) fail("Материал табылган жок.", 404);
  const item = snap.val() || {};
  if (item.authorUid !== user.uid) fail("Бул материалды өчүрүүгө уруксат жок.", 403);
  // Soft-delete so existing 72-hour purchase permissions keep working.
  await itemRef.update({ status: "removed", updatedAt: now(), removedAt: now() });
  return { ok: true, message: "Материал витринадан алынды. Мурда төлөп алган кардарлардын мөөнөтү бүткөнгө чейинки укуктары сакталат." };
}));

app.post("/api/materials/:id/replace-file", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const itemRef = db().ref(`market_items/${safeText(req.params.id, 150)}`);
  const snap = await itemRef.once("value");
  if (!snap.exists()) fail("Материал табылган жок.", 404);
  const existing = snap.val() || {};
  if (existing.authorUid !== user.uid) fail("Бул материалдын файлын алмаштырууга уруксат жок.", 403);
  const storagePath = safeText(req.body?.storagePath, 500);
  const fileName = safeFilename(req.body?.fileName || "material");
  const file = await checkStorageFile(storagePath, `market_uploads/${user.uid}/`, MAX_MATERIAL_BYTES);
  const ext = extensionOf(fileName);
  const allowedMimes = materialMimeByExt.get(ext);
  if (!allowedMimes) fail("Файлдын кеңейтүүсү уруксат берилген эмес.");
  if (!allowedMimes.includes(file.mime)) fail("Файлдын форматы менен сакталган MIME түрү дал келбейт.");
  await itemRef.update({ storagePath: file.path, fileName, fileType: ext.replace(/^\./, ""), fileSize: file.size, contentType: file.mime, status: "published", updatedAt: now() });
  return { ok: true, message: "Файл купуя сактагычка жаңыртылып, материал кайра жарыяланды." };
}));

app.get("/api/teacher/payment-profile", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const snap = await db().ref(`users/${user.uid}/paymentProfile`).once("value");
  return { ok: true, profile: await signedProfile(snap.val() || {}) };
}));

app.post("/api/teacher/payment-profile", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const mbankQrPath = safeText(req.body?.mbankQrPath, 500);
  const obankQrPath = safeText(req.body?.obankQrPath, 500);
  const obalance = safeText(req.body?.obalance, 30).replace(/\s+/g, "");
  if (!validBalance(obalance)) fail("O!Balance номери туура эмес.");
  if (mbankQrPath && !isTeacherPath(user.uid, mbankQrPath)) fail("MBank QR башка папкага таандык.", 403);
  if (obankQrPath && !isTeacherPath(user.uid, obankQrPath)) fail("O!Bank QR башка папкага таандык.", 403);
  if (mbankQrPath) await checkStorageFile(mbankQrPath, `payment_qr/teachers/${user.uid}/`, MAX_QR_BYTES, ["image/jpeg", "image/png", "image/webp"]);
  if (obankQrPath) await checkStorageFile(obankQrPath, `payment_qr/teachers/${user.uid}/`, MAX_QR_BYTES, ["image/jpeg", "image/png", "image/webp"]);
  if (!mbankQrPath && !obankQrPath && !obalance) fail("Кеминде бир төлөм реквизитин толтуруңуз.");
  const profile = { mbankQrPath, obankQrPath, obalance, updatedAt: now() };
  await db().ref(`users/${user.uid}/paymentProfile`).set(profile);
  return { ok: true, profile: await signedProfile(profile), message: "Төлөм реквизиттери сакталды." };
}));

app.get("/api/admin/site-payment-profile", (req, res) => json(req, res, async () => {
  await adminUser(req);
  const snap = await db().ref("settings/sitePaymentProfile").once("value");
  return { ok: true, profile: await signedProfile(snap.val() || {}) };
}));
app.post("/api/admin/site-payment-profile", (req, res) => json(req, res, async () => {
  const admin = await adminUser(req);
  const mbankQrPath = safeText(req.body?.mbankQrPath, 500);
  const obankQrPath = safeText(req.body?.obankQrPath, 500);
  const obalance = safeText(req.body?.obalance, 30).replace(/\s+/g, "");
  if (!validBalance(obalance)) fail("Сайттын O!Balance номери туура эмес.");
  if (mbankQrPath && !mbankQrPath.startsWith("payment_qr/site/")) fail("Сайттын MBank QR жолу туура эмес.", 403);
  if (obankQrPath && !obankQrPath.startsWith("payment_qr/site/")) fail("Сайттын O!Bank QR жолу туура эмес.", 403);
  if (mbankQrPath) await checkStorageFile(mbankQrPath, "payment_qr/site/", MAX_QR_BYTES, ["image/jpeg", "image/png", "image/webp"]);
  if (obankQrPath) await checkStorageFile(obankQrPath, "payment_qr/site/", MAX_QR_BYTES, ["image/jpeg", "image/png", "image/webp"]);
  if (!mbankQrPath && !obankQrPath && !obalance) fail("Кеминде бир сайттык реквизитти толтуруңуз.");
  const profile = { mbankQrPath, obankQrPath, obalance, updatedAt: now(), updatedBy: admin.uid };
  await db().ref("settings/sitePaymentProfile").set(profile);
  return { ok: true, profile: await signedProfile(profile), message: "Bilimal.org реквизиттери сакталды." };
}));

app.post("/api/payments/create", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const productId = safeText(req.body?.productId, 150);
  const paymentMethod = safeText(req.body?.paymentMethod, 30);
  if (!["mbank", "obank", "obalance"].includes(paymentMethod)) fail("Төлөм ыкмасын тандаңыз.");
  const item = await getItem(productId);
  if (item.authorUid === user.uid) fail("Өз материалыңызды сатып ала албайсыз.", 409);
  if (!item.storagePath) fail("Бул материал эски тышкы шилтемеге таянат. Автор файлды Bilimal.org сактагычына кайра жүктөгөндөн кийин сатып алууга болот.", 409);
  const amount = money(item.price);
  if (amount <= 0) fail("Бул материал акысыз. Аны акысыз алуу баскычы аркылуу алыңыз.", 409);

  const orderId = newId("QR");
  const createdAt = now();
  const receiptDeadline = createdAt + ORDER_WINDOW_MS;
  const cycleRef = db().ref(`payment_cycles/${item.authorUid}`);
  let reservationError = "";
  let reservedCount = 0;
  const reservation = await cycleRef.transaction((current) => {
    const state = current || { successfulCount: 0 };
    if (state.pendingOrderId && (state.pendingStatus === "pending_review" || Number(state.pendingExpiresAt || 0) > createdAt)) {
      reservationError = "Бул мугалимдин башка төлөмү азыр күтүлүүдө же текшерилип жатат. Ал төлөм чечилгенден кийин кайра аракет кылыңыз.";
      return;
    }
    const count = Math.max(0, Number(state.successfulCount || 0));
    reservedCount = count + 1;
    return {
      ...state,
      successfulCount: count,
      pendingOrderId: orderId,
      pendingSaleNumber: reservedCount,
      pendingStatus: "awaiting_receipt",
      pendingExpiresAt: receiptDeadline,
      updatedAt: createdAt
    };
  });
  if (!reservation.committed || reservationError) fail(reservationError || "Сатуу кезегин резерв кылуу мүмкүн болгон жок. Кайра аракет кылыңыз.", 409);
  const cycleState = reservation.snapshot.val() || {};
  const saleNumber = Number(cycleState.pendingSaleNumber || reservedCount || (Number(cycleState.successfulCount || 0) + 1));
  const target = expectedTarget(saleNumber);

  try {
    const methods = await paymentSnapshotForTarget(target, item.authorUid, receiptDeadline);
    const chosenAvailable = paymentMethod === "mbank" ? Boolean(methods.mbankQrPath && methods.mbankQr) : paymentMethod === "obank" ? Boolean(methods.obankQrPath && methods.obankQr) : Boolean(methods.obalance);
    if (!chosenAvailable) fail("Тандалган төлөм ыкмасы бул алуучуда жок. Башка ыкманы тандаңыз.", 409);
    const teacherName = await safeDisplayName(item.authorUid, item.authorEmail || "");
    const order = {
      orderId,
      buyerUid: user.uid,
      buyerEmail: user.email || "",
      teacherUid: item.authorUid,
      teacherName,
      productId,
      productTitle: safeText(item.title, 200),
      amount,
      saleNumber,
      target,
      paymentMethod,
      paymentMethods: methods,
      storagePath: item.storagePath,
      fileName: item.fileName,
      status: "awaiting_receipt",
      createdAt,
      updatedAt: createdAt,
      receiptDeadline
    };
    await db().ref(`payment_orders/${orderId}`).set(order);
    await db().ref(`users/${user.uid}/purchases/${orderId}`).set({
      productId, title: item.title, orderId, status: "awaiting_receipt",
      createdAt, price: amount, teacherUid: item.authorUid, target, saleNumber
    });
    return { ok: true, order: await orderWithRefresh(order), message: "Заказ түзүлдү. Көрсөтүлгөн алуучуга гана төлөңүз." };
  } catch (error) {
    await clearReservation(item.authorUid, orderId);
    throw error;
  }
}));

app.post("/api/purchases/free", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const productId = safeText(req.body?.productId, 150);
  const item = await getItem(productId);
  if (item.authorUid === user.uid) fail("Өз материалыңызды акысыз алуу мүмкүн эмес.", 409);
  if (money(item.price) !== 0) fail("Бул материал акысыз эмес.", 409);
  const orderId = newId("FREE");
  const purchasedAt = now();
  const expiresAt = purchasedAt + ACCESS_DURATION_MS;
  const purchase = {
    productId, title: item.title, orderId, status: "approved", price: 0,
    createdAt: purchasedAt, purchasedAt, expiresAt,
    teacherUid: item.authorUid, storagePath: item.storagePath,
    fileName: item.fileName, accessDays: 3, free: true
  };
  await db().ref(`users/${user.uid}/purchases/${orderId}`).set(purchase);
  return { ok: true, orderId, expiresAt, message: "Акысыз материалга 72 сааттык уруксат берилди." };
}));

app.post("/api/payments/receipt", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const orderId = safeText(req.body?.orderId, 100);
  const transactionId = safeText(req.body?.transactionId, 120);
  const transferTime = Number(req.body?.transferTime);
  const receiptStoragePath = safeText(req.body?.receiptStoragePath, 500);
  if (!orderId || !transactionId || !transferTime || !receiptStoragePath) fail("Заказ, транзакция ID, төлөм убактысы жана чек сүрөтү талап кылынат.");
  const age = now() - transferTime;
  if (age > RECEIPT_MAX_AGE_MS) fail("Төлөм чегинин убактысы 2 сааттан эски. Жаңы чек жүктөңүз.");
  if (age < -2 * 60 * 1000) fail("Төлөм убактысы келечекте көрсөтүлгөн. Датаны текшериңиз.");
  const orderRef = db().ref(`payment_orders/${orderId}`);
  const orderSnap = await orderRef.once("value");
  if (!orderSnap.exists()) fail("Заказ табылган жок.", 404);
  const order = orderSnap.val();
  if (order.buyerUid !== user.uid) fail("Бул заказ сизге тиешелүү эмес.", 403);
  if (order.status === "pending_review" && order.transactionId === transactionId) return { ok: true, status: "pending_review", message: "Бул чек мурда кабыл алынган жана текшерилүүдө." };
  if (order.status !== "awaiting_receipt") fail("Бул заказга чек мурда жөнөтүлгөн же заказ жабылган.", 409);
  if (now() > Number(order.receiptDeadline || 0)) {
    await orderRef.update({ status: "expired", updatedAt: now() });
    await clearReservation(order.teacherUid, orderId);
    fail("Заказдын төлөм мөөнөтү бүттү. Жаңы заказ түзүңүз.", 409);
  }
  const receipt = await checkStorageFile(receiptStoragePath, `payment_receipts/${user.uid}/${orderId}/`, MAX_RECEIPT_BYTES, ["image/jpeg", "image/png", "image/webp"]);
  const [buffer] = await receipt.file.download();
  const receiptHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const transactionHash = crypto.createHash("sha256").update(transactionId.toLowerCase().trim()).digest("hex");
  const transactionRef = db().ref(`used_transactions/${transactionHash}`);
  const transactionReserve = await transactionRef.transaction((current) => {
    if (current && current.orderId !== orderId) return;
    return { orderId, createdAt: now() };
  });
  if (!transactionReserve.committed) fail("Бул транзакция ID мурда башка заказда колдонулган.", 409);
  const receiptRef = db().ref(`used_receipts/${receiptHash}`);
  const receiptReserve = await receiptRef.transaction((current) => {
    if (current && current.orderId !== orderId) return;
    return { orderId, createdAt: now() };
  });
  if (!receiptReserve.committed) fail("Бул чек сүрөтү мурда башка заказда колдонулган.", 409);
  await orderRef.update({
    status: "pending_review", transactionId, transactionHash, receiptHash,
    receiptStoragePath, transferTime, receiptSubmittedAt: now(), updatedAt: now(),
    receiptNote: "Чек администратор тарабынан текшерилиши керек. OCR же жүктөлгөн сүрөт банктык API тастыктоосун алмаштырбайт."
  });
  await db().ref(`users/${user.uid}/purchases/${orderId}`).update({ status: "pending_review", transactionId, updatedAt: now() });
  await db().ref(`payment_cycles/${order.teacherUid}`).transaction((current) => {
    if (!current || current.pendingOrderId !== orderId) return;
    return { ...current, pendingStatus: "pending_review", pendingExpiresAt: 0, updatedAt: now() };
  });
  return { ok: true, status: "pending_review", message: "Чек кабыл алынды. Төлөм администратор тарабынан текшерилет; бул автоматтык банктык тастыктоо эмес." };
}));

app.get("/api/payments/status", (req, res) => json(req, res, async () => {
  const user = await bearerUser(req);
  const orderId = safeText(req.query.orderId, 100);
  const order = await verifyOrderOwner(orderId, user.uid);
  if (order.status === "awaiting_receipt" && now() > Number(order.receiptDeadline || 0)) {
    await db().ref(`payment_orders/${orderId}`).update({ status: "expired", updatedAt: now() });
    await clearReservation(order.teacherUid, orderId);
    return { ok: true, orderId, status: "expired", message: "Заказдын төлөм мөөнөтү бүттү." };
  }
  const active = order.status === "approved" && Number(order.expiresAt || 0) > now();
  return {
    ok: true, orderId,
    status: order.status === "approved" && !active ? "expired" : order.status,
    expiresAt: order.expiresAt || null,
    accessDays: active ? 3 : null,
    message: active ? "Төлөм тастыкталды. Материалга 72 сааттык уруксат берилди." : order.status === "pending_review" ? "Чек администратор тарабынан текшерилүүдө." : order.status === "rejected" ? (order.reviewNote || "Төлөм четке кагылды.") : order.status === "approved" ? "Материалга жеткиликтүүлүк мөөнөтү аяктады." : order.status === "expired" ? "Заказдын мөөнөтү бүттү." : "Төлөм күтүлүүдө."
  };
}));

app.get("/api/admin/payments", (req, res) => json(req, res, async () => {
  await adminUser(req);
  const snap = await db().ref("payment_orders").once("value");
  const items = [];
  for (const [orderId, orderRaw] of Object.entries(snap.val() || {})) {
    const order = orderRaw || {};
    if (!["pending_review", "awaiting_receipt"].includes(order.status)) continue;
    const receiptUrl = order.receiptStoragePath ? await signedUrl(order.receiptStoragePath, "read", now() + SIGNED_VIEW_MS) : "";
    items.push({
      orderId, productId: order.productId, productTitle: order.productTitle,
      amount: money(order.amount), target: order.target, cycleIndex: Number(order.saleNumber || order.cycleIndex || 0),
      teacherUid: order.teacherUid, buyerEmail: order.buyerEmail || "", buyerUid: order.buyerUid,
      status: order.status, transactionId: order.transactionId || "", transferTime: order.transferTime || null,
      createdAt: order.createdAt, receiptUrl, receiptNote: order.receiptNote || ""
    });
  }
  items.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  return { ok: true, items };
}));

app.post("/api/admin/payments/:id/approve", (req, res) => json(req, res, async () => {
  const admin = await adminUser(req);
  const orderId = safeText(req.params.id, 100);
  const orderRef = db().ref(`payment_orders/${orderId}`);
  const snap = await orderRef.once("value");
  if (!snap.exists()) fail("Заказ табылган жок.", 404);
  const order = snap.val();
  if (order.status === "approved") return { ok: true, expiresAt: order.expiresAt, message: "Бул заказ мурда эле бекитилген." };
  if (order.status !== "pending_review") fail("Бул төлөм администратордун текшерүү кезегинде эмес.", 409);
  if (!order.teacherUid || !order.buyerUid || !order.productId) fail("Заказ маалыматы толук эмес.", 409);
  const cycleRef = db().ref(`payment_cycles/${order.teacherUid}`);
  let conflict = false;
  const cycleResult = await cycleRef.transaction((current) => {
    const state = current || { successfulCount: 0 };
    const count = Math.max(0, Number(state.successfulCount || 0));
    const saleNumber = Number(order.saleNumber || order.cycleIndex || 0);
    if (count === saleNumber && state.lastOrderId === orderId) return state;
    if (state.pendingOrderId !== orderId || count + 1 !== saleNumber || expectedTarget(saleNumber) !== order.target) {
      conflict = true;
      return;
    }
    return { ...state, successfulCount: count + 1, pendingOrderId: null, pendingSaleNumber: null, pendingExpiresAt: 0, lastOrderId: orderId, updatedAt: now() };
  });
  if (!cycleResult.committed || conflict) fail("Сатуу кезегинин маалыматы дал келбеди. Заказды өзгөртпөстөн текшерип чыгыңыз.", 409);
  const approvedAt = now();
  const expiresAt = approvedAt + ACCESS_DURATION_MS;
  const item = await getItem(order.productId, true);
  const sale = {
    orderId, productId: order.productId, title: order.productTitle,
    amount: money(order.amount), buyerUid: order.buyerUid, teacherUid: order.teacherUid,
    saleNumber: Number(order.saleNumber || order.cycleIndex), target: order.target,
    recipientType: order.target, approvedAt, approvedBy: admin.uid,
    transactionId: order.transactionId || "", paymentMethod: order.paymentMethod || "QR"
  };
  const updates = {};
  updates[`payment_orders/${orderId}/status`] = "approved";
  updates[`payment_orders/${orderId}/approvedAt`] = approvedAt;
  updates[`payment_orders/${orderId}/expiresAt`] = expiresAt;
  updates[`payment_orders/${orderId}/reviewedBy`] = admin.uid;
  updates[`payment_orders/${orderId}/updatedAt`] = approvedAt;
  updates[`users/${order.buyerUid}/purchases/${orderId}`] = {
    orderId, productId: order.productId, title: order.productTitle,
    price: money(order.amount), status: "approved", createdAt: order.createdAt,
    purchasedAt: approvedAt, expiresAt, teacherUid: order.teacherUid,
    target: order.target, saleNumber: Number(order.saleNumber || order.cycleIndex),
    storagePath: item.storagePath, fileName: item.fileName, accessDays: 3
  };
  updates[`teacher_sales/${order.teacherUid}/${orderId}`] = sale;
  if (order.target === "site") updates[`site_qr_sales/${orderId}`] = sale;
  updates[`admin_audit/${newId("AUDIT")}`] = { action: "payment_approved", orderId, adminUid: admin.uid, at: approvedAt };
  await db().ref().update(updates);
  return { ok: true, expiresAt, saleNumber: sale.saleNumber, target: order.target, message: "Төлөм бекитилди. Материалга 72 сааттык жеткиликтүүлүк берилди." };
}));

app.post("/api/admin/payments/:id/reject", (req, res) => json(req, res, async () => {
  const admin = await adminUser(req);
  const orderId = safeText(req.params.id, 100);
  const orderRef = db().ref(`payment_orders/${orderId}`);
  const snap = await orderRef.once("value");
  if (!snap.exists()) fail("Заказ табылган жок.", 404);
  const order = snap.val();
  if (order.status !== "pending_review" && order.status !== "awaiting_receipt") fail("Бул заказды четке кагууга болбойт.", 409);
  const note = safeText(req.body?.note || "Төлөм далили тастыкталган жок.", 500);
  await orderRef.update({ status: "rejected", reviewNote: note, reviewedAt: now(), reviewedBy: admin.uid, updatedAt: now() });
  await db().ref(`users/${order.buyerUid}/purchases/${orderId}`).update({ status: "rejected", reviewNote: note, updatedAt: now() });
  await clearReservation(order.teacherUid, orderId);
  await db().ref(`admin_audit/${newId("AUDIT")}`).set({ action: "payment_rejected", orderId, adminUid: admin.uid, at: now(), note });
  return { ok: true, message: "Төлөм четке кагылды. Бул заказ сатуу катары эсептелген жок." };
}));

app.get("/api/materials/:id/download", async (req, res) => {
  try {
    const user = await bearerUser(req);
    const productId = safeText(req.params.id, 150);
    const orderId = safeText(req.query.orderId, 100);
    if (!orderId) fail("Жүктөө үчүн сатып алуу заказ ID'и керек.");
    let purchaseSnap = await db().ref(`users/${user.uid}/purchases/${orderId}`).once("value");
    let purchase = purchaseSnap.exists() ? (purchaseSnap.val() || {}) : null;
    if (!purchase) {
      const legacySnap = await db().ref(`users/${user.uid}/purchases/${productId}`).once("value");
      const legacy = legacySnap.val() || null;
      if (legacy && String(legacy.orderId || "") === orderId) purchase = legacy;
    }
    if (!purchase) fail("Бул материал үчүн сатып алуу укугу табылган жок.", 403);
    if (String(purchase.productId || productId) !== productId) fail("Заказ башка материалга тиешелүү.", 403);
    if (purchase.status !== "approved") fail("Төлөм тастыктала элек.", 403);
    if (Number(purchase.expiresAt || 0) <= now()) fail("72 сааттык жеткиликтүүлүк мөөнөтү аяктады.", 403);
    const item = await getItem(productId, true);
    const storagePath = purchase.storagePath || item.storagePath;
    if (!storagePath || !storagePath.startsWith("market_uploads/")) fail("Материалдын файлынын жолу туура эмес.", 404);
    const file = storage().file(storagePath);
    const [metadata] = await file.getMetadata();
    const fileName = safeFilename(purchase.fileName || item.fileName || "material");
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
    res.setHeader("Content-Type", normalizeMime(metadata.contentType) || "application/octet-stream");
    res.setHeader("Content-Length", String(metadata.size || ""));
    res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    file.createReadStream().on("error", (error) => {
      console.error("Storage download stream error:", error?.message || error);
      if (!res.headersSent) res.status(500).json({ ok: false, message: "Файлды берүүдө ката кетти." });
      else res.destroy(error);
    }).pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(error.status || 500).json({ ok: false, message: error.status ? error.message : "Серверде ката кетти." });
    if (!error.status) console.error(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ ok: false, message: `API маршрут табылган жок: ${req.method} ${req.path}` });
});

export default app;
