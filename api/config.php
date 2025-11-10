<?php
// /api/config.php  (cPanel'de, GIT'e koyma)

// PayTR CANLI kimlikleri
define('PAYTR_MERCHANT_ID',  '631284');
define('PAYTR_MERCHANT_KEY', 'B5saZnTNPEGbgd4B');
define('PAYTR_MERCHANT_SALT','WxDQ8TQjkBuM17fr');

// Test modu (1=test, 0=canlı)
define('PAYTR_TEST_MODE', 0);

// Başarılı / Hatalı dönüş URL’leri
// (ikisi de sitende mevcut sayfalara işaret ediyor)
define('PAYTR_OK_URL',   'https://www.xn--reteneller-8db.com/odeme/tesekkurler.html');
define('PAYTR_FAIL_URL', 'https://www.xn--reteneller-8db.com/odeme-hata.html');

// Firebase Function webhook (PayTR server-to-server bildirimi için forward hedefi)
define('CF_PAYTR_WEBHOOK_URL', 'https://us-central1-flutter-ai-playground-38ddf.cloudfunctions.net/paytrCallback');

// Güvenlik: sadece kendi sitenden gelen istekleri kabul et
define('ALLOWED_ORIGINS', serialize([
  'https://www.xn--reteneller-8db.com',
  'https://xn--reteneller-8db.com',
  'https://www.ureteneller.com',
  'https://ureteneller.com',
]));

// Basit CORS helper (token.php’de kullanılır)
function cors_allow() {
  $origins = unserialize(ALLOWED_ORIGINS);
  $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
  if ($origin && in_array($origin, $origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
  }
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
}
