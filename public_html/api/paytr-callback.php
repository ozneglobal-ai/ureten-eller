<?php
// /api/paytr-callback.php — PayTR bildirim kontrolü (server-to-server)

$MERCHANT_KEY  = "B5saZnTNPEGbgd4B";
$MERCHANT_SALT = "WxDQ8TQjkBuM17fr";

function post($k,$d=null){ return $_POST[$k] ?? $d; }

$hash    = post('hash');
$status  = post('status'); // success / failed
$total   = post('total_amount');
$oid     = post('merchant_oid');

$calc = base64_encode(hash_hmac('sha256', $oid.$MERCHANT_SALT.post('status'), $MERCHANT_KEY, true));
if ($calc !== $hash) {
  header("HTTP/1.1 401 Unauthorized"); echo "OK"; // PayTR tekrar denemesin
  exit;
}

// TODO: burada siparişi veritabanında "ödendi" olarak işaretle
// Şimdilik /api/paytr-callback.log dosyasına yazalım:
$line = date('c')." | oid=$oid | status=$status | total=$total\n";
file_put_contents(__DIR__."/paytr-callback.log", $line, FILE_APPEND);

// PayTR'a mutlaka "OK" döndür
echo "OK";
