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
   ENVIRONMENT
========================================================= */

const env = process.env;

const required = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_DATABASE_URL',
  'FREEDOMPAY_MERCHANT_ID',
  'FREEDOMPAY_SECRET_RECEIVE',
  'FREEDOMPAY_SECRET_PAYOUT'
];

const missing = required.filter((key) => !env[key]);

let firebaseReady = false;

if (!missing.length) {
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
   FIREBASE HELPERS
========================================================= */

function db() {
  if (!firebaseReady) {
    throw new Error('Firebase backend конфигурациясы толук эмес.');
  }

  return getDatabase();
}

function auth() {
  if (!firebaseReady) {
    throw new Error('Firebase backend конфигурациясы толук эмес.');
  }

  return getAuth();
}

/* =========================================================
   GENERAL HELPERS
========================================================= */

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

function salt() {
  return crypto.randomBytes(12).toString('hex');
}

function orderId(prefix = 'BL') {
  return `${prefix}_${Date.now()}_${crypto
    .randomBytes(5)
    .toString('hex')
    .toUpperCase()}`;
}

function numericUserId(uid) {
  return (
    String(
      parseInt(
        crypto
          .createHash('sha256')
          .update(uid)
          .digest('hex')
          .slice(0, 12),
        16
      ) % 900000000
    ) + 100000000
  );
}

/* =========================================================
   URL HELPERS
========================================================= */

function baseUrl() {
  return (
    env.FREEDOMPAY_BASE_URL || 'https://api.freedompay.kg'
  ).replace(/\/$/, '');
}

function siteUrl() {
  return (
    env.PUBLIC_SITE_URL || 'https://bilimal.org'
  ).replace(/\/$/, '');
}

function apiUrl() {
  return (env.PUBLIC_API_URL || '').replace(/\/$/, '');
}

/* =========================================================
   FREEDOMPAY SIGNATURE
========================================================= */

function signature(script, fields, secret) {
  const values = Object.keys(fields)
    .filter((key) => key !== 'pg_sig')
    .sort()
    .map((key) => {
      return fields[key] == null ? '' : String(fields[key]);
    });

  return crypto
    .createHash('md5')
    .update([script, ...values, secret].join(';'))
    .digest('hex');
}

function verifySignature(script, fields, secret) {
  if (!fields.pg_sig || !fields.pg_salt) {
    return false;
  }

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

/* =========================================================
   XML PARSER
========================================================= */

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true
});

function parseXml(text) {
  const parsed = xmlParser.parse(text || '');

  const root =
    parsed.response ||
    parsed.root ||
    parsed;

  return root || {};
}

/* =========================================================
   FREEDOMPAY HTTP
========================================================= */

async function fpPost(path, fields) {
  const body = new URLSearchParams();

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      body.append(key, String(value));
    }
  });

  const response = await fetch(
    baseUrl() + path,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded'
      },
      body,
      signal: AbortSignal.timeout(20000)
    }
  );

  const text = await response.text();

  if (!response.ok) {
    fail(`FreedomPay HTTP ${response.status}`, 502);
  }

  return parseXml(text);
}

async function verifiedFpPost(
  script,
  path,
  fields,
  secret
) {
  const payload = {
    ...fields,
    pg_salt: fields.pg_salt || salt()
  };

  payload.pg_sig = signature(
    script,
    payload,
    secret
  );

  const response = await fpPost(
    path,
    payload
  );

  if (
    response.pg_sig &&
    response.pg_salt &&
    !verifySignature(
      script,
      response,
      secret
    )
  ) {
    fail(
      'FreedomPay серверинин кол тамгасы туура эмес.',
      502
    );
  }

  return response;
}

/* =========================================================
   AUTHENTICATION
========================================================= */

async function bearerUser(req) {
  if (!firebaseReady) {
    fail(
      'Backend Firebase конфигурациясы толук эмес.',
      503
    );
  }

  const header =
    req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    fail(
      'Авторизация талап кылынат.',
      401
    );
  }

  const token = header.slice(7);

  try {
    return await auth().verifyIdToken(token);
  } catch {
    fail(
      'Firebase токени жараксыз же мөөнөтү бүткөн.',
      401
    );
  }
}

async function adminUser(req) {
  const decoded = await bearerUser(req);

  const snapshot = await db()
    .ref(`users/${decoded.uid}`)
    .once('value');

  const user = snapshot.val() || {};

  const isAdmin =
    user.isAdmin === true ||
    [
      'admin',
      'superadmin',
      'administrator'
    ].includes(
      String(user.role || '').toLowerCase()
    );

  if (!isAdmin) {
    fail(
      'Администратор уруксаты керек.',
      403
    );
  }

  return decoded;
}

/* =========================================================
   ERROR WRAPPER
========================================================= */

async function json(req, res, fn) {
  try {
    const result = await fn();

    res.status(200).json(result);
  } catch (error) {
    console.error(error);

    res
      .status(error.status || 500)
      .json({
        ok: false,
        message:
          error.message ||
          'Сервер катасы.'
      });
  }
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'bilimal-market-api',
    firebaseReady,
    configured:
      missing.length === 0,
    missing
  });
});

/* =========================================================
   CREATE MATERIAL
========================================================= */

app.post(
  '/api/materials',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const {
        title,
        subject,
        type,
        price,
        fileUrl,
        description
      } = req.body || {};

      if (
        !title ||
        !subject ||
        !type ||
        !fileUrl
      ) {
        fail(
          'Материалдын аталышы, предмети, түрү жана шилтемеси милдеттүү.'
        );
      }

      if (
        !/^https?:\/\//i.test(
          String(fileUrl)
        )
      ) {
        fail(
          'Материалдын шилтемеси http/https болушу керек.'
        );
      }

      const cleanTitle =
        String(title)
          .trim()
          .slice(0, 200);

      const cleanDescription =
        String(description || '')
          .trim()
          .slice(0, 1000);

      let cleanPrice =
        money(price);

      if (
        cleanPrice < 0 ||
        cleanPrice > 100000
      ) {
        fail(
          'Материалдын баасы туура эмес.'
        );
      }

      const itemsSnapshot =
        await db()
          .ref('market_items')
          .once('value');

      let count = 0;

      itemsSnapshot.forEach(
        (child) => {
          const item =
            child.val();

          if (
            item &&
            item.authorUid ===
              user.uid
          ) {
            count++;
          }
        }
      );

      const isBonus =
        (count + 1) %
          BONUS_EVERY ===
        0;

      if (isBonus) {
        cleanPrice = 0;
      }

      const id = db()
        .ref('market_items')
        .push()
        .key;

      const timestamp =
        now();

      const item = {
        id,

        title:
          cleanTitle,

        subject:
          String(subject)
            .trim(),

        type:
          String(type)
            .trim(),

        price:
          cleanPrice,

        fileUrl:
          String(fileUrl)
            .trim(),

        description:
          cleanDescription,

        authorUid:
          user.uid,

        authorEmail:
          user.email || '',

        status:
          'published',

        commissionRate:
          COMMISSION_RATE,

        authorRate:
          AUTHOR_RATE,

        createdAt:
          timestamp,

        updatedAt:
          timestamp,

        bonusFree:
          isBonus
      };

      await db()
        .ref(`market_items/${id}`)
        .set(item);

      return {
        ok: true,
        id,
        price: cleanPrice,
        bonusFree: isBonus,
        message: isBonus
          ? 'Материал жарыяланды. 6-материал акысыз кылынды.'
          : 'Материал ийгиликтүү жарыяланды.'
      };
    })
);

/* =========================================================
   DELETE MATERIAL
========================================================= */

app.delete(
  '/api/materials/:id',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const id =
        String(req.params.id);

      const snapshot =
        await db()
          .ref(`market_items/${id}`)
          .once('value');

      if (!snapshot.exists()) {
        fail(
          'Материал табылган жок.',
          404
        );
      }

      const item =
        snapshot.val();

      if (
        item.authorUid !==
        user.uid
      ) {
        fail(
          'Бул материалды өчүрүүгө уруксат жок.',
          403
        );
      }

      await db()
        .ref(`market_items/${id}`)
        .remove();

      return {
        ok: true
      };
    })
);

/* =========================================================
   CREATE PAYMENT
========================================================= */

app.post(
  '/api/payments/create',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const productId =
        String(
          req.body?.productId || ''
        );

      if (!productId) {
        fail(
          'productId керек.'
        );
      }

      const itemSnapshot =
        await db()
          .ref(
            `market_items/${productId}`
          )
          .once('value');

      if (
        !itemSnapshot.exists()
      ) {
        fail(
          'Материал табылган жок.',
          404
        );
      }

      const item =
        itemSnapshot.val();

      if (
        String(
          item.status ||
            'published'
        ) !== 'published'
      ) {
        fail(
          'Бул материал азыр сатылбайт.'
        );
      }

      const amount =
        money(item.price);

      if (amount <= 0) {
        fail(
          'Бул материал акысыз.'
        );
      }

      if (
        item.authorUid ===
        user.uid
      ) {
        fail(
          'Өз материалыңызды сатып алуу мүмкүн эмес.'
        );
      }

      const oldPurchase =
        await db()
          .ref(
            `users/${user.uid}/purchases/${productId}`
          )
          .once('value');

      if (
        oldPurchase.exists() &&
        oldPurchase.val().status ===
          'approved' &&
        (
          !oldPurchase.val()
            .expiresAt ||
          now() <=
            Number(
              oldPurchase.val()
                .expiresAt
            )
        )
      ) {
        return {
          ok: true,
          alreadyOwned: true,
          redirectUrl: null
        };
      }

      const order =
        orderId('BL');

      const resultUrl =
        `${apiUrl()}${
          env.FREEDOMPAY_RESULT_PATH ||
          '/api/webhooks/freedompay/result'
        }`;

      const successUrl =
        `${siteUrl()}/sections/lesson-plans.html?payment=success&order=${encodeURIComponent(
          order
        )}`;

      const failureUrl =
        `${siteUrl()}/sections/lesson-plans.html?payment=failure&order=${encodeURIComponent(
          order
        )}`;

      const fields = {
        pg_order_id:
          order,

        pg_merchant_id:
          env.FREEDOMPAY_MERCHANT_ID,

        pg_amount:
          amount,

        pg_description:
          `Bilimal: ${String(
            item.title
          ).slice(0, 120)}`,

        pg_currency:
          'KGS',

        pg_user_id:
          user.uid,

        pg_user_email:
          user.email || '',

        pg_result_url:
          resultUrl,

        pg_success_url:
          successUrl,

        pg_failure_url:
          failureUrl,

        pg_request_method:
          'POST',

        pg_param1:
          productId
      };

      if (
        env.FREEDOMPAY_TESTING_MODE ===
        '1'
      ) {
        fields.pg_testing_mode = 1;
      }

      const response =
        await verifiedFpPost(
          'init_payment.php',
          '/init_payment.php',
          fields,
          env.FREEDOMPAY_SECRET_RECEIVE
        );

      if (
        response.pg_status !==
          'ok' ||
        !response.pg_redirect_url
      ) {
        fail(
          response.pg_error_description ||
            'FreedomPay төлөм барагын түзө алган жок.',
          502
        );
      }

      const createdAt =
        now();

      const expiresAt =
        createdAt +
        ACCESS_DAYS *
          86400000;

      const siteShare =
        money(
          amount *
            COMMISSION_RATE
        );

      const teacherShare =
        money(
          amount *
            AUTHOR_RATE
        );

      const application = {
        orderId:
          order,

        buyerUid:
          user.uid,

        buyerEmail:
          user.email || '',

        teacherUid:
          item.authorUid,

        teacherEmail:
          item.authorEmail || '',

        productId,

        productTitle:
          item.title,

        price:
          amount,

        siteShare,

        teacherShare,

        commissionRate:
          COMMISSION_RATE,

        authorRate:
          AUTHOR_RATE,

        status:
          'pending_payment',

        paymentMethod:
          'FreedomPay',

        freedomPayPaymentId:
          response.pg_payment_id ||
          null,

        createdAt,

        expiresAt
      };

      await db()
        .ref(
          `applications/${order}`
        )
        .set(application);

      await db()
        .ref(
          `payment_orders/${order}`
        )
        .set(application);

      await db()
        .ref(
          `users/${user.uid}/purchases/${productId}`
        )
        .set({
          orderId:
            order,

          productId,

          title:
            item.title,

          fileUrl:
            item.fileUrl,

          sellerUid:
            item.authorUid,

          price:
            amount,

          siteShare,

          teacherShare,

          commissionRate:
            COMMISSION_RATE,

          authorRate:
            AUTHOR_RATE,

          status:
            'pending_payment',

          createdAt,

          expiresAt
        });

      return {
        ok: true,
        orderId:
          order,

        redirectUrl:
          response.pg_redirect_url
      };
    })
);

/* =========================================================
   FINALIZE PAYMENT
========================================================= */

async function finalizePayment(
  fields
) {
  const orderIdValue =
    String(
      fields.pg_order_id || ''
    );

  if (!orderIdValue) {
    fail(
      'order_id жок.',
      400
    );
  }

  const orderSnapshot =
    await db()
      .ref(
        `payment_orders/${orderIdValue}`
      )
      .once('value');

  if (
    !orderSnapshot.exists()
  ) {
    fail(
      'Заказ табылган жок.',
      404
    );
  }

  const order =
    orderSnapshot.val();

  if (
    String(
      fields.pg_merchant_id || ''
    ) !==
    String(
      env.FREEDOMPAY_MERCHANT_ID
    )
  ) {
    fail(
      'Merchant ID туура эмес.',
      403
    );
  }

  if (
    !verifySignature(
      'result',
      fields,
      env.FREEDOMPAY_SECRET_RECEIVE
    )
  ) {
    fail(
      'FreedomPay кол тамгасы туура эмес.',
      403
    );
  }

  if (
    order.status === 'paid'
  ) {
    return true;
  }

  const statusResponse =
    await verifiedFpPost(
      'get_status2.php',
      '/get_status2.php',
      {
        pg_merchant_id:
          env.FREEDOMPAY_MERCHANT_ID,

        pg_order_id:
          orderIdValue
      },
      env.FREEDOMPAY_SECRET_RECEIVE
    );

  if (
    String(
      statusResponse
        .pg_transaction_status
    ) !== 'ok'
  ) {
    const gatewayStatus =
      String(
        statusResponse
          .pg_transaction_status ||
          fields.pg_result ||
          ''
      );

    await db()
      .ref(
        `payment_orders/${orderIdValue}/gatewayStatus`
      )
      .set(
        gatewayStatus
      );

    if (
      [
        'failed',
        'incomplete'
      ].includes(
        gatewayStatus
      )
    ) {
      await db()
        .ref(
          `payment_orders/${orderIdValue}/status`
        )
        .set('failed');
    }

    return false;
  }

  const gatewayAmount =
    money(fields.pg_amount);

  if (
    gatewayAmount &&
    gatewayAmount !==
      money(order.price)
  ) {
    fail(
      'Төлөмдүн суммасы заказга дал келбейт.',
      409
    );
  }

  const timestamp =
    now();

  const expiresAt =
    timestamp +
    ACCESS_DAYS *
      86400000;

  const updates = {};

  updates[
    `applications/${orderIdValue}/status`
  ] = 'paid';

  updates[
    `applications/${orderIdValue}/paidAt`
  ] = timestamp;

  updates[
    `applications/${orderIdValue}/freedomPayPaymentId`
  ] =
    String(
      fields.pg_payment_id ||
        statusResponse.pg_payment_id ||
        ''
    );

  updates[
    `applications/${orderIdValue}/gatewayReference`
  ] =
    String(
      fields.pg_reference || ''
    );

  updates[
    `payment_orders/${orderIdValue}/status`
  ] = 'paid';

  updates[
    `payment_orders/${orderIdValue}/paidAt`
  ] = timestamp;

  updates[
    `payment_orders/${orderIdValue}/freedomPayPaymentId`
  ] =
    String(
      fields.pg_payment_id ||
        statusResponse.pg_payment_id ||
        ''
    );

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/status`
  ] = 'approved';

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/approvedAt`
  ] = timestamp;

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/expiresAt`
  ] = expiresAt;

  const materialSnapshot =
    await db()
      .ref(
        `market_items/${order.productId}/fileUrl`
      )
      .once('value');

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/fileUrl`
  ] =
    materialSnapshot.val() ||
    '';

  /* =====================================================
     LEDGER
  ===================================================== */

  const authorBalanceRef =
    db().ref(
      `users/${order.teacherUid}/balance`
    );

  const platformBalanceRef =
    db().ref(
      'platform_balance'
    );

  const ledgerRef =
    db().ref(
      `ledger/sales/${orderIdValue}`
    );

  const ledgerTransaction =
    await ledgerRef.transaction(
      (current) => {
        if (current) {
          return;
        }

        return {
          orderId:
            orderIdValue,

          authorUid:
            order.teacherUid,

          gross:
            money(order.price),

          authorShare:
            money(
              order.teacherShare
            ),

          commission:
            money(
              order.siteShare
            ),

          createdAt:
            timestamp
        };
      }
    );

  if (
    ledgerTransaction.committed &&
    ledgerTransaction.snapshot.exists()
  ) {
    const ledger =
      ledgerTransaction
        .snapshot
        .val();

    if (
      Number(
        ledger.createdAt
      ) === timestamp
    ) {
      await authorBalanceRef.transaction(
        (value) =>
          money(value) +
          money(
            order.teacherShare
          )
      );

      await platformBalanceRef.transaction(
        (value) =>
          money(value) +
          money(
            order.siteShare
          )
      );
    }
  }

  await db()
    .ref()
    .update(updates);

  return true;
}

/* =========================================================
   FREEDOMPAY PAYMENT WEBHOOK
========================================================= */

app.post(
  '/api/webhooks/freedompay/result',
  async (req, res) => {
    try {
      await finalizePayment(
        req.body || {}
      );

      res
        .status(200)
        .type('application/xml')
        .send(
          '<response><pg_status>ok</pg_status><pg_description>Заказ обработан</pg_description></response>'
        );
    } catch (error) {
      console.error(
        'result webhook',
        error
      );

      const status =
        error.status === 403
          ? 'error'
          : 'ok';

      const message =
        String(
          error.message || ''
        ).replace(
          /[<&>]/g,
          ''
        );

      res
        .status(
          error.status === 403
            ? 403
            : 200
        )
        .type('application/xml')
        .send(
          `<response><pg_status>${status}</pg_status><pg_description>${message}</pg_description></response>`
        );
    }
  }
);

/* =========================================================
   PAYMENT STATUS
========================================================= */

app.get(
  '/api/payments/status',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const orderIdValue =
        String(
          req.query.orderId || ''
        );

      if (!orderIdValue) {
        fail(
          'orderId керек.'
        );
      }

      const snapshot =
        await db()
          .ref(
            `payment_orders/${orderIdValue}`
          )
          .once('value');

      if (
        !snapshot.exists()
      ) {
        fail(
          'Заказ табылган жок.',
          404
        );
      }

      const order =
        snapshot.val();

      if (
        order.buyerUid !==
        user.uid
      ) {
        fail(
          'Бул заказ сизге тиешелүү эмес.',
          403
        );
      }

      return {
        ok: true,
        status:
          order.status,
        orderId:
          orderIdValue,
        productId:
          order.productId
      };
    })
);

/* =========================================================
   ADD PAYOUT CARD
========================================================= */

app.post(
  '/api/cards/add',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const freedomPayUserId =
        numericUserId(
          user.uid
        );

      const cardOrderId =
        orderId('CARD');

      const postUrl =
        `${apiUrl()}${
          env.FREEDOMPAY_CARD_POST_PATH ||
          '/api/webhooks/freedompay/card'
        }`;

      const backUrl =
        `${siteUrl()}/sections/teacher-market.html?card=saved`;

      const fields = {
        pg_merchant_id:
          env.FREEDOMPAY_MERCHANT_ID,

        pg_user_id:
          freedomPayUserId,

        pg_post_link:
          postUrl,

        pg_back_link:
          backUrl,

        pg_order_id:
          cardOrderId
      };

      const response =
        await verifiedFpPost(
          'add2',
          `/v1/merchant/${env.FREEDOMPAY_MERCHANT_ID}/cardstoragepayout/add2`,
          fields,
          env.FREEDOMPAY_SECRET_PAYOUT
        );

      if (
        response.pg_status !==
          'ok' ||
        !response.pg_redirect_url
      ) {
        fail(
          response.pg_error_description ||
            'Карта кошуу барагын түзүү мүмкүн болгон жок.',
          502
        );
      }

      await db()
        .ref(
          `payout_card_sessions/${response.pg_payment_id}`
        )
        .set({
          uid:
            user.uid,

          freedomPayUserId,

          orderId:
            cardOrderId,

          createdAt:
            now(),

          status:
            'pending'
        });

      return {
        ok: true,
        redirectUrl:
          response.pg_redirect_url
      };
    })
);

/* =========================================================
   GET PAYOUT CARD
========================================================= */

app.get(
  '/api/cards',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const snapshot =
        await db()
          .ref(
            `users/${user.uid}/payoutCard`
          )
          .once('value');

      if (
        !snapshot.exists()
      ) {
        return {
          ok: true,
          card: null
        };
      }

      const card =
        snapshot.val();

      return {
        ok: true,

        card: {
          masked:
            card.masked || '',

          tokenSaved:
            Boolean(
              card.token
            ),

          createdAt:
            card.createdAt ||
            null
        }
      };
    })
);

/* =========================================================
   PAYOUT CARD WEBHOOK
========================================================= */

app.post(
  '/api/webhooks/freedompay/card',
  async (req, res) => {
    try {
      const fields =
        req.body || {};

      if (
        !verifySignature(
          'card',
          fields,
          env.FREEDOMPAY_SECRET_PAYOUT
        )
      ) {
        fail(
          'Кол тамга туура эмес.',
          403
        );
      }

      const paymentId =
        String(
          fields.pg_payment_id ||
            ''
        );

      const sessionSnapshot =
        await db()
          .ref(
            `payout_card_sessions/${paymentId}`
          )
          .once('value');

      if (
        sessionSnapshot.exists()
      ) {
        const session =
          sessionSnapshot.val();

        if (
          String(
            fields.pg_status
          ) === 'ok' &&
          fields.pg_card_token
        ) {
          await db()
            .ref(
              `users/${session.uid}/payoutCard`
            )
            .set({
              token:
                String(
                  fields.pg_card_token
                ),

              masked:
                String(
                  fields.pg_card_hash ||
                    ''
                ),

              createdAt:
                now(),

              provider:
                'FreedomPay'
            });

          await db()
            .ref(
              `payout_card_sessions/${paymentId}/status`
            )
            .set('saved');
        }
      }

      res
        .status(200)
        .type('application/xml')
        .send(
          '<pg_status>ok</pg_status>'
        );
    } catch (error) {
      console.error(
        'card webhook',
        error
      );

      res
        .status(
          error.status === 403
            ? 403
            : 200
        )
        .type('application/xml')
        .send(
          `<pg_status>${
            error.status === 403
              ? 'error'
              : 'ok'
          }</pg_status>`
        );
    }
  }
);

/* =========================================================
   CREATE WITHDRAWAL
========================================================= */

app.post(
  '/api/withdrawals/create',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const amount =
        money(
          req.body?.amount
        );

      if (
        amount <
        MIN_WITHDRAWAL
      ) {
        fail(
          `Минималдуу чыгаруу ${MIN_WITHDRAWAL} сом.`
        );
      }

      const cardSnapshot =
        await db()
          .ref(
            `users/${user.uid}/payoutCard`
          )
          .once('value');

      if (
        !cardSnapshot.exists() ||
        !cardSnapshot.val().token
      ) {
        fail(
          'Алгач коопсуз payout картасын кошуңуз.'
        );
      }

      const card =
        cardSnapshot.val();

      const balanceRef =
        db().ref(
          `users/${user.uid}/balance`
        );

      const reservedRef =
        db().ref(
          `users/${user.uid}/withdrawalReserved`
        );

      let reserved =
        false;

      const transaction =
        await balanceRef.transaction(
          (value) => {
            const balance =
              money(value);

            if (
              balance <
              amount
            ) {
              return;
            }

            reserved = true;

            return money(
              balance -
                amount
            );
          }
        );

      if (
        !transaction.committed ||
        !reserved
      ) {
        fail(
          'Баланс жетишсиз же чыгаруу учурунда ката кетти.',
          409
        );
      }

      await reservedRef.transaction(
        (value) =>
          money(value) +
          amount
      );

      const id =
        orderId('WD');

      await db()
        .ref(
          `withdrawal_requests/${id}`
        )
        .set({
          id,

          uid:
            user.uid,

          email:
            user.email || '',

          amount,

          status:
            'pending',

          cardMasked:
            card.masked || '',

          cardToken:
            card.token,

          createdAt:
            now(),

          updatedAt:
            now()
        });

      return {
        ok: true,
        id,
        amount
      };
    })
);

/* =========================================================
   RESTORE WITHDRAWAL
========================================================= */

async function restoreWithdrawal(
  withdrawal
) {
  await db()
    .ref(
      `users/${withdrawal.uid}/balance`
    )
    .transaction(
      (value) =>
        money(value) +
        money(
          withdrawal.amount
        )
    );

  await db()
    .ref(
      `users/${withdrawal.uid}/withdrawalReserved`
    )
    .transaction(
      (value) =>
        Math.max(
          0,
          money(value) -
            money(
              withdrawal.amount
            )
        )
    );
}

/* =========================================================
   EXECUTE PAYOUT
========================================================= */

async function executePayout(
  withdrawalId,
  adminUid
) {
  const snapshot =
    await db()
      .ref(
        `withdrawal_requests/${withdrawalId}`
      )
      .once('value');

  if (
    !snapshot.exists()
  ) {
    fail(
      'Withdrawal табылган жок.',
      404
    );
  }

  const withdrawal =
    snapshot.val();

  if (
    withdrawal.status !==
    'pending'
  ) {
    fail(
      'Бул withdrawal мурда иштетилген.',
      409
    );
  }

  await db()
    .ref(
      `withdrawal_requests/${withdrawalId}`
    )
    .update({
      status:
        'processing',

      processingAt:
        now(),

      processingBy:
        adminUid
    });

  const payoutOrder =
    orderId('PAYOUT');

  const postUrl =
    `${apiUrl()}${
      env.FREEDOMPAY_PAYOUT_POST_PATH ||
      '/api/webhooks/freedompay/payout'
    }`;

  const backUrl =
    `${siteUrl()}/sections/teacher-market.html?withdrawal=${encodeURIComponent(
      withdrawalId
    )}`;

  const fields = {
    pg_merchant_id:
      env.FREEDOMPAY_MERCHANT_ID,

    pg_amount:
      money(
        withdrawal.amount
      ),

    pg_order_id:
      payoutOrder,

    pg_user_id:
      numericUserId(
        withdrawal.uid
      ),

    pg_card_token_to:
      withdrawal.cardToken,

    pg_description:
      `Bilimal payout ${withdrawalId}`,

    pg_post_link:
      postUrl,

    pg_back_link:
      backUrl,

    pg_order_time_limit:
      new Date(
        Date.now() +
          30 * 60000
      )
        .toISOString()
        .slice(0, 19)
        .replace(
          'T',
          ' '
        )
  };

  const response =
    await verifiedFpPost(
      'reg2reg',
      '/api/reg2reg',
      fields,
      env.FREEDOMPAY_SECRET_PAYOUT
    );

  await db()
    .ref(
      `withdrawal_requests/${withdrawalId}`
    )
    .update({
      freedomPayOrderId:
        payoutOrder,

      freedomPayPaymentId:
        response.pg_payment_id ||
        null,

      gatewayStatus:
        response.pg_status ||
        null,

      gatewayError:
        response.pg_error_description ||
        null,

      updatedAt:
        now()
    });

  if (
    response.pg_status ===
    'ok'
  ) {
    await db()
      .ref(
        `withdrawal_requests/${withdrawalId}`
      )
      .update({
        status:
          'processing_provider',

        updatedAt:
          now()
      });

    return {
      status:
        'processing_provider'
    };
  }

  if (
    response.pg_status ===
    'error'
  ) {
    await restoreWithdrawal(
      withdrawal
    );

    await db()
      .ref(
        `withdrawal_requests/${withdrawalId}`
      )
      .update({
        status:
          'error',

        error:
          response.pg_error_description ||
          'Payout катасы',

        updatedAt:
          now()
      });

    fail(
      response.pg_error_description ||
        'Payout аткарылган жок.',
      502
    );
  }

  return {
    status:
      'processing'
  };
}

/* =========================================================
   ADMIN APPROVE WITHDRAWAL
========================================================= */

app.post(
  '/api/admin/withdrawals/:id/approve',
  (req, res) =>
    json(req, res, async () => {
      const admin =
        await adminUser(req);

      const result =
        await executePayout(
          String(
            req.params.id
          ),
          admin.uid
        );

      return {
        ok: true,
        ...result,

        message:
          'Payout провайдерге жөнөтүлдү. Натыйжасы автоматтык жаңыртылат.'
      };
    })
);

/* =========================================================
   FREEDOMPAY PAYOUT WEBHOOK
========================================================= */

app.post(
  '/api/webhooks/freedompay/payout',
  async (req, res) => {
    try {
      const fields =
        req.body || {};

      if (
        !verifySignature(
          'payout',
          fields,
          env.FREEDOMPAY_SECRET_PAYOUT
        )
      ) {
        fail(
          'Payout кол тамгасы туура эмес.',
          403
        );
      }

      const snapshot =
        await db()
          .ref(
            'withdrawal_requests'
          )
          .once('value');

      let target = null;

      snapshot.forEach(
        (child) => {
          const value =
            child.val();

          if (
            value &&
            value.freedomPayOrderId ===
              String(
                fields.pg_order_id ||
                  ''
              )
          ) {
            target = {
              id:
                child.key,

              data:
                value
            };
          }
        }
      );

      if (target) {
        const status =
          String(
            fields.pg_payment_status ||
              fields.pg_status ||
              ''
          );

        if (
          status ===
            'success' ||
          String(
            fields.pg_status
          ) === 'ok'
        ) {
          await db()
            .ref(
              `withdrawal_requests/${target.id}`
            )
            .update({
              status:
                'success',

              completedAt:
                now(),

              providerPaymentId:
                fields.pg_payment_id ||
                null,

              providerReference:
                fields.pg_reference ||
                null,

              updatedAt:
                now()
            });

          await db()
            .ref(
              `users/${target.data.uid}/withdrawalReserved`
            )
            .transaction(
              (value) =>
                Math.max(
                  0,
                  money(value) -
                    money(
                      target.data
                        .amount
                    )
                )
            );
        } else if (
          status ===
            'error' ||
          String(
            fields.pg_status
          ) === 'error'
        ) {
          await restoreWithdrawal(
            target.data
          );

          await db()
            .ref(
              `withdrawal_requests/${target.id}`
            )
            .update({
              status:
                'error',

              error:
                fields.pg_error_description ||
                'Payout катасы',

              updatedAt:
                now()
            });
        }
      }

      res
        .status(200)
        .type('application/xml')
        .send(
          '<pg_status>ok</pg_status>'
        );
    } catch (error) {
      console.error(
        'payout webhook',
        error
      );

      res
        .status(
          error.status === 403
            ? 403
            : 200
        )
        .type('application/xml')
        .send(
          `<pg_status>${
            error.status === 403
              ? 'error'
              : 'ok'
          }</pg_status>`
        );
    }
  }
);

/* =========================================================
   ADMIN: GET WITHDRAWALS
========================================================= */

app.get(
  '/api/admin/withdrawals',
  (req, res) =>
    json(req, res, async () => {
      await adminUser(req);

      const snapshot =
        await db()
          .ref(
            'withdrawal_requests'
          )
          .once('value');

      return {
        ok: true,

        data:
          snapshot.val() || {}
      };
    })
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res
      .status(404)
      .json({
        ok: false,
        message:
          'API route табылган жок.'
      });
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default app;
