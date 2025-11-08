<?php
// Üreten Eller - PayTR sipariş proxy
header("Access-Control-Allow-Origin: https://xn--reteneller-8db.com");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$input = file_get_contents("php://input");

$ch = curl_init('https://us-central1-flutter-ai-playground-38ddf.cloudfunctions.net/createOrder');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => $input
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($err) {
  http_response_code(500);
  header("Content-Type: application/json");
  echo json_encode([
    "status" => "error",
    "reason" => "CURL_FAILED",
    "detail" => $err
  ]);
  exit;
}

if ($httpCode !== 200) {
  http_response_code($httpCode ?: 500);
  header("Content-Type: application/json");
  echo json_encode([
    "status" => "error",
    "reason" => "REMOTE_FAILED",
    "httpCode" => $httpCode,
    "response" => $response
  ]);
  exit;
}

header("Content-Type: application/json");
echo $response;
?>
