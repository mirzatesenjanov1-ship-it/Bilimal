import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb'
  })
);

app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  })
);

const env = process.env;

const required = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_DATABASE_URL',
  'GOPAY_API_KEY',
  'GOPAY_SECRET_KEY'
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

const db = () => getDatabase();
const auth = () => getAuth();

const COMMISSION_RATE = 0.21;
const AUTHOR_RATE = 0.79;
const ACCESS_DAYS = 365;
const MIN_WITHDRAWAL = 100;
const BONUS_EVERY = 6;

const GOPAY_BASE_URL = (
  env.GOPAY_BASE_URL || 'https://api.gopay.kg'
).replace(/\/$/, '');

const siteUrl = () =>
  (env.PUBLIC_SITE_URL || 'https://bilimal.org').replace(/\/$/, '');

const apiUrl = () =>
  (env.PUBLIC_API_URL || '').replace(/\/$/, '');

const testingMode =
  String(env.GOPAY_TESTING_MODE || '1') === '1';


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


function orderId(prefix = 'BL') {
  return `${prefix}_${Date.now()}_${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`
    .slice(0, 32);
}


function numericUserId(uid) {
  return String(
    (parseInt(
      crypto
        .createHash('sha256')
        .update(uid)
        .digest('hex')
        .slice(0, 12),
      16
    ) %
      900000000) +
      100000000
  );
}


function timingSafeEqualText(a, b) {
  try {
    const aa = Buffer.from(String(a || ''), 'utf8');
    const bb = Buffer.from(String(b || ''), 'utf8');

    return (
      aa.length === bb.length &&
      crypto.timingSafeEqual(aa, bb)
    );
  } catch {
    return false;
  }
}


/*
|--------------------------------------------------------------------------
| GoPay signature
|--------------------------------------------------------------------------
*/

function gopaySignature(nonce, bodyString, secret) {
  const payload = `${nonce}\n${bodyString}\n`;

  return crypto
    .createHmac('sha512', secret)
    .update(payload, 'utf8')
    .digest('hex')
    .toUpperCase();
}


/*
|--------------------------------------------------------------------------
| GoPay POST
|--------------------------------------------------------------------------
*/

async function goPayPost(path, data) {
  const body = JSON.stringify(data);

  const nonce = crypto
    .randomBytes(16)
    .toString('hex');

  const signature = gopaySignature(
    nonce,
    body,
    env.GOPAY_SECRET_KEY
  );

  const response = await fetch(
    `${GOPAY_BASE_URL}${path}`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'GoPay-Api-Key': env.GOPAY_API_KEY,
        'GoPay-Nonce': nonce,
        'GoPay-Signature': signature
      },

      body,

      signal: AbortSignal.timeout(30000)
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    fail(
      `GoPay серверинен жарактуу JSON жооп келген жок. HTTP ${response.status}`,
      502
    );
  }

  if (!result || result.status !== 'OK') {
    const code = String(
      result?.code || 'UNKNOWN'
    );

    const message = String(
      result?.error_message ||
        'GoPay төлөм API катасы.'
    );

    fail(
      `GoPay [${code}]: ${message}`,
      502
    );
  }

  return result.data || {};
}


/*
|--------------------------------------------------------------------------
| GoPay payment status
|--------------------------------------------------------------------------
*/

async function goPayQuery({
  paymentId,
  orderIdValue
}) {
  const body = {};

  if (paymentId) {
    body.payment_id = paymentId;
  }

  if (orderIdValue) {
    body.order_id = orderIdValue;
  }

  return goPayPost(
    '/v1/payments/query',
    body
  );
}


/*
|--------------------------------------------------------------------------
| Firebase authentication
|--------------------------------------------------------------------------
*/

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

  try {
    return await auth().verifyIdToken(
      header.slice(7)
    );
  } catch {
    fail(
      'Firebase токени жараксыз же мөөнөтү бүткөн.',
      401
    );
  }
}


/*
|--------------------------------------------------------------------------
| Admin authentication
|--------------------------------------------------------------------------
*/

async function adminUser(req) {
  const decoded = await bearerUser(req);

  const snap = await db()
    .ref(`users/${decoded.uid}`)
    .once('value');

  const user = snap.val() || {};

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


/*
|--------------------------------------------------------------------------
| JSON wrapper
|--------------------------------------------------------------------------
*/

async function json(req, res, fn) {
  try {
    const result = await fn();

    res.status(200).json(result);
  } catch (error) {
    console.error(error);

    res.status(
      error.status || 500
    ).json({
      ok: false,
      message:
        error.message ||
        'Сервер катасы.'
    });
  }
}


/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
  '/health',
  (_req, res) => {
    res.json({
      ok: true,
      service:
        'bilimal-market-api',
      provider: 'GoPay',
      firebaseReady,
      configured:
        missing.length === 0,
      missing
    });
  }
);


/*
|--------------------------------------------------------------------------
| CREATE MATERIAL
|--------------------------------------------------------------------------
*/

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
          'Баасы туура эмес.'
        );
      }

      const itemsSnapshot =
        await db()
          .ref('market_items')
          .once('value');

      let count = 0;

      itemsSnapshot.forEach(
        (child) => {
          if (
            child.val()?.authorUid ===
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

      const id =
        db()
          .ref('market_items')
          .push()
          .key;

      const item = {
        id,

        title: cleanTitle,

        subject:
          String(subject).trim(),

        type:
          String(type).trim(),

        price: cleanPrice,

        fileUrl:
          String(fileUrl).trim(),

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
          now(),

        updatedAt:
          now(),

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


/*
|--------------------------------------------------------------------------
| DELETE MATERIAL
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| CREATE PAYMENT
|--------------------------------------------------------------------------
*/

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

      const old =
        await db()
          .ref(
            `users/${user.uid}/purchases/${productId}`
          )
          .once('value');

      if (
        old.exists() &&
        old.val().status ===
          'approved' &&
        (
          !old.val().expiresAt ||
          now() <=
            Number(
              old.val().expiresAt
            )
        )
      ) {
        return {
          ok: true,
          alreadyOwned: true,
          redirectUrl: null
        };
      }

      const oid =
        orderId('BL');

      const successUrl =
        `${siteUrl()}/sections/lesson-plans.html?payment=success&order=${encodeURIComponent(oid)}`;

      const failureUrl =
        `${siteUrl()}/sections/lesson-plans.html?payment=failure&order=${encodeURIComponent(oid)}`;

      const webhookUrl =
        `${apiUrl()}/api/webhooks/gopay/events`;

      const payment =
        await goPayPost(
          '/v1/payments',
          {
            order_id: oid,

            amount:
              amount.toFixed(2),

            description:
              `Bilimal: ${String(
                item.title
              ).slice(0, 220)}`,

            lifetime: 3600,

            callback_url:
              webhookUrl,

            success_url:
              successUrl,

            failure_url:
              failureUrl,

            testing_mode:
              testingMode,

            buyer:
              user.email
                ? {
                    email:
                      user.email
                  }
                : undefined
          }
        );

      const created =
        now();

      const expires =
        created +
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

      const appData = {
        orderId: oid,

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
          'GoPay',

        goPayPaymentId:
          payment.payment_id ||
          null,

        goPayStatus:
          payment.status ||
          'CREATED',

        checkoutUrl:
          payment.checkout_url ||
          null,

        createdAt:
          created,

        expiresAt:
          expires
      };

      await db()
        .ref(`applications/${oid}`)
        .set(appData);

      await db()
        .ref(`payment_orders/${oid}`)
        .set(appData);

      await db()
        .ref(
          `users/${user.uid}/purchases/${productId}`
        )
        .set({
          orderId: oid,

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

          paymentMethod:
            'GoPay',

          goPayPaymentId:
            payment.payment_id ||
            null,

          createdAt:
            created,

          expiresAt:
            expires
        });

      return {
        ok: true,

        orderId:
          oid,

        paymentId:
          payment.payment_id ||
          null,

        redirectUrl:
          payment.checkout_url ||
          null,

        qrUrl:
          payment.qr_url ||
          null,

        qrData:
          payment.qr_data ||
          null,

        appLinks:
          payment.app_links ||
          {}
      };
    })
);


/*
|--------------------------------------------------------------------------
| FINALIZE PAID ORDER
|--------------------------------------------------------------------------
*/

async function applyPaidOrder(
  oid,
  providerData = {}
) {
  const orderSnapshot =
    await db()
      .ref(
        `payment_orders/${oid}`
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
    order.status === 'paid'
  ) {
    return true;
  }

  const providerAmount =
    money(
      providerData.amount
    );

  if (
    providerAmount &&
    providerAmount !==
      money(order.price)
  ) {
    fail(
      'GoPay төлөмүнүн суммасы заказга дал келбейт.',
      409
    );
  }

  const timestamp =
    now();

  const expires =
    timestamp +
    ACCESS_DAYS *
      86400000;

  const updates = {};

  updates[
    `applications/${oid}/status`
  ] = 'paid';

  updates[
    `applications/${oid}/paidAt`
  ] = timestamp;

  updates[
    `applications/${oid}/goPayPaymentId`
  ] =
    String(
      providerData.payment_id ||
        order.goPayPaymentId ||
        ''
    );

  updates[
    `applications/${oid}/goPayStatus`
  ] =
    String(
      providerData.status ||
        'COMMITTED'
    );

  updates[
    `payment_orders/${oid}/status`
  ] = 'paid';

  updates[
    `payment_orders/${oid}/paidAt`
  ] = timestamp;

  updates[
    `payment_orders/${oid}/goPayPaymentId`
  ] =
    String(
      providerData.payment_id ||
        order.goPayPaymentId ||
        ''
    );

  updates[
    `payment_orders/${oid}/goPayStatus`
  ] =
    String(
      providerData.status ||
        'COMMITTED'
    );

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/status`
  ] = 'approved';

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/approvedAt`
  ] = timestamp;

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/expiresAt`
  ] = expires;

  const fileSnapshot =
    await db()
      .ref(
        `market_items/${order.productId}/fileUrl`
      )
      .once('value');

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/fileUrl`
  ] =
    fileSnapshot.val() || '';

  const ledgerRef =
    db().ref(
      `ledger/sales/${oid}`
    );

  const transaction =
    await ledgerRef.transaction(
      (value) => {
        if (value) {
          return value;
        }

        return {
          orderId:
            oid,

          provider:
            'GoPay',

          authorUid:
            order.teacherUid,

          gross:
            order.price,

          authorShare:
            order.teacherShare,

          commission:
            order.siteShare,

          createdAt:
            timestamp
        };
      }
    );

  if (
    transaction.committed &&
    transaction.snapshot.val()?.createdAt ===
      timestamp
  ) {
    await db()
      .ref(
        `users/${order.teacherUid}/balance`
      )
      .transaction(
        (value) =>
          money(value) +
          money(
            order.teacherShare
          )
      );

    await db()
      .ref('platform_balance')
      .transaction(
        (value) =>
          money(value) +
          money(
            order.siteShare
          )
      );
  }

  await db()
    .ref()
    .update(updates);

  return true;
}


/*
|--------------------------------------------------------------------------
| GoPay webhook
|--------------------------------------------------------------------------
*/

function extractGoPayEvent(req) {
  const body =
    req.body || {};

  const data =
    body.data ||
    body.payment ||
    body;

  const event =
    String(
      body.event ||
        body.type ||
        body.name ||
        ''
    ).toLowerCase();

  return {
    body,
    data,
    event
  };
}


app.post(
  '/api/webhooks/gopay/events',
  async (req, res) => {
    try {
      const webhookSecret =
        env.GOPAY_WEBHOOK_SECRET ||
        env.GOPAY_SECRET_KEY;

      const signatureHeader =
        req.headers[
          'gopay-signature'
        ];

      if (
        !signatureHeader
      ) {
        fail(
          'GoPay webhook кол тамгасы жок.',
          403
        );
      }

      const raw =
        req.rawBody ||
        Buffer.from(
          JSON.stringify(
            req.body || {}
          ),
          'utf8'
        );

      const expected =
        crypto
          .createHmac(
            'sha512',
            webhookSecret
          )
          .update(raw)
          .digest('hex')
          .toUpperCase();

      const received =
        String(
          signatureHeader
        )
          .replace(
            /^sha512=/i,
            ''
          )
          .trim()
          .toUpperCase();

      if (
        !timingSafeEqualText(
          expected,
          received
        )
      ) {
        fail(
          'GoPay webhook кол тамгасы туура эмес.',
          403
        );
      }

      const {
        body,
        data,
        event
      } =
        extractGoPayEvent(req);

      const oid =
        String(
          data.order_id ||
            body.order_id ||
            ''
        );

      const status =
        String(
          data.status ||
            body.status ||
            ''
        ).toUpperCase();

      if (!oid) {
        fail(
          'GoPay webhook ичинде order_id жок.',
          400
        );
      }

      if (
        event.includes(
          'committed'
        ) ||
        status === 'COMMITTED' ||
        status === 'SUCCESS'
      ) {
        await applyPaidOrder(
          oid,
          data
        );
      } else if (
        event.includes(
          'failed'
        ) ||
        event.includes(
          'expired'
        ) ||
        [
          'FAILED',
          'EXPIRED'
        ].includes(status)
      ) {
        await db()
          .ref(
            `payment_orders/${oid}`
          )
          .update({
            status:
              'failed',

            goPayStatus:
              status ||
              event ||
              'FAILED',

            updatedAt:
              now()
          });

        const orderSnapshot =
          await db()
            .ref(
              `payment_orders/${oid}`
            )
            .once('value');

        if (
          orderSnapshot.exists()
        ) {
          const order =
            orderSnapshot.val();

          await db()
            .ref(
              `users/${order.buyerUid}/purchases/${order.productId}/status`
            )
            .set('failed');
        }
      }

      res
        .status(200)
        .json({
          ok: true
        });
    } catch (error) {
      console.error(
        'GoPay webhook:',
        error
      );

      res
        .status(
          error.status ===
            403
            ? 403
            : 200
        )
        .json({
          ok:
            error.status !==
            403,

          message:
            error.message ||
            'Webhook error'
        });
    }
  }
);


/*
|--------------------------------------------------------------------------
| PAYMENT STATUS
|--------------------------------------------------------------------------
*/

app.get(
  '/api/payments/status',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const oid =
        String(
          req.query.orderId ||
            ''
        );

      if (!oid) {
        fail(
          'orderId керек.'
        );
      }

      const snapshot =
        await db()
          .ref(
            `payment_orders/${oid}`
          )
          .once('value');

      if (
        !snapshot.exists() ||
        snapshot.val()
          .buyerUid !==
          user.uid
      ) {
        fail(
          'Заказ табылган жок.',
          404
        );
      }

      const order =
        snapshot.val();

      if (
        order.status ===
          'pending_payment' &&
        order.goPayPaymentId
      ) {
        try {
          const remote =
            await goPayQuery({
              paymentId:
                order.goPayPaymentId,

              orderIdValue:
                oid
            });

          const remoteStatus =
            String(
              remote.status ||
                ''
            ).toUpperCase();

          await db()
            .ref(
              `payment_orders/${oid}`
            )
            .update({
              goPayStatus:
                remoteStatus,

              lastStatusCheckAt:
                now()
            });

          if (
            remoteStatus ===
            'COMMITTED'
          ) {
            await applyPaidOrder(
              oid,
              remote
            );
          } else if (
            [
              'FAILED',
              'EXPIRED'
            ].includes(
              remoteStatus
            )
          ) {
            await db()
              .ref(
                `payment_orders/${oid}/status`
              )
              .set('failed');

            await db()
              .ref(
                `users/${order.buyerUid}/purchases/${order.productId}/status`
              )
              .set('failed');
          }
        } catch (error) {
          console.error(
            'GoPay status query:',
            error
          );
        }
      }

      const fresh =
        await db()
          .ref(
            `payment_orders/${oid}`
          )
          .once('value');

      const value =
        fresh.val();

      return {
        ok: true,

        status:
          value.status,

        providerStatus:
          value.goPayStatus ||
          null,

        orderId:
          oid,

        productId:
          value.productId,

        paymentMethod:
          'GoPay'
      };
    })
);


/*
|--------------------------------------------------------------------------
| PAYOUT CARD / ACCOUNT
|--------------------------------------------------------------------------
|
| GoPay payment кабыл алуу үчүн колдонулат.
| Авторлордун payout'у азырынча manual.
|
|--------------------------------------------------------------------------
*/

app.post(
  '/api/cards/add',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const method =
        String(
          req.body?.method ||
            'MBank'
        )
          .trim()
          .slice(0, 40);

      const account =
        String(
          req.body?.account ||
            ''
        ).trim();

      if (!account) {
        fail(
          'Чыгаруу үчүн карта/эсеп/телефон реквизити керек.'
        );
      }

      if (
        account.length < 5 ||
        account.length > 80
      ) {
        fail(
          'Реквизиттин узундугу туура эмес.'
        );
      }

      const masked =
        account.length > 4
          ? `${'*'.repeat(
              Math.max(
                0,
                account.length - 4
              )
            )}${account.slice(-4)}`
          : account;

      await db()
        .ref(
          `users/${user.uid}/payoutCard`
        )
        .set({
          method,

          account,

          masked,

          createdAt:
            now(),

          provider:
            'Manual payout'
        });

      return {
        ok: true,

        card: {
          masked,

          method,

          tokenSaved:
            false,

          manualPayout:
            true
        }
      };
    })
);


/*
|--------------------------------------------------------------------------
| GET PAYOUT CARD
|--------------------------------------------------------------------------
*/

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

      const value =
        snapshot.val();

      return {
        ok: true,

        card: {
          masked:
            value.masked ||
            '',

          method:
            value.method ||
            'MBank',

          tokenSaved:
            false,

          manualPayout:
            true,

          createdAt:
            value.createdAt ||
            null
        }
      };
    })
);


/*
|--------------------------------------------------------------------------
| CREATE WITHDRAWAL
|--------------------------------------------------------------------------
*/

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

      const card =
        await db()
          .ref(
            `users/${user.uid}/payoutCard`
          )
          .once('value');

      if (
        !card.exists() ||
        !card.val().account
      ) {
        fail(
          'Алгач чыгаруу реквизитин кошуңуз.'
        );
      }

      const balanceRef =
        db().ref(
          `users/${user.uid}/balance`
        );

      const reservedRef =
        db().ref(
          `users/${user.uid}/withdrawalReserved`
        );

      let reservedOk =
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

            reservedOk =
              true;

            return money(
              balance - amount
            );
          }
        );

      if (
        !transaction.committed ||
        !reservedOk
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

      const payout =
        card.val();

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

          payoutMethod:
            payout.method ||
            'MBank',

          payoutAccount:
            payout.account,

          cardMasked:
            payout.masked ||
            '',

          provider:
            'Manual payout',

          createdAt:
            now(),

          updatedAt:
            now()
        });

      return {
        ok: true,

        id,

        amount,

        status:
          'pending'
      };
    })
);


/*
|--------------------------------------------------------------------------
| RESTORE WITHDRAWAL
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| ADMIN APPROVE WITHDRAWAL
|--------------------------------------------------------------------------
*/

app.post(
  '/api/admin/withdrawals/:id/approve',
  (req, res) =>
    json(req, res, async () => {
      const admin =
        await adminUser(req);

      const id =
        String(
          req.params.id
        );

      const snapshot =
        await db()
          .ref(
            `withdrawal_requests/${id}`
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
          `withdrawal_requests/${id}`
        )
        .update({
          status:
            'paid',

          approvedAt:
            now(),

          approvedBy:
            admin.uid,

          updatedAt:
            now(),

          provider:
            'Manual payout'
        });

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

      return {
        ok: true,

        status:
          'paid',

        message:
          'Чыгаруу өтүнүчү бекитилди. GoPay автоматтык payout жасабайт; сумманы көрсөтүлгөн реквизитке администратор өзү которот.'
      };
    })
);


/*
|--------------------------------------------------------------------------
| ADMIN REJECT WITHDRAWAL
|--------------------------------------------------------------------------
*/

app.post(
  '/api/admin/withdrawals/:id/reject',
  (req, res) =>
    json(req, res, async () => {
      const admin =
        await adminUser(req);

      const id =
        String(
          req.params.id
        );

      const snapshot =
        await db()
          .ref(
            `withdrawal_requests/${id}`
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

      await restoreWithdrawal(
        withdrawal
      );

      await db()
        .ref(
          `withdrawal_requests/${id}`
        )
        .update({
          status:
            'rejected',

          rejectedAt:
            now(),

          rejectedBy:
            admin.uid,

          rejectReason:
            String(
              req.body?.reason ||
                'Администратор четке какты.'
            ).slice(0, 500),

          updatedAt:
            now()
        });

      return {
        ok: true,

        status:
          'rejected'
      };
    })
);


/*
|--------------------------------------------------------------------------
| ADMIN WITHDRAWALS
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(
  (req, res) =>
    res.status(404).json({
      ok: false,
      message:
        'API route табылган жок.'
    })
);


/*
|--------------------------------------------------------------------------
| Vercel
|--------------------------------------------------------------------------
*/

export default app;
