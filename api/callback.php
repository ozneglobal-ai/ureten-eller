<?php
// api/callback.php
// PayTR ödeme sonucu bildirimi (server-to-server).

$MERCHANT_KEY  = "B5saZnTNPEGbgd4B";
$MERCHANT_SALT = "WxDQ8TQjkBuM17fr";

// PayTR form-encoded POST gönderir
$post = $_POST ?? [];
$merchant_oid = $post['merchant_oid'] ?? null;
$status       = $post['status'] ?? null;
$total_amount = $post['total_amount'] ?? null;
$hash         = $post['hash'] ?? null;

if (!$merchant_oid || !$status || !$total_amount || !$hash) {
  http_response_code(400);
  echo "MISSING_FIELDS";
  exit;
}

// Hash doğrulama
$calc = base64_encode(hash_hmac('sha256', $merchant_oid.$MERCHANT_SALT.$status.$total_amount, $MERCHANT_KEY, true));
if ($calc !== $hash) {
  // Geçersiz istek
  http_response_code(400);
  echo "INVALID_HASH";
  exit;
}

// Başarılı/başarısız işaretle (burada kendi veritabanı işlemlerini yap)
$log = __DIR__ . '/paytr_log.txt';
$line = date('Y-m-d H:i:s') . " | {$status} | oid={$merchant_oid} | amount={$total_amount}\n";
file_put_contents($log, $line, FILE_APPEND);

// PayTR OK bekler (yoksa tekrar gönderir)
echo "OK";
