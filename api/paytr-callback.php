<?php
// api/callback.php  — PayTR server-to-server bildirim doğrulama

// --- MAĞAZA BİLGİLERİN (aynen token.php’deki gibi) ---
$MERCHANT_KEY  = "B5saZnTNPEGbgd4B";
$MERCHANT_SALT = "WxDQ8TQjkBuM17fr";

// Sadece POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  exit('Method Not Allowed');
}

// PayTR’ın gönderdiği alanlar
$merchant_oid = $_POST['merchant_oid'] ?? null;
$status       = $_POST['status']       ?? null;   // success | failed
$total_amount = isset($_POST['total_amount']) ? (int)$_POST['total_amount'] : null; // kuruş
$hash         = $_POST['hash']         ?? null;

// Zorunlu alan kontrol
if (!$merchant_oid || !$status || !$hash) {
  http_response_code(400);
  exit('MISSING_FIELDS');
}

// Hash doğrulama (PayTR dokümantasyonuna göre)
$calc = base64_encode(hash_hmac('sha256', $merchant_oid . $MERCHANT_SALT . $status . $total_amount, $MERCHANT_KEY, true));
if (!hash_equals($calc, $hash)) {
  http_response_code(403);
  exit('INVALID_HASH');
}

// ▶︎ BURADA siparişi işaretle (DB: paid/failed vs.)
// $status === 'success' -> ödemeyi onayla
// $status === 'failed'  -> başarısız kaydı

// PayTR tekrar bildirim göndermesin diye "OK" yazıp 200 dönmek ZORUNLU
echo "OK";
