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

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  setCors(res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const {
      email, payment_amount, user_ip, merchant_oid,
      user_name, user_address, user_phone,
      test_mode = 0, no_installment = 0, max_installment = 12, currency = "TL",
    } = req.body || {};

    if (!MERCHANT_ID || !MERCHANT_KEY || !MERCHANT_SALT) {
      return res.status(500).json({ status: "error", reason: "Missing PayTR config" });
    }
    if (!email || !payment_amount || !user_ip || !merchant_oid) {
      return res.status(400).json({ status: "error", reason: "Missing required fields" });
    }

    const user_basket = Buffer.from(JSON.stringify([[merchant_oid, Number(payment_amount), 1]])).toString("base64");

    const hash_str =
      MERCHANT_ID + user_ip + merchant_oid + email + payment_amount +
      user_basket + no_installment + max_installment + currency + test_mode + MERCHANT_SALT;

    const paytr_token = crypto.createHmac("sha256", MERCHANT_KEY).update(hash_str).digest("base64");

    const payload = {
      merchant_id: MERCHANT_ID,
      user_ip,
      merchant_oid,
      email,
      payment_amount,
      paytr_token,
      user_basket,
      no_installment,
      max_installment,
      currency,
      test_mode,
      user_name,
      user_address,
      user_phone,
      merchant_ok_url: "https://üreteneller.com/odeme-basarili.html",
      merchant_fail_url: "https://üreteneller.com/odeme-hata.html",
    };

    const resp = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // PayTR bazen text döndürebiliyor; önce JSON dene, olmazsa text’i wrap’le
    let data;
    const text = await resp.text();
    try { data = JSON.parse(text); }
    catch { data = { status: "error", reason: text || "NON_JSON_RESPONSE" }; }

    if (!resp.ok) {
      return res.status(500).json({ status: "error", reason: data.reason || data || "TOKEN_CREATE_FAILED" });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ status: "error", reason: err?.message || "TOKEN_CREATE_FAILED" });
  }
};
