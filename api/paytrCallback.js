// api/paytrCallback.js
const crypto = require("crypto");

const MERCHANT_KEY = process.env.PAYTR_MERCHANT_KEY;
const MERCHANT_SALT = process.env.PAYTR_MERCHANT_SALT;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    // PayTR genelde x-www-form-urlencoded gönderir; Vercel body'i otomatik parse eder (Next.js edge olmayan runtime)
    const post = req.body || {};
    const { merchant_oid, status, total_amount, hash } = post;

    if (!merchant_oid || !status || !total_amount || !hash) {
      console.log("MISSING_FIELDS:", post);
      return res.status(400).send("MISSING_FIELDS");
    }

    const hashStr = merchant_oid + MERCHANT_SALT + status + total_amount;
    const token = crypto.createHmac("sha256", MERCHANT_KEY).update(hashStr).digest("base64");

    if (token !== hash) {
      console.log("INVALID_HASH", { expected: token, got: hash });
      return res.status(400).send("INVALID_HASH");
    }

    if (status === "success") {
      console.log("✅ SUCCESS:", merchant_oid, "amount:", total_amount);
      // TODO: burada siparişi onayla / premiumu aç / vitrin uzat
    } else {
      console.log("❌ FAILED:", merchant_oid);
      // TODO: başarısız işlem kaydı
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("paytrCallback error:", err?.message || err);
    return res.status(500).send("ERROR");
  }
};
