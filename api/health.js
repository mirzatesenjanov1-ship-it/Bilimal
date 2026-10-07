export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    service: 'bilimal-market-api',
    provider: 'GoPay',
    time: new Date().toISOString()
  });
}
