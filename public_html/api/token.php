<?php
// /api/token.php  — PayTR iFrame TOKEN üretir

// === MAĞAZA BİLGİLERİN ===
$MERCHANT_ID   = "631284";
$MERCHANT_KEY  = "B5saZnTNPEGbgd4B";
$MERCHANT_SALT = "WxDQ8TQjkBuM17fr";

// === CORS: Aynı domain olduğu için header şart değil ama dursun ===
$allowed = [
  "https://www.xn--reteneller-8db.com",
  "https://xn--reteneller-8db.com",
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowOrigin = in_array($origin, $allowed, true) ? $origin : $allowed[0];
header("Access-Control-Allow-Origin: $allowOrigin");
header("Vary: Origin");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json; charset=utf-8');

// --- JSON body oku ---
$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) { http_response_code(400); echo json_encode(["status"=>"error","reason"=>"INVALID_JSON"]); exit; }

// --- IP tespiti ---
function client_ip(): ?string {
  foreach (['HTTP_X_FORWARDED_FOR','HTTP_CLIENT_IP','REMOTE_ADDR'] as $k) {
    if (!empty($_SERVER[$k])) return trim(explode(',', $_SERVER[$k])[0]);
  }
  return null;
}

// --- Alanlar ---
$email           = $body['email']            ?? null;
$payment_amount  = isset($body['payment_amount']) ? (int)$body['payment_amount'] : null; // kuruş
$user_ip         = $body['user_ip']          ?? client_ip();
$merchant_oid    = $body['merchant_oid']     ?? null;
$user_name       = $body['user_name']        ?? 'Müşteri';
$user_address    = $body['user_address']     ?? '-';
$user_phone      = $body['user_phone']       ?? '-';

$test_mode       = isset($body['test_mode']) ? (int)$body['test_mode'] : 0;
$no_installment  = isset($body['no_installment']) ? (int)$body['no_installment'] : 0;
$max_installment = isset($body['max_installment']) ? (int)$body['max_installment'] : 12;
$currency        = $body['currency'] ?? 'TL';

// --- Kontroller ---
if (!$MERCHANT_ID || !$MERCHANT_KEY || !$MERCHANT_SALT) { http_response_code(500); echo json_encode(["status"=>"error","reason"=>"MISSING_CONFIG"]); exit; }
if (!$email || !$payment_amount || !$user_ip || !$merchant_oid) { http_response_code(400); echo json_encode(["status"=>"error","reason"=>"MISSING_FIELDS"]); exit; }

// --- Sepet: [urunAdı/tanım, tutarKuruş, adet]
$user_basket = base64_encode(json_encode([[ (string)$merchant_oid, (int)$payment_amount, 1 ]], JSON_UNESCAPED_UNICODE));

// --- Hash (Adım 1) ---
$hash_str = $MERCHANT_ID.$user_ip.$merchant_oid.$email.$payment_amount.$user_basket.$no_installment.$max_installment.$currency.$test_mode.$MERCHANT_SALT;
$paytr_token = base64_encode(hash_hmac('sha256', $hash_str, $MERCHANT_KEY, true));

// --- Başarılı/başarısız dönüş URL'leri ---
$ok_url   = 'https://www.xn--reteneller-8db.com/odeme/tesekkurler.html';
$fail_url = 'https://www.xn--reteneller-8db.com/odeme/paytr.html';

// --- PayTR POST verisi ---
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

// --- Token isteği ---
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

if ($err) { http_response_code(500); echo json_encode(["status"=>"error","reason"=>"CURL_ERROR: $err"]); exit; }

$data = json_decode($response, true);
if (!$data) { http_response_code($http >= 400 ? 500 : 200); echo json_encode(["status"=>"error","reason"=>$response]); exit; }

http_response_code($http >= 400 ? 500 : 200);
echo json_encode($data);
