<?php
declare(strict_types=1);

// Friend maps live outside the public website folder. No account passwords,
// email addresses, API keys, or third-party service are involved.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

final class MapRequestError extends RuntimeException
{
    public int $status;
    public string $errorCode;

    public function __construct(int $status, string $errorCode, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $errorCode;
    }
}

function failRequest(int $status, string $code, string $message): void
{
    throw new MapRequestError($status, $code, $message);
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function pathIsWithin(string $path, string $root): bool
{
    $path = str_replace('\\', '/', $path);
    $root = rtrim(str_replace('\\', '/', $root), '/');
    if (DIRECTORY_SEPARATOR === '\\') {
        $path = strtolower($path);
        $root = strtolower($root);
    }
    return $path === $root || strpos($path, $root . '/') === 0;
}

function openDatabase(): PDO
{
    if (!extension_loaded('pdo_sqlite')) {
        throw new RuntimeException('The PHP PDO SQLite extension is required.');
    }
    $publicRoot = realpath(dirname(__DIR__));
    $documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__));
    $configured = getenv('RUSTIN_MAPS_DATA_DIR');
    $directory = $configured !== false && $configured !== ''
        ? $configured
        : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.rustin-travel-maps';
    // Check the nearest existing parent before creating anything. This also
    // catches a configured path whose parent is a symlink into the public site.
    $ancestor = $directory;
    while (!file_exists($ancestor) && dirname($ancestor) !== $ancestor) {
        $ancestor = dirname($ancestor);
    }
    $resolvedAncestor = realpath($ancestor);
    if ($resolvedAncestor === false || $publicRoot === false
        || pathIsWithin($resolvedAncestor, $publicRoot)
        || ($documentRoot !== false && pathIsWithin($resolvedAncestor, $documentRoot))) {
        throw new RuntimeException('Map storage must be outside the public document root.');
    }
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not create the private map storage directory.');
    }
    $storage = realpath($directory);
    if ($storage === false || $publicRoot === false || pathIsWithin($storage, $publicRoot)
        || ($documentRoot !== false && pathIsWithin($storage, $documentRoot))) {
        throw new RuntimeException('Map storage must be outside the public document root.');
    }
    $filename = $storage . DIRECTORY_SEPARATOR . 'maps.sqlite';
    // Also reject a database symlink pointing back into the public site.
    if (is_link($filename) || (file_exists($filename) && !is_file($filename))) {
        throw new RuntimeException('The map database path is not a regular private file.');
    }
    $db = new PDO('sqlite:' . $filename, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    @chmod($filename, 0600);
    $db->exec('PRAGMA busy_timeout = 5000');
    $db->exec('CREATE TABLE IF NOT EXISTS maps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        countries TEXT NOT NULL,
        states TEXT NOT NULL,
        listed INTEGER NOT NULL DEFAULT 0,
        edit_key_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
    )');
    $db->exec('CREATE INDEX IF NOT EXISTS maps_directory ON maps (listed, updated_at DESC, id)');
    $db->exec('CREATE TABLE IF NOT EXISTS rate_limits (
        subject TEXT NOT NULL,
        bucket TEXT NOT NULL,
        period_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (subject, bucket, period_start)
    )');
    $db->exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
    $salt = $db->prepare('INSERT OR IGNORE INTO settings (name, value) VALUES (?, ?)');
    $salt->execute(['rate_salt', bin2hex(random_bytes(32))]);
    return $db;
}

function assertSameOrigin(): void
{
    // JSON requests cannot be sent cross-origin without a CORS preflight. We
    // deliberately grant no CORS access, and check Origin as an extra boundary.
    if (strtolower($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        failRequest(403, 'CROSS_ORIGIN', 'Please save your map from this website.');
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    $https = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off';
    $scheme = $https ? 'https' : 'http';
    $expected = parse_url($scheme . '://' . ($_SERVER['HTTP_HOST'] ?? ''));
    $supplied = parse_url($origin);
    $expectedPort = $expected['port'] ?? ($scheme === 'https' ? 443 : 80);
    $suppliedPort = $supplied['port'] ?? (($supplied['scheme'] ?? '') === 'https' ? 443 : 80);
    if ($expected === false || $supplied === false
        || strtolower($supplied['scheme'] ?? '') !== $scheme
        || strtolower($supplied['host'] ?? '') !== strtolower($expected['host'] ?? '')
        || $suppliedPort !== $expectedPort
        || isset($supplied['user']) || isset($supplied['pass'])
        || isset($supplied['path']) || isset($supplied['query']) || isset($supplied['fragment'])) {
        failRequest(403, 'CROSS_ORIGIN', 'Please save your map from this website.');
    }
}

function readBody(): stdClass
{
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') {
        failRequest(415, 'JSON_REQUIRED', 'Send map changes as JSON.');
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) {
        failRequest(413, 'BODY_TOO_LARGE', 'This map update is too large.');
    }
    $body = file_get_contents('php://input', false, null, 0, 16385);
    if ($body === false || strlen($body) > 16384) {
        failRequest(413, 'BODY_TOO_LARGE', 'This map update is too large.');
    }
    try {
        $data = json_decode($body, false, 16, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        failRequest(400, 'INVALID_JSON', 'The map update was not valid JSON.');
    }
    if (!$data instanceof stdClass) {
        failRequest(400, 'INVALID_JSON', 'The map update must be a JSON object.');
    }
    if (isset($data->website) && $data->website !== '') {
        failRequest(400, 'INVALID_REQUEST', 'The map could not be saved.');
    }
    return $data;
}

function normalizeCodes($values, array $allowed, string $label): array
{
    if (!is_array($values) || count($values) > count($allowed) * 2) {
        failRequest(422, 'INVALID_CODES', 'Choose valid ' . $label . ' from the list.');
    }
    $result = [];
    foreach ($values as $code) {
        if (!is_string($code) || !preg_match('/^[A-Z]{2}$/D', $code) || !in_array($code, $allowed, true)) {
            failRequest(422, 'INVALID_CODES', 'Choose valid ' . $label . ' from the list.');
        }
        $result[$code] = true;
    }
    $codes = array_keys($result);
    sort($codes, SORT_STRING);
    return $codes;
}

function validateMap(stdClass $data): array
{
    if (!isset($data->name) || !is_string($data->name) || !preg_match('//u', $data->name)
        || preg_match('/\p{C}/u', $data->name)) {
        failRequest(422, 'INVALID_NAME', 'Use a display name with 1 to 60 characters.');
    }
    $name = preg_replace('/^\s+|\s+$/u', '', $data->name);
    $characters = preg_split('//u', $name, -1, PREG_SPLIT_NO_EMPTY);
    if ($characters === false || count($characters) < 1 || count($characters) > 60) {
        failRequest(422, 'INVALID_NAME', 'Use a display name with 1 to 60 characters.');
    }
    if (!isset($data->listed) || !is_bool($data->listed)) {
        failRequest(422, 'INVALID_VISIBILITY', 'Choose whether your map appears in the friends directory.');
    }
    $countries = json_decode(file_get_contents(dirname(__DIR__) . '/assets/vendor/leaflet/iso-codes.json'), true, 16, JSON_THROW_ON_ERROR);
    $stateData = json_decode(file_get_contents(dirname(__DIR__) . '/assets/vendor/leaflet/us-states-albers.json'), true, 64, JSON_THROW_ON_ERROR);
    $states = array_map(static function (array $feature): string {
        return $feature['properties']['code'];
    }, $stateData['features']);
    return [
        'name' => $name,
        'countries' => normalizeCodes($data->countries ?? null, $countries, 'countries and territories'),
        'states' => normalizeCodes($data->states ?? null, $states, 'U.S. states'),
        'listed' => $data->listed,
    ];
}

function publicMap(array $row): array
{
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'countries' => json_decode($row['countries'], true, 16, JSON_THROW_ON_ERROR),
        'states' => json_decode($row['states'], true, 16, JSON_THROW_ON_ERROR),
        'listed' => (bool) $row['listed'],
        'updatedAt' => $row['updated_at'],
        'version' => (int) $row['version'],
    ];
}

function findMap(PDO $db, string $id): array
{
    $query = $db->prepare('SELECT * FROM maps WHERE id = ?');
    $query->execute([$id]);
    $row = $query->fetch();
    if ($row === false) {
        failRequest(404, 'MAP_NOT_FOUND', 'This map could not be found.');
    }
    return $row;
}

function assertEditKey(array $row): void
{
    $key = $_SERVER['HTTP_X_MAP_EDIT_KEY'] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/D', $key) || !hash_equals($row['edit_key_hash'], hash('sha256', $key))) {
        failRequest(403, 'EDIT_KEY_REQUIRED', 'Open your private editing link to change this map.');
    }
}

function rateLimit(PDO $db, string $bucket, int $seconds, int $maximum): void
{
    $salt = $db->query("SELECT value FROM settings WHERE name = 'rate_salt'")->fetchColumn();
    $address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $subject = hash_hmac('sha256', $address, $salt);
    $period = (int) (floor(time() / $seconds) * $seconds);
    $query = $db->prepare('SELECT count FROM rate_limits WHERE subject = ? AND bucket = ? AND period_start = ?');
    $query->execute([$subject, $bucket, $period]);
    $count = $query->fetchColumn();
    if ($count !== false && (int) $count >= $maximum) {
        header('Retry-After: ' . (string) ($period + $seconds - time()));
        failRequest(429, 'RATE_LIMIT', 'Too many map changes from this connection. Please try again later.');
    }
    $update = $db->prepare('INSERT INTO rate_limits (subject, bucket, period_start, count) VALUES (?, ?, ?, 1)
        ON CONFLICT (subject, bucket, period_start) DO UPDATE SET count = count + 1');
    $update->execute([$subject, $bucket, $period]);
    $cleanup = $db->prepare('DELETE FROM rate_limits WHERE period_start < ?');
    $cleanup->execute([time() - 8 * 86400]);
}

function beginWrite(PDO $db, bool &$active): void
{
    // Reserve the SQLite writer before reading the record/version or rate
    // bucket. Concurrent PHP workers then wait here instead of both acquiring
    // read locks that cannot safely be upgraded to a write lock.
    $db->exec('BEGIN IMMEDIATE');
    $active = true;
}

function commitWrite(PDO $db, bool &$active): void
{
    $db->exec('COMMIT');
    $active = false;
}

function rollbackWrite(?PDO $db, bool &$active): void
{
    if ($db === null || !$active) {
        return;
    }
    // PDO's inTransaction() is not reliable for a transaction opened with a
    // raw BEGIN IMMEDIATE statement; track our own successful BEGIN instead.
    try {
        $db->exec('ROLLBACK');
    } catch (Throwable $error) {
        error_log('Friend maps rollback: ' . $error->getMessage());
    }
    $active = false;
}

$db = null;
$writeActive = false;
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST', 'DELETE'], true)) {
        header('Allow: GET, POST, DELETE');
        failRequest(405, 'METHOD_NOT_ALLOWED', 'Use GET, POST, or DELETE for maps.');
    }
    $id = $_GET['id'] ?? '';
    if (!is_string($id) || ($id !== '' && !preg_match('/^[a-f0-9]{24}$/D', $id))) {
        failRequest(400, 'INVALID_ID', 'This map link is not valid.');
    }
    if ($method !== 'GET') {
        assertSameOrigin();
    }
    // Reject malformed writes before opening or creating any private storage.
    $data = $method === 'POST' ? readBody() : null;
    $map = $data !== null ? validateMap($data) : null;
    $db = openDatabase();

    if ($method === 'GET' && ($_GET['action'] ?? '') === 'list') {
        $page = $_GET['page'] ?? '0';
        if (!is_string($page) || !preg_match('/^\d{1,3}$/D', $page) || (int) $page > 100) {
            failRequest(400, 'INVALID_PAGE', 'This directory page is not valid.');
        }
        $query = $db->prepare('SELECT * FROM maps WHERE listed = 1 ORDER BY updated_at DESC, id LIMIT 51 OFFSET ?');
        $query->bindValue(1, (int) $page * 50, PDO::PARAM_INT);
        $query->execute();
        $rows = $query->fetchAll();
        $hasMore = count($rows) > 50;
        respond([
            'maps' => array_map('publicMap', array_slice($rows, 0, 50)),
            'hasMore' => $hasMore,
            'nextPage' => $hasMore ? (int) $page + 1 : null,
        ]);
    }
    if ($method === 'GET') {
        if ($id === '') {
            failRequest(400, 'MAP_ID_REQUIRED', 'Choose a map to view.');
        }
        respond(['map' => publicMap(findMap($db, $id))]);
    }

    if ($method === 'DELETE') {
        if ($id === '') {
            failRequest(400, 'MAP_ID_REQUIRED', 'Choose a map to delete.');
        }
        beginWrite($db, $writeActive);
        $row = findMap($db, $id);
        assertEditKey($row);
        rateLimit($db, 'mutations', 3600, 120);
        $delete = $db->prepare('DELETE FROM maps WHERE id = ?');
        $delete->execute([$id]);
        commitWrite($db, $writeActive);
        respond(['deleted' => true]);
    }

    if ($id === '') {
        beginWrite($db, $writeActive);
        rateLimit($db, 'create', 86400, 5);
        if ((int) $db->query('SELECT COUNT(*) FROM maps')->fetchColumn() >= 5000) {
            failRequest(503, 'MAP_CAPACITY', 'New maps are temporarily unavailable. Please try again later.');
        }
        $id = bin2hex(random_bytes(12));
        $editKey = bin2hex(random_bytes(32));
        $insert = $db->prepare('INSERT INTO maps (id, name, countries, states, listed, edit_key_hash, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
        $insert->execute([
            $id, $map['name'], json_encode($map['countries']), json_encode($map['states']),
            $map['listed'] ? 1 : 0, hash('sha256', $editKey), gmdate('Y-m-d\TH:i:s\Z'),
        ]);
        $row = findMap($db, $id);
        commitWrite($db, $writeActive);
        respond(['map' => publicMap($row), 'editKey' => $editKey], 201);
    }

    if (!isset($data->version) || !is_int($data->version) || $data->version < 1) {
        failRequest(422, 'VERSION_REQUIRED', 'Reload your map before saving changes.');
    }
    beginWrite($db, $writeActive);
    $row = findMap($db, $id);
    assertEditKey($row);
    if ((int) $row['version'] !== $data->version) {
        failRequest(409, 'VERSION_CONFLICT', 'This map changed in another tab. Reload it before saving again.');
    }
    rateLimit($db, 'mutations', 3600, 120);
    $update = $db->prepare('UPDATE maps SET name = ?, countries = ?, states = ?, listed = ?,
        updated_at = ?, version = version + 1 WHERE id = ? AND version = ?');
    $update->execute([
        $map['name'], json_encode($map['countries']), json_encode($map['states']),
        $map['listed'] ? 1 : 0, gmdate('Y-m-d\TH:i:s\Z'), $id, $data->version,
    ]);
    if ($update->rowCount() !== 1) {
        failRequest(409, 'VERSION_CONFLICT', 'This map changed in another tab. Reload it before saving again.');
    }
    $row = findMap($db, $id);
    commitWrite($db, $writeActive);
    respond(['map' => publicMap($row)]);
} catch (MapRequestError $error) {
    rollbackWrite($db, $writeActive);
    respond(['error' => $error->getMessage(), 'code' => $error->errorCode], $error->status);
} catch (Throwable $error) {
    rollbackWrite($db, $writeActive);
    error_log('Friend maps API: ' . $error->getMessage());
    respond(['error' => 'Map saving is temporarily unavailable. Please try again shortly.', 'code' => 'API_UNAVAILABLE'], 503);
}
