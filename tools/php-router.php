<?php
declare(strict_types=1);

// PHP's development server supplies the same API as DreamHost. Never route a
// filename outside site/, including percent-encoded traversal attempts.
$root = realpath(__DIR__ . '/../site');
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$file = realpath($root . $path);
if ($file !== false && is_dir($file)) {
    $file = realpath($file . '/index.html');
}
$prefix = $root . DIRECTORY_SEPARATOR;
if ($file === false || strpos($file, $prefix) !== 0 || !is_file($file)) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    readfile($root . '/404.html');
    return true;
}
if (pathinfo($file, PATHINFO_EXTENSION) === 'php') {
    if ($file !== $root . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'maps.php') {
        http_response_code(404);
        return true;
    }
    require $file;
    return true;
}
$types = [
    'html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8',
    'js' => 'text/javascript; charset=utf-8', 'json' => 'application/json; charset=utf-8',
    'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'ico' => 'image/x-icon',
];
header('Content-Type: ' . ($types[strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? 'application/octet-stream'));
header('X-Content-Type-Options: nosniff');
readfile($file);
return true;
