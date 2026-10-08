export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      message: "Method Not Allowed"
    });
  }

  return res.status(200).json({
    ok: true,
    service: "bilimal-market-api",
    status: "online",
    timestamp: new Date().toISOString()
  });
}
