require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  PAYMENT_MODE: process.env.PAYMENT_MODE || 'test',
  PLATFORM_COMMISSION_PERCENT: parseFloat(process.env.PLATFORM_COMMISSION_PERCENT) || 21,
  PAYOUT_HOLD_DAYS: parseInt(process.env.PAYOUT_HOLD_DAYS) || 3,
  MIN_PAYOUT_AMOUNT: parseFloat(process.env.MIN_PAYOUT_AMOUNT) || 100,
  PAYMENT_API_KEY: process.env.PAYMENT_API_KEY || 'test_api_key',
  PAYMENT_SECRET: process.env.PAYMENT_SECRET || 'test_secret_key',
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || 'test_webhook_secret',
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || 'https://bilimal-default-rtdb.firebaseio.com'
};
