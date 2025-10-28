// api/getPaytrToken.js 
const crypto = require("crypto");

// İzinli origin listesi (CORS)
const ALLOWED = [
  "https://üreteneller.com",
  "https://www.üreteneller.com",
  "https://xn--reteneller-vob.com",
  "https://www.xn--reteneller-vob.com",
  "https://xn--reteneller-8db.com",
  "https://www.xn--reteneller-8db.com",
  "https://ureteneller.com",
  "https://www.ureteneller.com"
];

const MERCHANT_ID = process.env.PAYTR_MERCHANT_ID;
const MERCHANT_KEY = process.env.PAYTR_MERCHANT_KEY;
const MERCHANT_SALT = process.env.PAYTR_MERCHANT_SALT;

function setCors(res, origin) {
  const allow = ALLOWED.includes(origin) ? origin : ALLOWED[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ... üstteki require ve sabitler aynı kalsın

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  setCors(res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();

  // ⬇️ DEBUG BLOĞU (GEÇİCİ)
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.searchParams.get("debug") === "1") {
      return res.status(200).json({
        ok: true,
        node: process.version,
        hasEnv: {
          id: !!process.env.PAYTR_MERCHANT_ID,
          key: !!process.env.PAYTR_MERCHANT_KEY,
          salt: !!process.env.PAYTR_MERCHANT_SALT
        },
        bodyType: typeof req.body,
        contentType: req.headers["content-type"] || null
      });
    }
  } catch (e) {
    return res.status(200).json({ ok: false, debugErr: e?.message });
  }
  // ⬆️ DEBUG BLOĞU (GEÇİCİ)
