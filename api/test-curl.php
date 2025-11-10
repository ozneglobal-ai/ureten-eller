<?php
header('Content-Type: text/plain; charset=utf-8');

$url = 'https://us-central1-flutter-ai-playground-38ddf.cloudfunctions.net/createOrder';
$payload = json_encode([
  "listingId" => "TEST123",
  "sellerId"  => "SELLER123",
  "buyerId"   => "BUYER123",
  "price"     => 10,
  "currency"  => "TRY",
  "qty"       => 1,
  "title"     => "Test İlan",
  "cover"     => ""
]);

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_TIMEOUT => 20,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

echo "HTTP: $httpCode\n";
if ($err) {
  echo "CURL_ERR: $err\n";
}
echo "RESP:\n$response\n";
