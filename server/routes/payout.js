const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const config = require('../config/config');

const db = admin.database();

const verifyAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Авторизация талап кылынат' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Сессия жараксыз' });
  }
};

router.post('/save-details', verifyAuth, async (req, res) => {
  try {
    const { payoutMethod, bankName, accountIdentifier, recipientName } = req.body;
    if (!payoutMethod || !accountIdentifier || !recipientName) {
      return res.status(400).json({ success: false, message: 'Маалыматтарды толук киргизиңиз' });
    }

    const maskedAccount = accountIdentifier.length > 8
      ? accountIdentifier.substring(0, 4) + '****' + accountIdentifier.substring(accountIdentifier.length - 4)
      : '****' + accountIdentifier.substring(accountIdentifier.length - 2);

    await db.ref(`marketplace/authorBalances/${req.user.uid}/payoutDetails`).set({
      payoutMethod,
      bankName: bankName || 'Башка банк',
      accountIdentifier: maskedAccount,
      recipientName,
      updatedAt: Date.now()
    });

    res.json({ success: true, message: 'Төлөм реквизиттери сакталды' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Реквизиттерди сактоодо ката чыкты' });
  }
});

router.post('/request-withdrawal', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const balanceSnap = await db.ref(`marketplace/authorBalances/${userId}`).once('value');

    if (!balanceSnap.exists()) {
      return res.status(400).json({ success: false, message: 'Баланс табылган жок' });
    }

    const balanceData = balanceSnap.val();
    const available = balanceData.availableBalance || 0;

    if (available < config.MIN_PAYOUT_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Минималдуу чыгаруу суммасы — ${config.MIN_PAYOUT_AMOUNT} сом. Сизде: ${available} сом.`
      });
    }

    if (!balanceData.payoutDetails) {
      return res.status(400).json({ success: false, message: 'Алгач төлөм реквизиттериңизди толтуруңуз' });
    }

    const userSnap = await db.ref(`users/${userId}`).once('value');
    const userName = userSnap.exists() ? (userSnap.val().fullName || userSnap.val().email) : 'Мугалим';

    const withdrawalRef = db.ref('marketplace/withdrawals').push();
    const withdrawalId = withdrawalRef.key;
    const now = Date.now();

    const withdrawalData = {
      withdrawalId,
      authorId: userId,
      authorName: userName,
      amount: available,
      payoutDetails: balanceData.payoutDetails,
      status: 'PENDING',
      requestedAt: now
    };

    await db.ref(`marketplace/authorBalances/${userId}`).update({
      availableBalance: 0,
      updatedAt: now
    });

    await withdrawalRef.set(withdrawalData);

    const txRef = db.ref('marketplace/transactions').push();
    await txRef.set({
      transactionId: txRef.key,
      type: 'PAYOUT',
      userId,
      authorId: userId,
      amount: available,
      commission: 0,
      status: 'PENDING',
      createdAt: now
    });

    res.json({ success: true, message: 'Акча чыгарууга арыз ийгиликтүү жөнөтүлдү', withdrawal: withdrawalData });
  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({ success: false, message: 'Акча чыгаруу арызын түзүүдө ката чыкты' });
  }
});

module.exports = router;
