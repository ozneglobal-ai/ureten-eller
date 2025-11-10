<?php
// Üreten Eller - Güvenli sipariş oluşturma (PayTR öncesi kayıt)

header("Access-Control-Allow-Origin: https://xn--reteneller-8db.com");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  header("Content-Type: application/json; charset=utf-8");
  echo json_encode(["status"=>"error","reason"=>"METHOD_NOT_ALLOWED"]);
  exit;
}

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

// Zorunlu alanlar
$need = ['listingId','sellerId','buyerId','price'];
foreach ($need as $k) {
  if (!isset($data[$k]) || $data[$k]==='') {
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["status"=>"error","reason"=>"MISSING_FIELDS","field"=>$k]);
    exit;
  }
}

// Sıra & merchant_oid (UE-YYYYMMDD-000123)
$seq = (int) (microtime(true) * 1000);
$orderCode = 'UE-'.date('Ymd').'-'.str_pad($seq % 1000000, 6, '0', STR_PAD_LEFT);
$merchant_oid = $orderCode;

// Private log’a yaz (web’den erişilemez)
$logDir  = '/home/xnr2tenellercom/private/';
$logFile = $logDir . 'orders.log';
@mkdir($logDir, 0750, true);
$entry = date('Y-m-d H:i:s') . " | $merchant_oid | " . json_encode($data, JSON_UNESCAPED_UNICODE) . PHP_EOL;
file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);

// Yanıt
header("Content-Type: application/json; charset=utf-8");
echo json_encode([
  "status"       => "ok",
  "orderCode"    => $orderCode,
  "merchant_oid" => $merchant_oid
]);
