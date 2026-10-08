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
  (env.PUBLIC_API_URL || siteUrl()).replace(/\/$/, '');

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
  ['/health', '/api/health'],
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
    `users/${order.buyerUid}/purchases/${order.productId}/paidAt`
  ] = timestamp;

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/expiresAt`
  ] = expires;

  updates[
    `users/${order.buyerUid}/purchases/${order.productId}/fileUrl`
  ] =
    order.fileUrl ||
    '';

  updates[
    `users/${order.teacherUid}/wallet/totalSales`
  ] =
    (
      Number(
        (
          await db()
            .ref(
              `users/${order.teacherUid}/wallet/totalSales`
            )
            .once('value')
        ).val()
      ) || 0
    ) +
    money(order.teacherShare);

  updates[
    `users/${order.teacherUid}/wallet/commission`
  ] =
    (
      Number(
        (
          await db()
            .ref(
              `users/${order.teacherUid}/wallet/commission`
            )
            .once('value')
        ).val()
      ) || 0
    ) +
    money(order.siteShare);

  updates[
    `users/${order.teacherUid}/wallet/earnings`
  ] =
    (
      Number(
        (
          await db()
            .ref(
              `users/${order.teacherUid}/wallet/earnings`
            )
            .once('value')
        ).val()
      ) || 0
    ) +
    money(order.teacherShare);

  updates[
    `users/${order.teacherUid}/wallet/available`
  ] =
    (
      Number(
        (
          await db()
            .ref(
              `users/${order.teacherUid}/wallet/available`
            )
            .once('value')
        ).val()
      ) || 0
    ) +
    money(order.teacherShare);

  updates[
    `users/${order.teacherUid}/wallet/lastSaleAt`
  ] = timestamp;

  updates[
    `sales/${oid}`
  ] = {
    orderId: oid,

    buyerUid:
      order.buyerUid,

    buyerEmail:
      order.buyerEmail || '',

    teacherUid:
      order.teacherUid,

    teacherEmail:
      order.teacherEmail || '',

    productId:
      order.productId,

    productTitle:
      order.productTitle,

    price:
      money(order.price),

    commission:
      money(order.siteShare),

    teacherEarnings:
      money(order.teacherShare),

    commissionRate:
      COMMISSION_RATE,

    authorRate:
      AUTHOR_RATE,

    status:
      'paid',

    paymentMethod:
      'GoPay',

    goPayPaymentId:
      providerData.payment_id ||
      order.goPayPaymentId ||
      null,

    paidAt:
      timestamp
  };

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

app.post(
  '/api/webhooks/gopay/events',
  (req, res) =>
    json(req, res, async () => {
      const body =
        req.body || {};

      const oid =
        String(
          body.order_id ||
            body.data?.order_id ||
            ''
        );

      if (!oid) {
        fail(
          'GoPay webhook ичинде order_id жок.',
          400
        );
      }

      const providerData =
        body.data ||
        body.payment ||
        body;

      const status =
        String(
          providerData.status ||
            body.status ||
            ''
        ).toUpperCase();

      if (
        [
          'PAID',
          'COMMITTED',
          'SUCCESS',
          'SUCCEEDED',
          'COMPLETED'
        ].includes(status)
      ) {
        await applyPaidOrder(
          oid,
          providerData
        );
      } else {
        await db()
          .ref(
            `payment_orders/${oid}/goPayStatus`
          )
          .set(status || 'UNKNOWN');

        await db()
          .ref(
            `applications/${oid}/goPayStatus`
          )
          .set(status || 'UNKNOWN');
      }

      return {
        ok: true
      };
    })
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
          req.query.orderId || ''
        );

      const productId =
        String(
          req.query.productId || ''
        );

      if (!oid && !productId) {
        fail(
          'orderId же productId керек.'
        );
      }

      let order = null;

      if (oid) {
        const snapshot =
          await db()
            .ref(
              `payment_orders/${oid}`
            )
            .once('value');

        if (
          snapshot.exists()
        ) {
          order =
            snapshot.val();
        }
      }

      if (
        !order &&
        productId
      ) {
        const snapshot =
          await db()
            .ref(
              `users/${user.uid}/purchases/${productId}`
            )
            .once('value');

        if (
          snapshot.exists()
        ) {
          const purchase =
            snapshot.val();

          if (
            purchase.orderId
          ) {
            const orderSnapshot =
              await db()
                .ref(
                  `payment_orders/${purchase.orderId}`
                )
                .once('value');

            if (
              orderSnapshot.exists()
            ) {
              order =
                orderSnapshot.val();
            }
          }
        }
      }

      if (!order) {
        return {
          ok: true,
          status: 'not_found',
          paid: false
        };
      }

      if (
        order.buyerUid !==
        user.uid
      ) {
        fail(
          'Бул төлөмдү көрүүгө уруксат жок.',
          403
        );
      }

      let finalStatus =
        String(
          order.status || ''
        );

      if (
        order.goPayPaymentId &&
        finalStatus !== 'paid'
      ) {
        try {
          const provider =
            await goPayQuery({
              paymentId:
                order.goPayPaymentId,

              orderIdValue:
                order.orderId
            });

          const providerStatus =
            String(
              provider.status ||
                ''
            ).toUpperCase();

          if (
            [
              'PAID',
              'COMMITTED',
              'SUCCESS',
              'SUCCEEDED',
              'COMPLETED'
            ].includes(
              providerStatus
            )
          ) {
            await applyPaidOrder(
              order.orderId,
              provider
            );

            finalStatus =
              'paid';
          } else {
            finalStatus =
              order.status ||
              providerStatus ||
              'pending_payment';
          }
        } catch (error) {
          console.error(
            'GoPay status query:',
            error
          );
        }
      }

      const purchaseSnapshot =
        await db()
          .ref(
            `users/${user.uid}/purchases/${order.productId}`
          )
          .once('value');

      const purchase =
        purchaseSnapshot.val() ||
        {};

      return {
        ok: true,

        orderId:
          order.orderId,

        productId:
          order.productId,

        status:
          finalStatus,

        paid:
          finalStatus ===
          'paid',

        expiresAt:
          purchase.expiresAt ||
          null,

        fileUrl:
          finalStatus ===
          'paid'
            ? purchase.fileUrl ||
              null
            : null
      };
    })
);


/*
|--------------------------------------------------------------------------
| ADD CARD / PAYOUT REQUISITE
|--------------------------------------------------------------------------
*/

app.post(
  '/api/cards/add',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const {
        type,
        phone,
        cardNumber,
        bank,
        wallet,
        holderName
      } = req.body || {};

      const cleanType =
        String(
          type || 'card'
        )
          .trim()
          .toLowerCase();

      if (
        ![
          'card',
          'mbank',
          'wallet'
        ].includes(cleanType)
      ) {
        fail(
          'Реквизиттин түрү туура эмес.'
        );
      }

      let value = '';

      if (
        cleanType === 'card'
      ) {
        value =
          String(
            cardNumber || ''
          )
            .replace(/\D/g, '')
            .slice(0, 19);

        if (
          value.length < 13
        ) {
          fail(
            'Картанын номери туура эмес.'
          );
        }
      }

      if (
        cleanType === 'mbank'
      ) {
        value =
          String(
            phone || ''
          )
            .replace(/[^\d+]/g, '')
            .slice(0, 20);

        if (
          value.length < 9
        ) {
          fail(
            'MBANK телефон номери туура эмес.'
          );
        }
      }

      if (
        cleanType === 'wallet'
      ) {
        value =
          String(
            wallet || ''
          )
            .trim()
            .slice(0, 100);

        if (!value) {
          fail(
            'Капчык реквизити керек.'
          );
        }
      }

      const id =
        db()
          .ref(
            `users/${user.uid}/payoutMethods`
          )
          .push()
          .key;

      const record = {
        id,

        type:
          cleanType,

        value,

        bank:
          String(
            bank || ''
          )
            .trim()
            .slice(0, 100),

        holderName:
          String(
            holderName || ''
          )
            .trim()
            .slice(0, 150),

        createdAt:
          now(),

        active:
          true
      };

      await db()
        .ref(
          `users/${user.uid}/payoutMethods/${id}`
        )
        .set(record);

      await db()
        .ref(
          `users/${user.uid}/wallet/defaultPayoutMethod`
        )
        .set(id);

      return {
        ok: true,
        id,
        message:
          'Төлөм алуу реквизити сакталды.'
      };
    })
);


/*
|--------------------------------------------------------------------------
| LIST CARDS / PAYOUT METHODS
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
            `users/${user.uid}/payoutMethods`
          )
          .once('value');

      const list = [];

      snapshot.forEach(
        (child) => {
          const item =
            child.val() || {};

          list.push({
            id:
              child.key,

            type:
              item.type ||
              'card',

            value:
              item.value ||
              '',

            bank:
              item.bank ||
              '',

            holderName:
              item.holderName ||
              '',

            createdAt:
              item.createdAt ||
              0,

            active:
              item.active !== false
          });
        }
      );

      return {
        ok: true,
        items: list
      };
    })
);


/*
|--------------------------------------------------------------------------
| DELETE PAYOUT METHOD
|--------------------------------------------------------------------------
*/

app.delete(
  '/api/cards/:id',
  (req, res) =>
    json(req, res, async () => {
      const user =
        await bearerUser(req);

      const id =
        String(
          req.params.id
        );

      const reference =
        db().ref(
          `users/${user.uid}/payoutMethods/${id}`
        );

      const snapshot =
        await reference.once(
          'value'
        );

      if (
        !snapshot.exists()
      ) {
        fail(
          'Реквизит табылган жок.',
          404
        );
      }

      await reference.remove();

      const defaultRef =
        db().ref(
          `users/${user.uid}/wallet/defaultPayoutMethod`
        );

      const defaultSnapshot =
        await defaultRef.once(
          'value'
        );

      if (
        defaultSnapshot.val() ===
        id
      ) {
        await defaultRef.remove();
      }

      return {
        ok: true
      };
    })
);
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

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/goPayPaymentId`
        ] =
          String(
            providerData.payment_id ||
              order.goPayPaymentId ||
              ''
          );

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/goPayStatus`
        ] =
          String(
            providerData.status ||
              'COMMITTED'
          );

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/orderId`
        ] = oid;

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/fileUrl`
        ] =
          order.fileUrl ||
          '';

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/title`
        ] =
          order.productTitle ||
          '';

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/price`
        ] =
          money(order.price);

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/sellerUid`
        ] =
          order.teacherUid ||
          '';

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/sellerEmail`
        ] =
          order.teacherEmail ||
          '';

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/siteShare`
        ] =
          money(order.siteShare);

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/teacherShare`
        ] =
          money(order.teacherShare);

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/commissionRate`
        ] =
          COMMISSION_RATE;

        updates[
          `users/${order.buyerUid}/purchases/${order.productId}/authorRate`
        ] =
          AUTHOR_RATE;

        await db()
          .ref()
          .update(updates);

        const teacherBalanceRef =
          db()
            .ref(
              `users/${order.teacherUid}/wallet/balance`
            );

        const teacherBalanceSnapshot =
          await teacherBalanceRef.once(
            'value'
          );

        const oldBalance =
          money(
            teacherBalanceSnapshot.val()
          );

        const newBalance =
          money(
            oldBalance +
              money(order.teacherShare)
          );

        await teacherBalanceRef.set(
          newBalance
        );

        const teacherTransactionsRef =
          db()
            .ref(
              `users/${order.teacherUid}/wallet/transactions`
            );

        const transactionKey =
          teacherTransactionsRef.push()
            .key;

        await teacherTransactionsRef
          .child(transactionKey)
          .set({
            type:
              'sale',

            orderId:
              oid,

            productId:
              order.productId,

            productTitle:
              order.productTitle,

            amount:
              money(
                order.teacherShare
              ),

            grossAmount:
              money(
                order.price
              ),

            commission:
              money(
                order.siteShare
              ),

            commissionRate:
              COMMISSION_RATE,

            authorRate:
              AUTHOR_RATE,

            status:
              'available',

            createdAt:
              timestamp
          });

        const teacherSalesRef =
          db()
            .ref(
              `users/${order.teacherUid}/sales`
            );

        const saleKey =
          teacherSalesRef.push()
            .key;

        await teacherSalesRef
          .child(saleKey)
          .set({
            orderId:
              oid,

            productId:
              order.productId,

            productTitle:
              order.productTitle,

            buyerUid:
              order.buyerUid,

            buyerEmail:
              order.buyerEmail ||
              '',

            grossAmount:
              money(
                order.price
              ),

            teacherShare:
              money(
                order.teacherShare
              ),

            commission:
              money(
                order.siteShare
              ),

            commissionRate:
              COMMISSION_RATE,

            authorRate:
              AUTHOR_RATE,

            paymentMethod:
              'GoPay',

            goPayPaymentId:
              String(
                providerData.payment_id ||
                  order.goPayPaymentId ||
                  ''
              ),

            createdAt:
              timestamp
          });

        return true;
      }


/*
|--------------------------------------------------------------------------
| GOPAY WEBHOOK
|--------------------------------------------------------------------------
*/

app.post(
  '/api/webhooks/gopay/events',
  (req, res) =>
    json(
      req,
      res,
      async () => {
        const body =
          req.body || {};

        const oid =
          String(
            body.order_id ||
              body.orderId ||
              ''
          );

        if (!oid) {
          return {
            ok: true,
            ignored: true,
            reason:
              'order_id жок.'
          };
        }

        const providerStatus =
          String(
            body.status ||
              body.payment_status ||
              body.state ||
              ''
          ).toUpperCase();

        const successStatuses =
          new Set([
            'PAID',
            'SUCCESS',
            'SUCCEEDED',
            'COMPLETED',
            'COMMITTED',
            'CONFIRMED'
          ]);

        const failedStatuses =
          new Set([
            'FAILED',
            'CANCELED',
            'CANCELLED',
            'EXPIRED',
            'REJECTED',
            'DECLINED'
          ]);

        if (
          successStatuses.has(
            providerStatus
          )
        ) {
          await applyPaidOrder(
            oid,
            body
          );

          return {
            ok: true,
            orderId:
              oid,
            status:
              'paid'
          };
        }

        if (
          failedStatuses.has(
            providerStatus
          )
        ) {
          await db()
            .ref(
              `payment_orders/${oid}`
            )
            .update({
              status:
                'failed',

              goPayStatus:
                providerStatus,

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

            if (
              order.buyerUid &&
              order.productId
            ) {
              await db()
                .ref(
                  `users/${order.buyerUid}/purchases/${order.productId}`
                )
                .update({
                  status:
                    'failed',

                  goPayStatus:
                    providerStatus,

                  updatedAt:
                    now()
                });
            }
          }

          return {
            ok: true,
            orderId:
              oid,
            status:
              'failed'
          };
        }

        await db()
          .ref(
            `payment_orders/${oid}`
          )
          .update({
            goPayStatus:
              providerStatus ||
              'UNKNOWN',

            providerWebhook:
              body,

            updatedAt:
              now()
          });

        return {
          ok: true,
          orderId:
            oid,

          status:
            'received',

          providerStatus
        };
      }
    )
);


/*
|--------------------------------------------------------------------------
| PAYMENT STATUS
|--------------------------------------------------------------------------
*/

app.get(
  '/api/payments/status',
  (req, res) =>
    json(
      req,
      res,
      async () => {
        const user =
          await bearerUser(req);

        const oid =
          String(
            req.query.order ||
              req.query.orderId ||
              ''
          );

        const productId =
          String(
            req.query.productId ||
              ''
          );

        if (
          !oid &&
          !productId
        ) {
          fail(
            'order же productId керек.'
          );
        }

        let order = null;

        if (oid) {
          const snapshot =
            await db()
              .ref(
                `payment_orders/${oid}`
              )
              .once('value');

          if (
            snapshot.exists()
          ) {
            order =
              snapshot.val();
          }
        }

        if (
          !order &&
          productId
        ) {
          const snapshot =
            await db()
              .ref(
                `users/${user.uid}/purchases/${productId}`
              )
              .once('value');

          if (
            snapshot.exists()
          ) {
            const purchase =
              snapshot.val();

            if (
              purchase.orderId
            ) {
              const orderSnapshot =
                await db()
                  .ref(
                    `payment_orders/${purchase.orderId}`
                  )
                  .once('value');

              if (
                orderSnapshot.exists()
              ) {
                order =
                  orderSnapshot.val();
              }
            }
          }
        }

        if (!order) {
          return {
            ok: true,

            found:
              false,

            status:
              'not_found'
          };
        }

        if (
          order.buyerUid !==
          user.uid
        ) {
          fail(
            'Бул төлөмдү көрүүгө уруксат жок.',
            403
          );
        }

        let provider =
          null;

        if (
          order.goPayPaymentId
        ) {
          try {
            provider =
              await goPayPost(
                '/v1/payments/query',
                {
                  payment_id:
                    order.goPayPaymentId,

                  order_id:
                    order.orderId
                }
              );
          } catch (
            providerError
          ) {
            provider =
              {
                error:
                  providerError.message
              };
          }
        }

        const purchaseSnapshot =
          await db()
            .ref(
              `users/${user.uid}/purchases/${order.productId}`
            )
            .once('value');

        const purchase =
          purchaseSnapshot.exists()
            ? purchaseSnapshot.val()
            : null;

        return {
          ok: true,

          found:
            true,

          orderId:
            order.orderId,

          productId:
            order.productId,

          status:
            order.status,

          goPayStatus:
            order.goPayStatus ||
            null,

          paymentId:
            order.goPayPaymentId ||
            null,

          redirectUrl:
            order.checkoutUrl ||
            null,

          price:
            money(order.price),

          teacherShare:
            money(
              order.teacherShare
            ),

          commission:
            money(
              order.siteShare
            ),

          purchaseStatus:
            purchase?.status ||
            null,

          expiresAt:
            purchase?.expiresAt ||
            order.expiresAt ||
            null,

          provider
        };
      }
    )
);


/*
|--------------------------------------------------------------------------
| ADD PAYOUT METHOD
|--------------------------------------------------------------------------
*/

app.post(
  '/api/cards/add',
  (req, res) =>
    json(
      req,
      res,
      async () => {
        const user =
          await bearerUser(req);

        const type =
          String(
            req.body?.type ||
              ''
          ).trim();

        const value =
          String(
            req.body?.value ||
              ''
          ).trim();

        const title =
          String(
            req.body?.title ||
              ''
          ).trim();

        if (!type) {
          fail(
            'Реквизиттин түрү керек.'
          );
        }

        if (!value) {
          fail(
            'Реквизит керек.'
          );
        }

        const allowedTypes =
          new Set([
            'mbank',
            'card',
            'wallet'
          ]);

        if (
          !allowedTypes.has(
            type
          )
        ) {
          fail(
            'Реквизиттин түрү туура эмес.'
          );
        }

        const safeValue =
          value
            .replace(
              /\s+/g,
              ' '
            )
            .trim();

        const ref =
          db()
            .ref(
              `users/${user.uid}/payoutMethods`
            );

        const key =
          ref.push().key;

        const record = {
          id:
            key,

          type:
            type,

          title:
            title ||
            type,

          value:
            safeValue,

          createdAt:
            now(),

          updatedAt:
            now(),

          status:
            'active'
        };

        await ref
          .child(key)
          .set(record);

        return {
          ok: true,

          method:
            record
        };
      }
    )
);


/*
|--------------------------------------------------------------------------
| LIST PAYOUT METHODS
|--------------------------------------------------------------------------
*/

app.get(
  '/api/cards',
  (req, res) =>
    json(
      req,
      res,
      async () => {
        const user =
          await bearerUser(req);

        const snapshot =
          await db()
            .ref(
              `users/${user.uid}/payoutMethods`
            )
            .once('value');

        const value =
          snapshot.val() ||
          {};

        const methods =
          Object.entries(
            value
          )
            .map(
              ([id, item]) => ({
                id,
                ...item
              })
            )
            .filter(
              (item) =>
                item.status !==
                'deleted'
            )
            .sort(
              (a, b) =>
                Number(
                  b.createdAt ||
                    0
                ) -
                Number(
                  a.createdAt ||
                    0
                )
            );

        return {
          ok: true,

          methods
        };
      }
    )
);


/*
|--------------------------------------------------------------------------
| DELETE PAYOUT METHOD
|--------------------------------------------------------------------------
*/

app.delete(
  '/api/cards/:id',
  (req, res) =>
    json(
      req,
      res,
      async () => {
        const user =
          await bearerUser(req);

        const id =
          String(
            req.params.id
          );

        if (!id) {
          fail(
            'Реквизиттин ID керек.'
          );
        }

        const ref =
          db()
            .ref(
              `users/${user.uid}/payoutMethods/${id}`
            );

        const snapshot =
          await ref.once(
            'value'
          );

        if (
          !snapshot.exists()
        ) {
          fail(
            'Реквизит табылган жок.',
            404
          );
        }

        await ref.update({
          status:
            'deleted',

          deletedAt:
            now()
        });

        return {
          ok: true
        };
      }
    )
);
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
