<?php
declare(strict_types=1);

/**
 * Üreten Eller — PayTR Callback (Server-to-Server)
 * Dosya yolu: /api/paytr-callback.php
 * Not: PayTR bu endpoint’e POST yapar. Doğrulama başarılıysa mutlaka "OK" döndürmeliyiz.
 */

/* === MAĞAZA BİLGİLERİ (token.php ile aynı olmalı) === */
$MERCHANT_KEY  = "B5saZnTNPEGbgd4B";
$MERCHANT_SALT = "WxDQ8TQjkBuM17fr";

/* === SADECE POST KABUL === */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'Method Not Allowed';
  exit;
}

/* === HATA GİZLE (callback çıktısını kirletmemek için) === */
@ini_set('display_errors', '0');
@error_reporting(0);

/* === GEÇİCİ DEBUG LOG (isteğe bağlı) ===
 * PayTR’ın denemelerini görmek için /api/callback.log’a yazar.
 * Canlıda istersen kapatabilirsin.
 */
try {
  $raw = file_get_contents('php://input') ?: '';
  $log = sprintf(
    "[%s] IP=%s\nRAW=%s\nPOST=%s\n----\n",
    date('c'),
    $_SERVER['REMOTE_ADDR'] ?? '-',
    $raw,
    print_r($_POST, true)
  );
  @file_put_contents(__DIR__ . '/callback.log', $log, FILE_APPEND);
} catch (\Throwable $e) {
  // log yazılamasa da normal akış devam etsin
}

/* === GEREKLİ ALANLAR === */
$merchant_oid = isset($_POST['merchant_oid']) ? (string)$_POST['merchant_oid'] : '';
$status       = isset($_POST['status'])       ? (string)$_POST['status']       : ''; // success | failed
$hash         = isset($_POST['hash'])         ? (string)$_POST['hash']         : '';
// total_amount kuruş cinsinden gelebilir; PayTR imzasında kullanılır
$total_amount = isset($_POST['total_amount']) ? (int)$_POST['total_amount']    : null;

if ($merchant_oid === '' || $status === '' || $hash === '' || $total_amount === null) {
  http_response_code(400);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'MISSING_FIELDS';
  exit;
}

/* === İMZA DOĞRULAMA ===
 * PayTR: base64_encode( HMAC_SHA256( merchant_oid + merchant_salt + status + total_amount, merchant_key ) )
 */
$toSign = $merchant_oid . $MERCHANT_SALT . $status . $total_amount;
$calc   = base64_encode(hash_hmac('sha256', $toSign, $MERCHANT_KEY, true));

if (!hash_equals($calc, $hash)) {
  // İmza hatası: PayTR tekrar dener, 403 dönebiliriz
  http_response_code(403);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'INVALID_HASH';
  exit;
}

/* === BURADA SİPARİŞİ İŞARETLE (opsiyonel)
 * $status === 'success' => ödeme onaylandı (emanet/held)
 * $status === 'failed'  => ödeme başarısız
 *
 * Bu örnekte sadece logluyoruz. Kendi DB’nizde güncelleme yapmak isterseniz burada yapın.
 */
try {
  $note = sprintf(
    "[%s] OID=%s STATUS=%s TOTAL=%s\n",
    date('c'),
    $merchant_oid,
    $status,
    (string)$total_amount
  );
  @file_put_contents(__DIR__ . '/callback.log', $note, FILE_APPEND);
} catch (\Throwable $e) {}

// === ZORUNLU CEVAP (yalnızca OK ve hemen sonlandır) ===
if (function_exists('ob_get_length') && ob_get_length() !== false) { @ob_end_clean(); }
header('Content-Type: text/plain; charset=utf-8');
http_response_code(200);
echo 'OK';
if (function_exists('fastcgi_finish_request')) { @fastcgi_finish_request(); }
exit;

