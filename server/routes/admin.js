const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.database();

const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Авторизация талап кылынат' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const userSnap = await db.ref(`users/${decoded.uid}`).once('value');
    if (!userSnap.exists() || userSnap.val().role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Администратордук укук жок' });
    }
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Сессия катасы' });
  }
};

router.post('/approve-payout', verifyAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.body;
    const wRef = db.ref(`marketplace/withdrawals/${withdrawalId}`);
    const wSnap = await wRef.once('value');

    if (!wSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Арыз табылган жок' });
    }

    const withdrawal = wSnap.val();
    if (withdrawal.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Бул төлөм мурда эле төлөнгөн' });
    }

    const now = Date.now();
    await wRef.update({
      status: 'PAID',
      paidAt: now,
      paidBy: req.user.uid
    });

    const auditRef = db.ref('marketplace/auditLogs').push();
    await auditRef.set({
      adminId: req.user.uid,
      action: 'PAYOUT_APPROVED',
      targetUserId: withdrawal.authorId,
      amount: withdrawal.amount,
      reason: 'Manual admin payout completed',
      timestamp: now
    });

    res.json({ success: true, message: 'Төлөм ийгиликтүү ырасталды' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Төлөмдү ырастоодо ката чыкты' });
  }
});

router.post('/adjust-balance', verifyAdmin, async (req, res) => {
  try {
    const { targetUserId, amount, reason } = req.body;
    if (!targetUserId || amount === undefined || !reason) {
      return res.status(400).json({ success: false, message: 'Себеби жана суммасы ачык жазылышы керек' });
    }

    const balRef = db.ref(`marketplace/authorBalances/${targetUserId}`);
    const balSnap = await balRef.once('value');
    const oldBalance = balSnap.exists() ? (balSnap.val().availableBalance || 0) : 0;
    const newBalance = parseFloat((oldBalance + parseFloat(amount)).toFixed(2));

    await balRef.update({
      availableBalance: newBalance,
      updatedAt: Date.now()
    });

    const auditRef = db.ref('marketplace/auditLogs').push();
    await auditRef.set({
      adminId: req.user.uid,
      action: 'MANUAL_ADJUSTMENT',
      targetUserId,
      amount,
      oldBalance,
      newBalance,
      reason,
      timestamp: Date.now()
    });

    res.json({ success: true, message: 'Баланс кол менен туураланды' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Баланс өзгөртүүдө ката чыкты' });
  }
});

module.exports = router;
