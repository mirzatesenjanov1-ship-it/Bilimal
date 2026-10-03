const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const config = require('../config/config');

const db = admin.database();

router.post('/create-order', async (req, res) => {
  try {
    const { buyerId, productId } = req.body;
    if (!buyerId || !productId) {
      return res.status(400).json({ success: false, message: 'Маалыматтар толук эмес' });
    }

    const productSnap = await db.ref(`marketplace/products/${productId}`).once('value');
    if (!productSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Материал табылган жок' });
    }

    const product = productSnap.val();
    if (product.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Бул материал сатууга даяр эмес' });
    }

    const amount = parseFloat(product.price);
    const commissionPercent = config.PLATFORM_COMMISSION_PERCENT;
    const commissionAmount = parseFloat(((amount * commissionPercent) / 100).toFixed(2));
    const authorAmount = parseFloat((amount - commissionAmount).toFixed(2));

    const orderRef = db.ref('marketplace/orders').push();
    const orderId = orderRef.key;

    const orderData = {
      orderId,
      buyerId,
      authorId: product.authorId,
      productId,
      productTitle: product.title,
      amount,
      commissionPercent,
      commissionAmount,
      authorAmount,
      currency: 'KGS',
      paymentProvider: config.PAYMENT_MODE === 'test' ? 'MOCK_PROVIDER' : 'MERCHANT_BANK',
      paymentId: `PAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      status: 'CREATED',
      createdAt: admin.database.ServerValue.TIMESTAMP
    };

    await orderRef.set(orderData);

    let paymentUrl = '';
    if (config.PAYMENT_MODE === 'test') {
      paymentUrl = `/mock-payment.html?orderId=${orderId}&amount=${amount}`;
    } else {
      paymentUrl = `https://merchant.bank.kg/pay?merchant_id=bilimal&order_id=${orderId}&amount=${amount}`;
    }

    res.json({ success: true, orderId, paymentUrl, order: orderData });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, message: 'Төлөм заказ түзүүдө ката чыкты.' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { orderId, paymentId, status, receivedAmount, signature } = req.body;

    if (config.PAYMENT_MODE !== 'test') {
      const expectedSignature = crypto
        .createHmac('sha256', config.PAYMENT_WEBHOOK_SECRET)
        .update(`${orderId}|${paymentId}|${receivedAmount}|${status}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).json({ success: false, message: 'Төлөм колтамгасы туура келбейт' });
      }
    }

    const orderRef = db.ref(`marketplace/orders/${orderId}`);
    const orderSnap = await orderRef.once('value');

    if (!orderSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Заказ табылган жок' });
    }

    const order = orderSnap.val();

    if (order.status === 'PAID') {
      return res.status(200).json({ success: true, message: 'Заказ мурда эле аткарылган (Idempotent)' });
    }

    if (parseFloat(receivedAmount) < parseFloat(order.amount)) {
      await orderRef.update({ status: 'FAILED', failureReason: 'Күтүлгөн суммадан аз алат' });
      return res.status(400).json({ success: false, message: 'Төлөнгөн сумма жетишсиз' });
    }

    if (status !== 'SUCCESS' && status !== 'PAID') {
      await orderRef.update({ status: 'FAILED' });
      return res.status(200).json({ success: true, message: 'Төлөм аткарылган жок деп сакталды' });
    }

    const now = Date.now();
    await orderRef.update({
      status: 'PAID',
      paymentId: paymentId || order.paymentId,
      paidAt: now
    });

    const authorBalanceRef = db.ref(`marketplace/authorBalances/${order.authorId}`);
    await authorBalanceRef.transaction((current) => {
      if (!current) {
        return {
          pendingBalance: order.authorAmount,
          availableBalance: 0,
          totalEarned: order.authorAmount,
          totalSales: order.amount,
          salesCount: 1,
          updatedAt: now
        };
      }
      return {
        ...current,
        pendingBalance: parseFloat(((current.pendingBalance || 0) + order.authorAmount).toFixed(2)),
        totalEarned: parseFloat(((current.totalEarned || 0) + order.authorAmount).toFixed(2)),
        totalSales: parseFloat(((current.totalSales || 0) + order.amount).toFixed(2)),
        salesCount: (current.salesCount || 0) + 1,
        updatedAt: now
      };
    });

    const txSaleRef = db.ref('marketplace/transactions').push();
    await txSaleRef.set({
      transactionId: txSaleRef.key,
      type: 'AUTHOR_EARNING',
      orderId: orderId,
      userId: order.buyerId,
      authorId: order.authorId,
      amount: order.authorAmount,
      commission: order.commissionAmount,
      status: 'COMPLETED',
      createdAt: now
    });

    const txCommRef = db.ref('marketplace/transactions').push();
    await txCommRef.set({
      transactionId: txCommRef.key,
      type: 'COMMISSION',
      orderId: orderId,
      userId: order.buyerId,
      authorId: order.authorId,
      amount: order.commissionAmount,
      commission: order.commissionAmount,
      status: 'COMPLETED',
      createdAt: now
    });

    await db.ref(`purchases/${order.buyerId}/${order.productId}`).set({
      purchasedAt: now,
      orderId: orderId,
      amount: order.amount
    });

    res.status(200).json({ success: true, message: 'Төлөм ийгиликтүү иштетилди' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook иштетүүдө ката чыкты' });
  }
});

router.post('/simulate-test-payment', async (req, res) => {
  if (config.PAYMENT_MODE !== 'test') {
    return res.status(403).json({ success: false, message: 'Test mode активдүү эмес' });
  }
  const { orderId } = req.body;
  const orderSnap = await db.ref(`marketplace/orders/${orderId}`).once('value');
  if (!orderSnap.exists()) {
    return res.status(404).json({ success: false, message: 'Order табылган жок' });
  }
  const order = orderSnap.val();

  return router.handle(
    {
      method: 'POST',
      url: '/webhook',
      body: {
        orderId: order.orderId,
        paymentId: `TEST_PAY_${Date.now()}`,
        status: 'SUCCESS',
        receivedAmount: order.amount,
        signature: 'TEST'
      }
    },
    res
  );
});

module.exports = router;
