<?php
// api/callback.php
// PayTR'dan ödeme sonucu bildirimi alır.

$MERCHANT_KEY  = "B5saZnTNPEGbgd4B";
$MERCHANT_SALT = "WxDQ8TQjkBuM17fr";

$post = $_POST;
$hash = base64_encode(hash_hmac('sha256', $post['merchant_oid'].$MERCHANT_SALT.$post['status'].$post['total_amount'], $MERCHANT_KEY, true));

if ($hash != $post['hash']) {
    // Geçersiz istek (hash uyuşmaz)
    die('PAYTR notification failed: bad hash');
}

// Başarılı ödeme
if ($post['status'] == 'success') {
    // Burada kendi veritabanında siparişi "ödendi" olarak işaretle
    // örnek: updateOrder($post['merchant_oid'], "paid");
    file_put_contents(__DIR__.'/paytr_log.txt', date('Y-m-d H:i:s')." SUCCESS ".$post['merchant_oid']."\n", FILE_APPEND);
}
// Başarısız ödeme
else {
    file_put_contents(__DIR__.'/paytr_log.txt', date('Y-m-d H:i:s')." FAIL ".$post['merchant_oid']."\n", FILE_APPEND);
}

// PayTR'a 200 OK dönmek şart, yoksa tekrar tekrar gönderir.
echo "OK";
