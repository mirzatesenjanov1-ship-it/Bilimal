import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { XMLParser } from 'fast-xml-parser';

const app = express();
app.set('trust proxy', 1);

// CORS конфигурациясы бардык сурамдарга ачылды
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
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
   HELPERS & UTILS
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

async function verifiedFpPost(script, path, fields, secret) {
  const payload = { ...fields, pg_salt: fields.pg_salt || salt() };
  payload.pg_sig = signature(script, payload, secret);

  const body = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.append(k, String(v));
  });

  const baseUrl = (env.FREEDOMPAY_BASE_URL || 'https://api.freedompay.kg').replace(/\/$/, '');
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20000)
  });

  const text = await response.text();
  if (!response.ok) fail(`FreedomPay HTTP ${response.status}`, 502);

  const parsed = parseXml(text);
  if (parsed.pg_sig && parsed.pg_salt && !verifySignature(script, parsed, secret)) {
    fail('FreedomPay серверинин кол тамгасы туура эмес.', 502);
  }
  return parsed;
}

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
   ROUTES & ENDPOINTS
========================================================= */

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'bilimal-market-api',
    firebaseReady,
    configured: missingEnv.length === 0
  });
});

/* Payout Картасын Кошуу Endpoint (FreedomPay Card Add Init) */
app.post('/api/payouts/add-card', (req, res) =>
  json(req, res, async () => {
    const user = await bearerUser(req);

    const apiUrl = (env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const siteUrl = (env.PUBLIC_SITE_URL || 'https://bilimal.org').replace(/\/$/, '');

    const cardPostPath = env.FREEDOMPAY_CARD_POST_PATH || '/api/webhooks/freedompay/card';
    const postUrl = `${apiUrl}${cardPostPath}`;
    const backUrl = `${siteUrl}/sections/teacher-market.html?card=added`;

    const fields = {
      pg_merchant_id: env.FREEDOMPAY_MERCHANT_ID,
      pg_user_id: user.uid,
      pg_post_link: postUrl,
      pg_back_link: backUrl,
      pg_request_method: 'POST'
    };

    if (env.FREEDOMPAY_TESTING_MODE === '1') fields.pg_testing_mode = 1;

    const response = await verifiedFpPost(
      'card_add_init',
      '/card_add_init.php',
      fields,
      env.FREEDOMPAY_SECRET_PAYOUT
    );

    if (response.pg_status !== 'ok' || !response.pg_redirect_url) {
      fail(response.pg_error_description || 'FreedomPay карта кошуу баракчасын ача алган жок.', 502);
    }

    return { ok: true, redirectUrl: response.pg_redirect_url };
  })
);

/* FreedomPay Card Add Webhook (Callback) */
app.post('/api/webhooks/freedompay/card', async (req, res) => {
  try {
    const fields = req.body || {};
    if (verifySignature('card', fields, env.FREEDOMPAY_SECRET_PAYOUT) === false) {
      fail('FreedomPay кол тамгасы туура эмес.', 403);
    }

    const uid = fields.pg_user_id;
    const cardToken = fields.pg_card_token || fields.pg_card_id;
    const maskedPan = fields.pg_card_pan || fields.pg_card_masked_pan || '**** ****';

    if (uid && cardToken) {
      await db().ref(`users/${uid}/payoutCard`).set({
        token: cardToken,
        maskedPan,
        updatedAt: now()
      });
    }

    res.status(200).type('application/xml').send('<response><pg_status>ok</pg_status></response>');
  } catch (error) {
    console.error('Card Webhook Error:', error);
    res.status(200).type('application/xml').send(`<response><pg_status>error</pg_status><pg_description>${error.message}</pg_description></response>`);
  }
});

app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'API маршруту табылган жок.' });
});

export default app;
