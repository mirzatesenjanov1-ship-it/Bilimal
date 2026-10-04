import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { XMLParser } from 'fast-xml-parser';

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

/* =========================================================
   ENVIRONMENT & FIREBASE INIT
========================================================= */
const env = process.env;
const requiredEnv = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_DATABASE_URL',
  'FREEDOMPAY_MERCHANT_ID',
  'FREEDOMPAY_SECRET_RECEIVE',
  'FREEDOMPAY_SECRET_PAYOUT'
];

const missingEnv = requiredEnv.filter((key) => !env[key]);
let firebaseReady = false;

if (!missingEnv.length) {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      databaseURL: env.FIREBASE_DATABASE_URL
    });
  }
  firebaseReady = true;
}

/* =========================================================
   CONSTANTS
========================================================= */
const COMMISSION_RATE = 0.21;
const AUTHOR_RATE = 0.79;
const ACCESS_DAYS = 365;
const MIN_WITHDRAWAL = 100;
const BONUS_EVERY = 6;

/* =========================================================
   FIREBASE & GENERAL HELPERS
========================================================= */
function db() {
  if (!firebaseReady) fail('Firebase backend конфигурациясы толук эмес.', 503);
  return getDatabase();
}

function auth() {
  if (!firebaseReady) fail('Firebase backend конфигурациясы толук эмес.', 503);
  return getAuth();
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function now() { return Date.now(); }
function money(val) { return Math.round((Number(val) || 0) * 100) / 100; }
function salt() { return crypto.randomBytes(12).toString('hex'); }

function orderId(prefix = 'BL') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

function numericUserId(uid) {
  return (
    String(
      parseInt(
        crypto.createHash('sha256').update(uid).digest('hex').slice(0, 12),
        16
      ) % 900000000
    ) + 100000000
  );
}

function baseUrl() { return (env.FREEDOMPAY_BASE_URL || 'https://api.freedompay.kg').replace(/\/$/, ''); }
function siteUrl() { return (env.PUBLIC_SITE_URL || 'https://bilimal.org').replace(/\/$/, ''); }
function apiUrl() { return (env.PUBLIC_API_URL || '').replace(/\/$/, ''); }

/* =========================================================
   FREEDOMPAY SIGNATURE & XML PARSER
========================================================= */
function signature(script, fields, secret) {
  const values = Object.keys(fields)
    .filter((key) => key !== 'pg_sig')
    .sort()
    .map((key) => (fields[key] == null ? '' : String(fields[key])));

  return crypto
    .createHash('md5')
    .update([script, ...values, secret].join(';'))
    .digest('hex');
}

function verifySignature(script, fields, secret) {
  if (!fields.pg_sig || !fields.pg_salt) return false;
  const expected = signature(script, fields, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(String(fields.pg_sig))
    );
  } catch {
    return false;
  }
}

const xmlParser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
function parseXml(text) {
  const parsed = xmlParser.parse(text || '');
  return parsed.response || parsed.root || parsed || {};
}

async function fpPost(path, fields) {
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, String(value));
  });

  const response = await fetch(baseUrl() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20000)
  });

  const text = await response.text();
  if (!response.ok) fail(`FreedomPay HTTP ${response.status}`, 502);
  return parseXml(text);
}

async function verifiedFpPost(script, path, fields, secret) {
  const payload = { ...fields, pg_salt: fields.pg_salt || salt() };
  payload.pg_sig = signature(script, payload, secret);
  
  const response = await fpPost(path, payload);
  if (response.pg_sig && response.pg_salt && !verifySignature(script, response, secret)) {
    fail('FreedomPay серверинин кол тамгасы туура эмес.', 502);
  }
  return response;
}

/* =========================================================
   AUTH MIDDLEWARES
========================================================= */
async function bearerUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) fail('Авторизация талап кылынат.', 401);
  const token = header.slice(7);
  try {
    return await auth().verifyIdToken(token);
  } catch {
    fail('Firebase токени жараксыз же мөөнөтү бүткөн.', 401);
  }
}

async function adminUser(req) {
  const decoded = await bearerUser(req);
  const snapshot = await db().ref(`users/${decoded.uid}`).once('value');
  const user = snapshot.val() || {};
  const isAdmin = user.isAdmin === true || ['admin', 'superadmin'].includes(String(user.role || '').toLowerCase());
  if (!isAdmin) fail('Администратор уруксаты керек.', 403);
  return decoded;
}

async function json(req, res, fn) {
  try {
    const result = await fn();
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || 'Серверде ката чыкты.'
    });
  }
}

/* =========================================================
   ROUTES
========================================================= */
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'bilimal-market-api',
    firebaseReady,
    configured: missingEnv.length === 0,
    missing: missingEnv
  });
});

/* Create Material */
app.post('/api/materials', (req, res) =>
  json(req, res, async () => {
    const user = await bearerUser(req);
    const { title, subject, type, price, fileUrl, description } = req.body || {};

    if (!title || !subject || !type || !fileUrl) {
      fail('Материалдын аталышы, предмети, түрү жана шилтемеси милдеттүү.');
    }
    if (!/^https?:\/\//i.test(String(fileUrl))) {
      fail('Материалдын шилтемеси http/https болушу керек.');
    }

    let cleanPrice = money(price);
    if (cleanPrice < 0 || cleanPrice > 100000) fail('Материалдын баасы туура эмес.');

    const itemsSnapshot = await db().ref('market_items').once('value');
    let count = 0;
    itemsSnapshot.forEach((child) => {
      if (child.val()?.authorUid === user.uid) count++;
    });

    const isBonus = (count + 1) % BONUS_EVERY === 0;
    if (isBonus) cleanPrice = 0;

    const id = db().ref('market_items').push().key;
    const timestamp = now();
    const item = {
      id,
      title: String(title).trim().slice(0, 200),
      subject: String(subject).trim(),
      type: String(type).trim(),
      price: cleanPrice,
      fileUrl: String(fileUrl).trim(),
      description: String(description || '').trim().slice(0, 1000),
      authorUid: user.uid,
      authorEmail: user.email || '',
      status: 'published',
      commissionRate: COMMISSION_RATE,
      authorRate: AUTHOR_RATE,
      createdAt: timestamp,
      updatedAt: timestamp,
      bonusFree: isBonus
    };

    await db().ref(`market_items/${id}`).set(item);
    return { ok: true, id, price: cleanPrice, bonusFree: isBonus };
  })
);

/* Create Payment */
app.post('/api/payments/create', (req, res) =>
  json(req, res, async () => {
    const user = await bearerUser(req);
    const productId = String(req.body?.productId || '');
    if (!productId) fail('productId керек.');

    const itemSnapshot = await db().ref(`market_items/${productId}`).once('value');
    if (!itemSnapshot.exists()) fail('Материал табылган жок.', 404);
    const item = itemSnapshot.val();

    if (String(item.status || 'published') !== 'published') fail('Бул материал сатылбайт.');
    const amount = money(item.price);
    if (amount <= 0) fail('Бул материал акысыз.');
    if (item.authorUid === user.uid) fail('Өз материалыңызды сатып алуу мүмкүн эмес.');

    const order = orderId('BL');
    const resultUrl = `${apiUrl()}${env.FREEDOMPAY_RESULT_PATH || '/api/webhooks/freedompay/result'}`;
    const successUrl = `${siteUrl()}/sections/lesson-plans.html?payment=success&order=${encodeURIComponent(order)}`;
    const failureUrl = `${siteUrl()}/sections/lesson-plans.html?payment=failure&order=${encodeURIComponent(order)}`;

    const fields = {
      pg_order_id: order,
      pg_merchant_id: env.FREEDOMPAY_MERCHANT_ID,
      pg_amount: amount,
      pg_description: `Bilimal: ${String(item.title).slice(0, 120)}`,
      pg_currency: 'KGS',
      pg_user_id: user.uid,
      pg_user_email: user.email || '',
      pg_result_url: resultUrl,
      pg_success_url: successUrl,
      pg_failure_url: failureUrl,
      pg_request_method: 'POST',
      pg_param1: productId
    };

    if (env.FREEDOMPAY_TESTING_MODE === '1') fields.pg_testing_mode = 1;

    const response = await verifiedFpPost('init_payment.php', '/init_payment.php', fields, env.FREEDOMPAY_SECRET_RECEIVE);

    if (response.pg_status !== 'ok' || !response.pg_redirect_url) {
      fail(response.pg_error_description || 'FreedomPay төлөм барагын түзө алган жок.', 502);
    }

    const createdAt = now();
    const expiresAt = createdAt + ACCESS_DAYS * 86400000;
    const siteShare = money(amount * COMMISSION_RATE);
    const teacherShare = money(amount * AUTHOR_RATE);

    const application = {
      orderId: order,
      buyerUid: user.uid,
      buyerEmail: user.email || '',
      teacherUid: item.authorUid,
      teacherEmail: item.authorEmail || '',
      productId,
      productTitle: item.title,
      price: amount,
      siteShare,
      teacherShare,
      commissionRate: COMMISSION_RATE,
      authorRate: AUTHOR_RATE,
      status: 'pending_payment',
      paymentMethod: 'FreedomPay',
      freedomPayPaymentId: response.pg_payment_id || null,
      createdAt,
      expiresAt
    };

    await db().ref(`payment_orders/${order}`).set(application);
    return { ok: true, orderId: order, redirectUrl: response.pg_redirect_url };
  })
);

/* Finalize Payment Internal Logic */
async function finalizePayment(fields) {
  const orderIdValue = String(fields.pg_order_id || '');
  if (!orderIdValue) fail('order_id жок.', 400);

  const orderSnapshot = await db().ref(`payment_orders/${orderIdValue}`).once('value');
  if (!orderSnapshot.exists()) fail('Заказ табылган жок.', 404);
  const order = orderSnapshot.val();

  if (verifySignature('result', fields, env.FREEDOMPAY_SECRET_RECEIVE) === false) {
    fail('FreedomPay кол тамгасы туура эмес.', 403);
  }

  if (order.status === 'paid') return true;

  const ledgerRef = db().ref(`ledger/sales/${orderIdValue}`);
  let isFirstTimePaid = false;

  const ledgerTx = await ledgerRef.transaction((current) => {
    if (current) return; 
    isFirstTimePaid = true;
    return {
      orderId: orderIdValue,
      authorUid: order.teacherUid,
      gross: money(order.price),
      authorShare: money(order.teacherShare),
      commission: money(order.siteShare),
      createdAt: now()
    };
  });

  if (ledgerTx.committed && isFirstTimePaid) {
    const timestamp = now();
    const expiresAt = timestamp + ACCESS_DAYS * 86400000;

    await db().ref(`users/${order.teacherUid}/balance`).transaction((val) => money(val) + money(order.teacherShare));
    await db().ref('platform_balance').transaction((val) => money(val) + money(order.siteShare));

    const materialSnap = await db().ref(`market_items/${order.productId}/fileUrl`).once('value');

    const updates = {};
    updates[`payment_orders/${orderIdValue}/status`] = 'paid';
    updates[`payment_orders/${orderIdValue}/paidAt`] = timestamp;
    updates[`users/${order.buyerUid}/purchases/${order.productId}`] = {
      orderId: orderIdValue,
      productId: order.productId,
      title: order.productTitle,
      fileUrl: materialSnap.val() || '',
      sellerUid: order.teacherUid,
      price: order.price,
      status: 'approved',
      approvedAt: timestamp,
      expiresAt
    };

    await db().ref().update(updates);
  }
  return true;
}

/* FreedomPay Result Webhook */
app.post('/api/webhooks/freedompay/result', async (req, res) => {
  try {
    await finalizePayment(req.body || {});
    res.status(200).type('application/xml').send('<response><pg_status>ok</pg_status><pg_description>Заказ ийгиликтүү иштетилди</pg_description></response>');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).type('application/xml').send(`<response><pg_status>error</pg_status><pg_description>${error.message}</pg_description></response>`);
  }
});

/* Create Withdrawal */
app.post('/api/withdrawals/create', (req, res) =>
  json(req, res, async () => {
    const user = await bearerUser(req);
    const amount = money(req.body?.amount);
    if (amount < MIN_WITHDRAWAL) fail(`Минималдуу чыгаруу ${MIN_WITHDRAWAL} сом.`);

    const cardSnapshot = await db().ref(`users/${user.uid}/payoutCard`).once('value');
    if (!cardSnapshot.exists() || !cardSnapshot.val().token) {
      fail('Алгач коопсуз payout картасын кошуңуз.');
    }

    const balanceRef = db().ref(`users/${user.uid}/balance`);
    let reserved = false;

    await balanceRef.transaction((val) => {
      const current = money(val);
      if (current < amount) return;
      reserved = true;
      return money(current - amount);
    });

    if (!reserved) fail('Баланс жетишсиз.', 409);

    await db().ref(`users/${user.uid}/withdrawalReserved`).transaction((val) => money(val) + amount);

    const id = orderId('WD');
    await db().ref(`withdrawal_requests/${id}`).set({
      id,
      uid: user.uid,
      email: user.email || '',
      amount,
      status: 'pending',
      cardToken: cardSnapshot.val().token,
      createdAt: now()
    });

    return { ok: true, id, amount };
  })
);

app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'API маршруту табылган жок.' });
});

export default app;
