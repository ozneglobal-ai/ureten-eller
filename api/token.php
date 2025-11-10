<?php
// api/token.php
// PayTR iFrame TOKEN üretir (backend). CORS + Punycode domain uyumlu

// --- MAĞAZA BİLGİLERİ ---
$MERCHANT_ID   = "631284";
$MERCHANT_KEY  = "B5saZnTNPEGbgd4B";
$MERCHANT_SALT = "WxDQ8TQjkBuM17fr";

// --- CORS Ayarları ---
$allowed = [
  "https://www.xn--reteneller-8db.com",  // ana site (statik)
  "https://xn--reteneller-8db.com",
  "https://ureteneller.kesug.com"        // backend domain
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
}
header("Vary: Origin");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json; charset=utf-8');

// --- Girdi okuma ---
$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
  http_response_code(400);
  echo json_encode(["status" => "error", "reason" => "INVALID_JSON"]);
  exit;
}

// --- IP tespiti ---
function client_ip(): string {
  $keys = ['HTTP_X_FORWARDED_FOR', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];
  foreach ($keys as $k) {
    if (!empty($_SERVER[$k])) {
      $val = trim(explode(',', $_SERVER[$k])[0]);
      if ($val) return $val;
    }
  }
  return '127.0.0.1';
}

// --- Değişkenler ---
$email           = $body['email']           ?? null;
$payment_amount  = isset($body['payment_amount']) ? (int)$body['payment_amount'] : null;
$user_ip         = $body['user_ip']         ?? client_ip();
$merchant_oid    = $body['merchant_oid']    ?? null;
$user_name       = $body['user_name']       ?? null;
$user_address    = $body['user_address']    ?? null;
$user_phone      = $body['user_phone']      ?? null;

$test_mode       = isset($body['test_mode']) ? (int)$body['test_mode'] : 0;
$no_installment  = isset($body['no_installment']) ? (int)$body['no_installment'] : 0;
$max_installment = isset($body['max_installment']) ? (int)$body['max_installment'] : 12;
$currency        = $body['currency'] ?? 'TL';

if (!$MERCHANT_ID || !$MERCHANT_KEY || !$MERCHANT_SALT) {
  http_response_code(500);
  echo json_encode(["status" => "error", "reason" => "MISSING_CONFIG"]);
  exit;
}
if (!$email || !$payment_amount || !$user_ip || !$merchant_oid) {
  http_response_code(400);
  echo json_encode(["status" => "error", "reason" => "MISSING_FIELDS"]);
  exit;
}

// --- Sepet ---
$user_basket = base64_encode(
  json_encode([[ (string)$merchant_oid, (int)$payment_amount, 1 ]], JSON_UNESCAPED_UNICODE)
);

// --- iFrame API Hash ---
$hash_str = $MERCHANT_ID
          . $user_ip
          . $merchant_oid
          . $email
          . $payment_amount
          . $user_basket
          . $no_installment
          . $max_installment
          . $currency
          . $test_mode
          . $MERCHANT_SALT;

$paytr_token = base64_encode(hash_hmac('sha256', $hash_str, $MERCHANT_KEY, true));

// --- OK/FAIL URL'leri (frontend'den gelebilir; yoksa güvenli varsayılan) ---
$def_origin   = 'https://www.xn--reteneller-8db.com';
$ok_url_in    = $body['ok_url']   ?? null;
$fail_url_in  = $body['fail_url'] ?? null;

// sadece kendi domainlerimize izin verelim
function __same_host($u, $allowedHosts){
  if(!$u) return false;
  $h = parse_url($u, PHP_URL_HOST);
  if(!$h) return false;
  return in_array(strtolower($h), $allowedHosts, true);
}
$__allowedHosts = ['www.xn--reteneller-8db.com','xn--reteneller-8db.com'];

$ok_url   = __same_host($ok_url_in, $__allowedHosts)
            ? $ok_url_in
            : $def_origin.'/docs/profile.html';
$fail_url = __same_host($fail_url_in, $__allowedHosts)
            ? $fail_url_in
            : $def_origin.'/docs/profile.html?status=fail';

// --- PayTR'a gönderilecek veriler ---
$postData = [
  'merchant_id'       => $MERCHANT_ID,
  'user_ip'           => $user_ip,
  'merchant_oid'      => $merchant_oid,
  'email'             => $email,
  'payment_amount'    => (int)$payment_amount,
  'paytr_token'       => $paytr_token,
  'user_basket'       => $user_basket,
  'no_installment'    => $no_installment,
  'max_installment'   => $max_installment,
  'currency'          => $currency,
  'test_mode'         => $test_mode,
  'user_name'         => $user_name,
  'user_address'      => $user_address,
  'user_phone'        => $user_phone,
  'merchant_ok_url'   => $ok_url,
  'merchant_fail_url' => $fail_url,
];

// --- PayTR token isteği ---
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://www.paytr.com/odeme/api/get-token");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
$response = curl_exec($ch);
$err  = curl_error($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// --- Hata kontrolü ---
if ($err) {
  http_response_code(500);
  echo json_encode(["status" => "error", "reason" => "CURL_ERROR: $err"]);
  exit;
}

$data = json_decode($response, true);
if (!$data) {
  http_response_code($http >= 400 ? 500 : 200);
  echo json_encode(["status" => "error", "reason" => $response]);
  exit;
}

http_response_code($http >= 400 ? 500 : 200);
echo json_encode($data);
