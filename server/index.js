const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const config = require('./config/config');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: config.FIREBASE_DATABASE_URL
  });
}

const paymentRoutes = require('./routes/payment');
const payoutRoutes = require('./routes/payout');
const adminRoutes = require('./routes/admin');

app.use('/api/payment', paymentRoutes);
app.use('/api/payout', payoutRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', mode: config.PAYMENT_MODE, timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ success: false, message: 'Убактылуу техникалык ката чыкты. Кайра аракет кылып көрүңүз.' });
});

app.listen(config.PORT, () => {
  console.log(`Bilimal Backend Сервери ${config.PORT} портунда иштеп жатат. Режим: ${config.PAYMENT_MODE}`);
});
