/**
 * Üreten Eller – Firebase Functions (PayTR Pazaryeri / Escrow)
 * - createOrder: Sipariş oluşturur, sıra no (orderNo) üretir, merchant_oid verir
 * - getPaytrToken: PayTR token alır (frontend, merchant_oid olarak orderCode gönderin)
 * - paytrCallback: PayTR callback -> siparişi HELD (emanet) statüsüne çeker
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const axios = require("axios");
const bodyParser = require("body-parser");

// ==== CORS Helper ====
const ALLOWED_ORIGINS = new Set([
  'https://xn--reteneller-8db.com',
  'https://www.xn--reteneller-8db.com'
]);

function corsReply(req, res) {
  const origin = req.headers.origin || '';
  if (
      
        ALLOWED_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  const acrh = req.headers['access-control-request-headers'] || 'Content-Type, Authorization';
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', acrh);
  res.set('Access-Control-Max-Age', '3600');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
  return false;
}

// --- Firebase Admin ---
try { admin.initializeApp(); } catch (_) {}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// --- Body parsers ---
const parseJson = bodyParser.json();
const parseUrlEncoded = bodyParser.urlencoded({ extended: false });

// --- PayTR Config ---
const { merchant_id, merchant_key, merchant_salt } = functions.config().paytr || {};

// ===============================
// Helpers
// ===============================

// Atomik sipariş sırası (1,2,3…)
async function getNextOrderNo() {
  const ref = db.collection("_meta").doc("counters");
  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = (snap.exists && (snap.data().orderSeq || 0)) || 0;
    const n = cur + 1;
    tx.set(ref, { orderSeq: n }, { merge: true });
    return n;
  });
  return next;
}

// Görsel kod: UE-YYYYMMDD-000123
function formatOrderCode(seq) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `UE-${y}${m}${day}-${String(seq).padStart(6, "0")}`;
}

// merchant_oid ile tek sipariş bul
async function findOrderByOid(merchant_oid) {
  const q = await db
    .collection("orders")
    .where("merchant_oid", "==", merchant_oid)
    .limit(1)
    .get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { id: doc.id, data: doc.data() };
}

exports.createOrder = functions.https.onRequest(async (req, res) => {
  if (corsReply(req, res)) return;


  try {
    if (req.method !== "POST") {
      return res.status(405).json({ status: "error", reason: "METHOD_NOT_ALLOWED" });
    }

    await new Promise((resolve, reject) =>
      parseJson(req, res, (e) => (e ? reject(e) : resolve()))
    );

    const {
      listingId, sellerId, price, currency = "TRY",
      buyerId, qty = 1, phone = "", note = "",
      address = "", deliveryMethod = "pickup",
      title = "", cover = ""
    } = req.body || {};

    if (!listingId || !sellerId || !buyerId || !price) {
      return res.status(400).json({ status: "error", reason: "MISSING_FIELDS" });
    }

    // sıra no + kod
    const seq = await getNextOrderNo();
    const orderNo = seq; // sayısal
    const orderCode = formatOrderCode(seq); // kullanıcıya gösterilecek
    const merchant_oid = orderCode; // PayTR sipariş ID olarak kullanacağız

    const now = FieldValue.serverTimestamp();

    const doc = {
      orderNo,
      orderCode,
      merchant_oid,

      listingId,
      sellerId,
      buyerId,

      listingTitle: title || "İlan",
      listingCover: cover || "",

      price: Number(price),
      currency,
      qty: Number(qty) || 1,

      phone,
      note,
      address,
      deliveryMethod, // 'pickup' | 'cargo'

      status: "PENDING_PAYMENT",             // ödeme bekleniyor
      createdAt: now,
      updatedAt: now,

      paytr: { initiated: false }            // token alındığında true çekebilirsin
    };

    const ref = await db.collection("orders").add(doc);

    return res.status(200).json({
      status: "ok",
      orderId: ref.id,
      orderNo,
      orderCode,
      merchant_oid
    });
  } catch (e) {
    console.error("createOrder error:", e);
    return res.status(500).json({ status: "error", reason: "CREATE_ORDER_FAILED" });
  }
});

// ===============================
// 1️⃣ PayTR Token Oluşturma
// ===============================
exports.getPaytrToken = functions.https.onRequest(async (req, res) => {
      if (corsReply(req, res)) return;
  try {
    await new Promise((resolve, reject) =>
      parseJson(req, res, (err) => (err ? reject(err) : resolve()))
    );

    const {
      email, payment_amount, user_ip, merchant_oid,
      user_name, user_address, user_phone,
      test_mode = 0, no_installment = 0, max_installment = 12, currency = "TL"
    } = req.body || {};

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({ status: "error", reason: "Missing PayTR config" });
    }
    if (!email || !payment_amount || !user_ip || !merchant_oid) {
      return res.status(400).json({ status: "error", reason: "Missing required fields" });
    }

    // Basit sepet (tek kalem: merchant_oid)
    const user_basket = Buffer.from(
      JSON.stringify([[merchant_oid, Number(payment_amount), 1]])
    ).toString("base64");

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
      merchant_ok_url: "https://www.xn--reteneller-8db.com/odeme-ok.html",
      merchant_fail_url: "https://www.xn--reteneller-8db.com/odeme-hata.html"

    };

    // Not: PayTR çoğunlukla x-www-form-urlencoded ister;
    // burada JSON ile de çalışıyorsa bırakıyoruz.
    const resp = await axios.post(
      "https://www.paytr.com/odeme/api/get-token",
      data,
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );

    // İsteğe bağlı: ilgili order.paytr.initiated=true işaretlemek
    try {
      const order = await findOrderByOid(merchant_oid);
      if (order) {
        await db.doc(`orders/${order.id}`).set(
          {
            paytr: {
              initiated: true,
              lastTokenResp: resp.data || null
            },
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }
    } catch (_) {}

    return res.status(200).json(resp.data);
  } catch (err) {
    console.error("getPaytrToken error:", err?.response?.data || err.message);
    return res.status(500).json({ status: "error", reason: "TOKEN_CREATE_FAILED" });
  }
});

// ===============================
// 2️⃣ PayTR Callback (İşlem sonucu bildirimi)
// ===============================
exports.paytrCallback = functions.https.onRequest(async (req, res) => {
      if (corsReply(req, res)) return;
  try {
    await new Promise((resolve, reject) =>
      parseUrlEncoded(req, res, (err) => (err ? reject(err) : resolve()))
    );

    const post = req.body || {};
    const { merchant_oid, status, total_amount, hash } = post;

    if (!merchant_oid || !status || !total_amount || !hash) {
      return res.status(400).send("MISSING_FIELDS");
    }

    // İmza kontrolü
    const hashStr = merchant_oid + merchant_salt + status + total_amount;
    const token = crypto
      .createHmac("sha256", merchant_key)
      .update(hashStr)
      .digest("base64");

    if (token !== hash) {
      console.warn("paytrCallback INVALID_HASH", merchant_oid);
      return res.status(400).send("INVALID_HASH");
    }

    // Siparişi bul
    const order = await findOrderByOid(merchant_oid);

    if (status === "success") {
      // Escrow akışı: para PayTR’de, biz “HELD” olarak işaretliyoruz.
      if (order) {
        await db.doc(`orders/${order.id}`).set(
          {
            status: "HELD", // emanet
            paytr: {
              ...(order.data.paytr || {}),
              paid: true,
              total_amount: Number(total_amount) || 0,
              callbackStatus: status,
              callbackAt: FieldValue.serverTimestamp()
            },
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      } else {
        console.warn("paytrCallback: order not found for", merchant_oid);
      }

      console.log("✅ SUCCESS payment:", merchant_oid, "amount:", total_amount);
      // PayTR OK cevabı
      return res.status(200).send("OK");
    } else {
      // Ödeme başarısız
      if (order) {
        await db.doc(`orders/${order.id}`).set(
          {
            status: "FAILED",
            paytr: {
              ...(order.data.paytr || {}),
              paid: false,
              total_amount: Number(total_amount) || 0,
              callbackStatus: status,
              callbackAt: FieldValue.serverTimestamp()
            },
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }

      console.log("❌ FAILED payment:", merchant_oid);
      return res.status(200).send("OK");
    }
  } catch (err) {
    console.error("paytrCallback error:", err?.message);
    // PayTR tekrar gönderebilir; 500 yerine 200 dönmek isteyebilirsiniz.
    return res.status(500).send("ERROR");
  }
});
