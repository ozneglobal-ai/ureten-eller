const functions = require("firebase-functions");
const crypto = require("crypto");
const axios = require("axios");
const bodyParser = require("body-parser");

// PayTR config
const { merchant_id, merchant_key, merchant_salt } = functions.config().paytr || {};

const parseJson = bodyParser.json();
const parseUrlEncoded = bodyParser.urlencoded({ extended: false });

// 1) PAYTR iFrame TOKEN OLUŞTURMA
exports.getPaytrToken = functions.https.onRequest(async (req, res) => {
  try {
    await new Promise((resolve, reject) =>
      parseJson(req, res, (err) => (err ? reject(err) : resolve()))
    );

    const {
      email,
      payment_amount,
      user_ip,
      merchant_oid,
      user_name,
      user_address,
      user_phone,
      test_mode = 0,
      no_installment = 0,
      max_installment = 12,
      currency = "TL",
    } = req.body || {};

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({ status: "error", reason: "Missing PayTR config" });
    }
    if (!email || !payment_amount || !user_ip || !merchant_oid) {
      return res.status(400).json({ status: "error", reason: "Missing required fields" });
    }

    const user_basket = Buffer
      .from(JSON.stringify([[merchant_oid, Number(payment_amount), 1]]))
      .toString("base64");

    const hash_str =
      merchant_id +
      user_ip +
      merchant_oid +
      email +
      payment_amount +
      user_basket +
      no_installment +
      max_installment +
      currency +
      test_mode +
      merchant_salt;

    const paytr_token = crypto
      .createHmac("sha256", merchant_key)
      .update(hash_str)
      .digest("base64");

    const data = {
      merchant_id,
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

    const resp = await axios.post("https://www.paytr.com/odeme/api/get-token", data, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    return res.status(200).json(resp.data);
  } catch (err) {
    console.error("getPaytrToken error:", err?.response?.data || err.message);
    return res.status(500).json({ status: "error", reason: "TOKEN_CREATE_FAILED" });
  }
});

// 2) CALLBACK (BİLDİRİM) ENDPOINT
exports.paytrCallback = functions.https.onRequest(async (req, res) => {
  try {
    await new Promise((resolve, reject) =>
      parseUrlEncoded(req, res, (err) => (err ? reject(err) : resolve()))
    );

    const post = req.body || {};
    const { merchant_oid, status, total_amount, hash } = post;

    if (!merchant_oid || !status || !total_amount || !hash) {
      console.log("Callback missing fields:", post);
      return res.status(400).send("MISSING_FIELDS");
    }

    const hashStr = merchant_oid + merchant_salt + status + total_amount;
    const token = crypto
      .createHmac("sha256", merchant_key)
      .update(hashStr)
      .digest("base64");

    if (token !== hash) {
      console.log("❌ INVALID_HASH for", merchant_oid);
      return res.status(400).send("INVALID_HASH");
    }

    if (status === "success") {
      console.log("✅ SUCCESS payment:", merchant_oid, "amount:", total_amount);
      // TODO: burada siparişi onayla / premiumu aç / vitrin süresini uzat
    } else {
      console.log("❌ FAILED payment:", merchant_oid);
      // TODO: başarısız işlemi kaydet
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("paytrCallback error:", err?.message);
    return res.status(500).send("ERROR");
  }
});
