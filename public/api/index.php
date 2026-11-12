<?php
/* Battle of Interns API. Single file, PHP 8+, SQLite (PDO).
   Called as api/index.php?r=<route> with a JSON body (or multipart for admin/upload).
   Scoring, the timer, quiz opening and the one-attempt rule are all enforced here, never in the browser. */
declare(strict_types=1);

$CFG = require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (!empty($CFG['cors_origins'])) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $CFG['cors_origins'], true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
    }
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }
}

function out(array $data, int $code = 200): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }
function now_ms(): int { return (int) round(microtime(true) * 1000); }
function uid(): string { return bin2hex(random_bytes(8)); }
function s(mixed $v): string { return trim((string) ($v ?? '')); }
function read_json(string $file): array { return is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : []; }

/* ---------- database ---------- */
function db(): PDO {
    static $pdo = null;
    global $CFG;
    if ($pdo) return $pdo;
    $dir = dirname($CFG['db_path']);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    try { $pdo = new PDO('sqlite:' . $CFG['db_path']); }
    catch (Throwable $e) { fail('Database not writable. Check the data folder permissions.', 500); }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, text TEXT NOT NULL, opt_a TEXT, opt_b TEXT, opt_c TEXT, opt_d TEXT, correct TEXT NOT NULL, explanation TEXT, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, created_at INTEGER);
        CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, token TEXT UNIQUE, name TEXT, email TEXT, bmdc TEXT, phone TEXT, institution TEXT, password_hash TEXT, registered_at INTEGER, last_login_at INTEGER);
        CREATE INDEX IF NOT EXISTS idx_p_bmdc ON participants(bmdc); CREATE INDEX IF NOT EXISTS idx_p_email ON participants(email); CREATE UNIQUE INDEX IF NOT EXISTS idx_p_phone ON participants(phone);
        CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, participant_id TEXT UNIQUE REFERENCES participants(id) ON DELETE CASCADE, started_at INTEGER, ends_at INTEGER, order_json TEXT, answers_json TEXT, tab_switches INTEGER DEFAULT 0, status TEXT, submitted_at INTEGER, score INTEGER, total INTEGER, correct INTEGER, wrong INTEGER, skipped INTEGER, time_taken_sec INTEGER, late INTEGER DEFAULT 0);
        CREATE INDEX IF NOT EXISTS idx_a_rank ON attempts(status, score, time_taken_sec, submitted_at);
        CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, title TEXT, description TEXT, url TEXT, type TEXT, size INTEGER, sort INTEGER DEFAULT 0, visible INTEGER DEFAULT 1, created_at INTEGER);
        CREATE TABLE IF NOT EXISTS sms_base (phone TEXT PRIMARY KEY, added_at INTEGER);');
    // older databases: add columns that did not exist before
    $cols = array_column($pdo->query('PRAGMA table_info(participants)')->fetchAll(PDO::FETCH_ASSOC), 'name');
    if (!in_array('password_hash', $cols, true)) { $pdo->exec('ALTER TABLE participants ADD COLUMN password_hash TEXT'); }
    if (!in_array('last_login_at', $cols, true)) { $pdo->exec('ALTER TABLE participants ADD COLUMN last_login_at INTEGER'); }
    if (!in_array('birth_day', $cols, true)) { $pdo->exec('ALTER TABLE participants ADD COLUMN birth_day TEXT'); }
    if (!setting('admin_hash')) { seed($pdo); }
    return $pdo;
}
function default_terms(): string {
    return "1. Participation is open exclusively to medical doctors currently serving as interns in recognized medical colleges or hospitals in Bangladesh.\n2. Each participant can register and participate only once.\n3. The quiz must be completed within the stipulated time using a personal internet-enabled device.\n4. Winners will be selected based on scores and completion time. The organizer's decision will be final.\n5. The organizer reserves the right to disqualify participants for unfair practices and modify or cancel the campaign if necessary.";
}
function default_settings(): array {
    return ['campaignName' => 'Battle of Interns', 'sponsor' => 'Moxaclav', 'durationSec' => 600, 'questionCount' => 25, 'shuffle' => true,
        'leaderboardPublic' => true, 'showExplanations' => true, 'registrationOpen' => true,
        'quizMode' => 'manual', 'quizOpen' => false, 'quizStartAt' => null, 'quizEndAt' => null,
        'splashIcon' => '', 'splashVisual' => '', 'splashKicker' => 'World AMR Awareness Week', 'splashCta' => 'Register Now', 'splashTheme' => [], 'splashHeadline' => 'Battle of Interns', 'splashSub' => 'An online quiz on rational antimicrobial use for intern doctors of Bangladesh. World AMR Awareness Week.',
        'bannerTop' => ['enabled' => false, 'image' => '', 'link' => ''], 'bannerPopup' => ['enabled' => false, 'image' => '', 'link' => '', 'seconds' => 10],
        'terms' => default_terms()];
}
function seed(PDO $pdo): void {
    global $CFG;
    foreach (default_settings() as $k => $v) { if (setting($k) === null) set_setting($k, $v, $pdo); }
    set_setting('admin_hash', password_hash($CFG['initial_admin_password'], PASSWORD_DEFAULT), $pdo);
    if (setting('institutions') === null) set_setting('institutions', default_institutions(), $pdo);
    if ((int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn() === 0) {
        $st = $pdo->prepare('INSERT INTO questions (id,text,opt_a,opt_b,opt_c,opt_d,correct,explanation,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)');
        foreach (read_json($CFG['seed_file']) as $i => $q) { $st->execute([uid(), $q['text'], $q['options']['A'] ?? '', $q['options']['B'] ?? '', $q['options']['C'] ?? '', $q['options']['D'] ?? '', $q['correct'], $q['explanation'] ?? '', $i, now_ms()]); }
    }
    if ((int) $pdo->query('SELECT COUNT(*) FROM materials')->fetchColumn() === 0) {
        $st = $pdo->prepare('INSERT INTO materials (id,title,description,url,type,size,sort,visible,created_at) VALUES (?,?,?,?,?,?,?,1,?)');
        foreach (read_json(dirname($CFG['seed_file']) . '/materials.json') as $i => $m) {
            $url = $m['url'] ?? ('materials/' . $m['file']); $size = isset($m['file']) && is_file(__DIR__ . '/../materials/' . $m['file']) ? filesize(__DIR__ . '/../materials/' . $m['file']) : null;
            $st->execute([uid(), $m['title'], $m['description'] ?? '', $url, $m['type'] ?? 'link', $size, $i, now_ms()]);
        }
    }
}
function default_institutions(): array { global $CFG; return read_json(dirname($CFG['seed_file']) . '/institutions.json'); }
function institutions(): array { $l = setting('institutions'); if (!is_array($l)) $l = default_institutions(); usort($l, fn($a, $b) => strcasecmp($a, $b)); return array_values($l); }
$SETTINGS_CACHE = null;
function setting(string $k, mixed $default = null): mixed {
    global $SETTINGS_CACHE;
    if ($SETTINGS_CACHE === null) { $SETTINGS_CACHE = []; foreach (db()->query('SELECT key, value FROM settings') as $r) { $SETTINGS_CACHE[$r['key']] = json_decode((string) $r['value'], true); } }
    return array_key_exists($k, $SETTINGS_CACHE) ? $SETTINGS_CACHE[$k] : $default;
}
function set_setting(string $k, mixed $v, ?PDO $pdo = null): void {
    global $SETTINGS_CACHE;
    ($pdo ?? db())->prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')->execute([$k, json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    if (is_array($SETTINGS_CACHE)) $SETTINGS_CACHE[$k] = $v;
}
function all_settings(): array {
    $out = default_settings();
    foreach (db()->query('SELECT key, value FROM settings') as $r) { if (!in_array($r['key'], ['admin_hash', 'institutions'], true)) $out[$r['key']] = json_decode((string) $r['value'], true); }
    return $out;
}
function quiz_state(): array {
    $now = now_ms(); $mode = setting('quizMode', 'manual');
    if ($mode === 'scheduled') {
        $st = setting('quizStartAt'); $en = setting('quizEndAt');
        if ($st && $now < (int) $st) return ['state' => 'scheduled', 'startAt' => (int) $st, 'endAt' => $en ? (int) $en : null];
        if ($en && $now >= (int) $en) return ['state' => 'closed', 'startAt' => $st ? (int) $st : null, 'endAt' => (int) $en];
        return ['state' => 'open', 'startAt' => $st ? (int) $st : null, 'endAt' => $en ? (int) $en : null];
    }
    return ['state' => setting('quizOpen') ? 'open' : 'locked', 'startAt' => null, 'endAt' => null];
}
function active_count(): int { return (int) db()->query('SELECT COUNT(*) FROM questions WHERE active=1')->fetchColumn(); }
function public_settings(): array {
    $qc = (int) setting('questionCount', 25); $ac = active_count();
    return ['campaignName' => setting('campaignName'), 'sponsor' => setting('sponsor'), 'durationSec' => (int) setting('durationSec', 600), 'questionCount' => $ac ? min($qc, $ac) : $qc,
        'leaderboardPublic' => (bool) setting('leaderboardPublic'), 'showExplanations' => setting('showExplanations', true) !== false, 'registrationOpen' => setting('registrationOpen', true) !== false,
        'quiz' => quiz_state() + ['serverNow' => now_ms()], 'splash' => ['icon' => (string) setting('splashIcon', ''), 'visual' => (string) setting('splashVisual', ''), 'kicker' => (string) setting('splashKicker', 'World AMR Awareness Week'), 'cta' => (string) setting('splashCta', 'Register Now'), 'theme' => (array) (setting('splashTheme') ?: []), 'headline' => (string) setting('splashHeadline', 'Battle of Interns'), 'sub' => (string) setting('splashSub', '')],
        'banners' => ['top' => setting('bannerTop') ?: default_settings()['bannerTop'], 'popup' => setting('bannerPopup') ?: default_settings()['bannerPopup']],
        'terms' => (string) setting('terms', default_terms()), 'institutions' => institutions(), 'demo' => false];
}
function q_row_to_arr(array $r): array {
    return ['id' => $r['id'], 'text' => $r['text'], 'options' => ['A' => $r['opt_a'], 'B' => $r['opt_b'], 'C' => $r['opt_c'], 'D' => $r['opt_d']], 'correct' => $r['correct'], 'explanation' => $r['explanation'], 'active' => (bool) $r['active']];
}
function questions_by_id(array $ids): array {
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $st = db()->prepare("SELECT * FROM questions WHERE id IN ($in)"); $st->execute($ids);
    $m = []; foreach ($st as $r) { $m[$r['id']] = q_row_to_arr($r); } return $m;
}
function norm_bmdc(string $v): string { return mb_substr(trim(preg_replace('/\s+/', ' ', strtoupper($v))), 0, 40); }
function derived_password(string $birthDay, string $phone): string { return $birthDay . substr($phone, -4); }
function norm_phone(string $v): string { $v = preg_replace('/[^\d+]/', '', $v); $v = preg_replace('/^\+?88/', '', $v); return $v; }
function materials_list(bool $all = false): array {
    $rows = []; foreach (db()->query('SELECT * FROM materials ' . ($all ? '' : 'WHERE visible=1 ') . 'ORDER BY sort, created_at') as $r) { $rows[] = ['id' => $r['id'], 'title' => $r['title'], 'description' => $r['description'], 'url' => $r['url'], 'type' => $r['type'], 'size' => $r['size'] !== null ? (int) $r['size'] : null, 'visible' => (bool) $r['visible'], 'createdAt' => (int) $r['created_at']]; }
    return $rows;
}

/* ---------- participants ---------- */
function participant_by_token(string $token): array {
    if ($token === '') fail('Please log in.', 401);
    $st = db()->prepare('SELECT * FROM participants WHERE token=?'); $st->execute([$token]);
    $p = $st->fetch(PDO::FETCH_ASSOC); if (!$p) fail('Your session has expired. Please log in again.', 401); return $p;
}
function attempt_of(string $pid): ?array {
    $st = db()->prepare('SELECT * FROM attempts WHERE participant_id=?'); $st->execute([$pid]); $a = $st->fetch(PDO::FETCH_ASSOC); return $a ?: null;
}
function score_attempt(array $a): array {
    $order = json_decode($a['order_json'], true) ?: []; $answers = json_decode($a['answers_json'] ?: '{}', true) ?: [];
    $qs = questions_by_id($order); $c = $w = $sk = 0;
    foreach ($order as $qid) { $ans = $answers[$qid] ?? null; if (!$ans) $sk++; elseif (isset($qs[$qid]) && $ans === $qs[$qid]['correct']) $c++; else $w++; }
    $dur = (int) round(($a['ends_at'] - $a['started_at']) / 1000);
    $tt = min((int) round(($a['submitted_at'] - $a['started_at']) / 1000), $dur);
    return ['score' => $c, 'correct' => $c, 'wrong' => $w, 'skipped' => $sk, 'total' => count($order), 'time_taken_sec' => max(0, $tt)];
}
function rank_of(string $attemptId): ?int {
    $st = db()->prepare("SELECT score, time_taken_sec, submitted_at FROM attempts WHERE id=? AND status='completed'"); $st->execute([$attemptId]); $a = $st->fetch(PDO::FETCH_ASSOC); if (!$a) return null;
    $st = db()->prepare("SELECT COUNT(*) FROM attempts WHERE status='completed' AND (score > ? OR (score = ? AND time_taken_sec < ?) OR (score = ? AND time_taken_sec = ? AND submitted_at < ?))");
    $st->execute([$a['score'], $a['score'], $a['time_taken_sec'], $a['score'], $a['time_taken_sec'], $a['submitted_at']]);
    return (int) $st->fetchColumn() + 1;
}
function result_payload(array $a, array $p): array {
    $order = json_decode($a['order_json'], true) ?: []; $answers = json_decode($a['answers_json'] ?: '{}', true) ?: []; $qs = questions_by_id($order);
    $review = []; $n = 0; $showExp = setting('showExplanations', true) !== false;
    foreach ($order as $qid) {
        $n++; $q = $qs[$qid] ?? ['text' => '(question removed)', 'options' => [], 'correct' => '', 'explanation' => '']; $ya = $answers[$qid] ?? null;
        $opts = []; foreach (['A', 'B', 'C', 'D'] as $k) { if (!empty($q['options'][$k])) $opts[] = ['key' => $k, 'text' => $q['options'][$k]]; }
        $review[] = $showExp ? ['number' => $n, 'id' => $qid, 'text' => $q['text'], 'options' => $opts, 'correct' => $q['correct'], 'yourAnswer' => $ya, 'isCorrect' => $ya !== null && $ya === $q['correct'], 'explanation' => $q['explanation']]
                             : ['number' => $n, 'id' => $qid, 'text' => $q['text'], 'options' => $opts, 'yourAnswer' => $ya, 'isCorrect' => $ya !== null && $ya === $q['correct']];
    }
    $total = (int) db()->query("SELECT COUNT(*) FROM attempts WHERE status='completed'")->fetchColumn();
    return ['completed' => true, 'name' => $p['name'], 'score' => (int) $a['score'], 'total' => (int) $a['total'], 'correct' => (int) $a['correct'], 'wrong' => (int) $a['wrong'], 'skipped' => (int) $a['skipped'], 'timeTakenSec' => (int) $a['time_taken_sec'], 'rank' => rank_of($a['id']), 'totalParticipants' => $total, 'showExplanations' => $showExp, 'review' => $review];
}
function me_payload(array $p): array {
    $a = attempt_of($p['id']); $att = null;
    if ($a) { $att = ['status' => $a['status'], 'score' => $a['score'] !== null ? (int) $a['score'] : null, 'total' => $a['total'] !== null ? (int) $a['total'] : null, 'timeTakenSec' => $a['time_taken_sec'] !== null ? (int) $a['time_taken_sec'] : null, 'rank' => $a['status'] === 'completed' ? rank_of($a['id']) : null, 'endsAt' => (int) $a['ends_at']]; }
    return ['participant' => ['id' => $p['id'], 'name' => $p['name'], 'phone' => $p['phone'], 'email' => $p['email'], 'bmdc' => $p['bmdc'], 'institution' => $p['institution'], 'birthDay' => $p['birth_day'] ?? ''], 'attempt' => $att, 'materials' => materials_list(false)];
}

/* ---------- admin auth ---------- */
function admin_token_make(): string {
    global $CFG; $exp = time() + (int) $CFG['admin_session_seconds'];
    return $exp . '.' . hash_hmac('sha256', (string) $exp, $CFG['secret'] . setting('admin_hash'));
}
function admin_ok(): bool {
    global $CFG; $t = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ($_POST['adminToken'] ?? ''); $parts = explode('.', $t);
    if (count($parts) !== 2 || (int) $parts[0] < time()) return false;
    return hash_equals(hash_hmac('sha256', $parts[0], $CFG['secret'] . setting('admin_hash')), $parts[1]);
}
function require_admin(): void { if (!admin_ok()) fail('Unauthorised. Please sign in.', 401); }
function csv_line(array $cells): string {
    return implode(',', array_map(fn($v) => preg_match('/[",\n=]/', (string) $v) ? '"' . str_replace('"', '""', (string) $v) . '"' : (string) $v, $cells)) . "\r\n";
}
function csv_phone(string $p): string { return '="' . $p . '"'; } // keeps the leading 0 when opened in Excel
function csv_line_raw(array $cells): string {
    return implode(',', array_map(fn($v) => (is_string($v) && str_starts_with($v, '="')) ? $v : (preg_match('/[",\n]/', (string) $v) ? '"' . str_replace('"', '""', (string) $v) . '"' : (string) $v), $cells)) . "\r\n";
}
function participant_row(array $r): array {
    return ['id' => $r['id'], 'name' => $r['name'], 'email' => $r['email'], 'bmdc' => $r['bmdc'], 'phone' => $r['phone'], 'institution' => $r['institution'], 'birthDay' => $r['birth_day'] ?? '', 'registeredAt' => (int) $r['registered_at'], 'lastLoginAt' => $r['last_login_at'] ? (int) $r['last_login_at'] : null, 'status' => $r['status'] ?: 'registered', 'score' => $r['score'] !== null ? (int) $r['score'] : null, 'total' => $r['total'] !== null ? (int) $r['total'] : null, 'timeTakenSec' => $r['time_taken_sec'] !== null ? (int) $r['time_taken_sec'] : null, 'tabSwitches' => (int) ($r['tab_switches'] ?? 0), 'submittedAt' => $r['submitted_at'] ? (int) $r['submitted_at'] : null, 'late' => (bool) ($r['late'] ?? false), 'inBase' => (bool) ($r['in_base'] ?? false)];
}
const PARTICIPANT_SQL = "SELECT p.*, a.id aid, a.status, a.score, a.total, a.time_taken_sec, a.tab_switches, a.submitted_at, a.late, (SELECT 1 FROM sms_base b WHERE b.phone=p.phone) in_base FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id";

/* ---------- routing ---------- */
$route = $_GET['r'] ?? '';
$in = json_decode((string) file_get_contents('php://input'), true) ?: [];
db();

switch ($route) {
    case 'settings':
        out(public_settings());

    case 'register': {
        if (setting('registrationOpen', true) === false) fail('Registration is closed.');
        $name = s($in['name'] ?? ''); $email = strtolower(s($in['email'] ?? '')); $bmdc = norm_bmdc(s($in['bmdc'] ?? '')); $phone = norm_phone(s($in['phone'] ?? '')); $inst = s($in['institution'] ?? '');
        $bd = preg_replace('/\D/', '', s($in['birthDay'] ?? '')); if ($bd !== '' && strlen($bd) === 1) $bd = '0' . $bd;
        if (mb_strlen($name) < 3) fail('Enter your full name.');
        if (!preg_match('/^01[3-9]\d{8}$/', $phone)) fail('Enter an 11-digit Bangladeshi mobile number.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
        if (mb_strlen($inst) < 3) fail('Select or type your medical college.');
        if (!preg_match('/^(0[1-9]|[12]\d|3[01])$/', $bd)) fail('Enter the day of the month you were born (01 to 31).');
        if (empty($in['consent'])) fail('Please accept the terms and conditions to continue.');
        $st = db()->prepare('SELECT phone, bmdc, email FROM participants WHERE phone=? OR email=? OR (bmdc<>\'\' AND bmdc=?) LIMIT 1'); $st->execute([$phone, $email, $bmdc]);
        if ($ex = $st->fetch(PDO::FETCH_ASSOC)) {
            if ($ex['phone'] === $phone) fail('This mobile number is already registered. Log in instead.');
            if ($bmdc !== '' && $ex['bmdc'] === $bmdc) fail('This BMDC number is already registered. Log in with the mobile number you used.');
            fail('This email is already registered. Log in with the mobile number you used.');
        }
        $id = uid(); $token = 't_' . bin2hex(random_bytes(16));
        db()->prepare('INSERT INTO participants (id,token,name,email,bmdc,phone,institution,password_hash,birth_day,registered_at,last_login_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute([$id, $token, mb_substr($name, 0, 80), $email, $bmdc, $phone, mb_substr($inst, 0, 120), password_hash(derived_password($bd, $phone), PASSWORD_DEFAULT), $bd, now_ms(), now_ms()]);
        out(['token' => $token]);
    }

    case 'login': {
        usleep(250000);
        $phone = norm_phone(s($in['phone'] ?? '')); $pw = (string) ($in['password'] ?? '');
        $st = db()->prepare('SELECT * FROM participants WHERE phone=?'); $st->execute([$phone]); $p = $st->fetch(PDO::FETCH_ASSOC);
        if (!$p || !$p['password_hash'] || !password_verify($pw, $p['password_hash'])) fail('Mobile number or password is incorrect.', 401);
        if (!$p['token']) { $p['token'] = 't_' . bin2hex(random_bytes(16)); db()->prepare('UPDATE participants SET token=? WHERE id=?')->execute([$p['token'], $p['id']]); }
        db()->prepare('UPDATE participants SET last_login_at=? WHERE id=?')->execute([now_ms(), $p['id']]);
        out(['token' => $p['token']]);
    }

    case 'me': { $p = participant_by_token(s($in['token'] ?? '')); out(me_payload($p)); }

    case 'logout': { out(['ok' => true]); }

    case 'start': {
        $p = participant_by_token(s($in['token'] ?? '')); $a = attempt_of($p['id']);
        if ($a && $a['status'] === 'completed') fail('You have already completed the quiz.');
        if (!$a) {
            $qs = quiz_state(); if ($qs['state'] !== 'open') fail($qs['state'] === 'closed' ? 'The quiz is closed.' : 'The quiz has not opened yet.');
            $ids = db()->query('SELECT id FROM questions WHERE active=1 ORDER BY sort, created_at')->fetchAll(PDO::FETCH_COLUMN);
            if (!$ids) fail('No questions are available yet.');
            if (setting('shuffle', true)) shuffle($ids);
            $ids = array_slice($ids, 0, max(1, (int) setting('questionCount', 25)));
            $now = now_ms(); $dur = (int) setting('durationSec', 600);
            $a = ['id' => uid(), 'participant_id' => $p['id'], 'started_at' => $now, 'ends_at' => $now + $dur * 1000, 'order_json' => json_encode(array_values($ids)), 'answers_json' => '{}', 'tab_switches' => 0, 'status' => 'in_progress'];
            db()->prepare('INSERT INTO attempts (id,participant_id,started_at,ends_at,order_json,answers_json,tab_switches,status) VALUES (?,?,?,?,?,?,?,?)')->execute([$a['id'], $a['participant_id'], $a['started_at'], $a['ends_at'], $a['order_json'], $a['answers_json'], 0, 'in_progress']);
        }
        $order = json_decode($a['order_json'], true) ?: []; $qs = questions_by_id($order); $list = [];
        foreach ($order as $qid) {
            $q = $qs[$qid] ?? null; $opts = [];
            if ($q) foreach (['A', 'B', 'C', 'D'] as $k) { if (!empty($q['options'][$k])) $opts[] = ['key' => $k, 'text' => $q['options'][$k]]; }
            $list[] = ['id' => $qid, 'text' => $q ? $q['text'] : '(removed)', 'options' => $opts]; // correct answers never leave the server
        }
        out(['attemptId' => $a['id'], 'startedAt' => (int) $a['started_at'], 'endsAt' => (int) $a['ends_at'], 'durationSec' => (int) setting('durationSec', 600), 'questions' => $list, 'answers' => json_decode($a['answers_json'] ?: '{}', true) ?: new stdClass(), 'tabSwitches' => (int) $a['tab_switches'], 'serverNow' => now_ms()]);
    }

    case 'progress':
    case 'submit': {
        global $CFG;
        $p = participant_by_token(s($in['token'] ?? '')); $a = attempt_of($p['id']);
        if (!$a) fail('No attempt found. Please start the quiz first.');
        if ($a['status'] === 'completed') { if ($route === 'submit') out(result_payload($a, $p)); out(['ok' => true]); }
        $late = now_ms() > (int) $a['ends_at'] + (int) $CFG['grace_seconds'] * 1000;
        $answers = json_decode($a['answers_json'] ?: '{}', true) ?: [];
        if (!$late) {
            $order = json_decode($a['order_json'], true) ?: [];
            foreach ((array) ($in['answers'] ?? []) as $qid => $k) { if (in_array($qid, $order, true) && preg_match('/^[ABCD]$/', (string) $k)) $answers[$qid] = (string) $k; }
        }
        $tabs = max((int) $a['tab_switches'], (int) ($in['tabSwitches'] ?? 0));
        if ($route === 'progress') { db()->prepare('UPDATE attempts SET answers_json=?, tab_switches=? WHERE id=?')->execute([json_encode($answers, JSON_FORCE_OBJECT), $tabs, $a['id']]); out(['ok' => true]); }
        $a['answers_json'] = json_encode($answers, JSON_FORCE_OBJECT); $a['submitted_at'] = now_ms();
        $sc = score_attempt($a);
        db()->prepare("UPDATE attempts SET answers_json=?, tab_switches=?, status='completed', submitted_at=?, score=?, total=?, correct=?, wrong=?, skipped=?, time_taken_sec=?, late=? WHERE id=?")
            ->execute([$a['answers_json'], $tabs, $a['submitted_at'], $sc['score'], $sc['total'], $sc['correct'], $sc['wrong'], $sc['skipped'], $sc['time_taken_sec'], $late ? 1 : 0, $a['id']]);
        out(result_payload(attempt_of($p['id']), $p));
    }

    case 'result': {
        $p = participant_by_token(s($in['token'] ?? '')); $a = attempt_of($p['id']);
        if (!$a || $a['status'] !== 'completed') out(['completed' => false]);
        out(result_payload($a, $p));
    }

    case 'leaderboard': {
        if (!setting('leaderboardPublic') && !admin_ok()) fail('The ranking board is not public right now.', 403);
        $meId = null; $m = null; if ($t = s($in['token'] ?? '')) { $st = db()->prepare('SELECT id, name FROM participants WHERE token=?'); $st->execute([$t]); if ($m = $st->fetch(PDO::FETCH_ASSOC)) $meId = $m['id']; }
        $rows = []; $i = 0;
        $q = db()->query("SELECT a.id, a.participant_id, a.score, a.total, a.time_taken_sec, p.name, p.institution FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.status='completed' ORDER BY a.score DESC, a.time_taken_sec ASC, a.submitted_at ASC LIMIT 50");
        foreach ($q as $r) { $i++; $rows[] = ['rank' => $i, 'name' => $r['name'], 'institution' => $r['institution'], 'score' => (int) $r['score'], 'total' => (int) $r['total'], 'timeTakenSec' => (int) $r['time_taken_sec'], 'isMe' => $meId !== null && $r['participant_id'] === $meId]; }
        $total = (int) db()->query("SELECT COUNT(*) FROM attempts WHERE status='completed'")->fetchColumn();
        $me = null;
        if ($meId) { $a = attempt_of($meId); if ($a && $a['status'] === 'completed') { $me = ['rank' => rank_of($a['id']), 'name' => $m['name'], 'score' => (int) $a['score'], 'total' => (int) $a['total'], 'timeTakenSec' => (int) $a['time_taken_sec']]; } }
        out(['rows' => $rows, 'totalParticipants' => $total, 'me' => $me]);
    }

    /* ---------- admin ---------- */
    case 'admin/login': {
        usleep(300000);
        if (!password_verify((string) ($in['password'] ?? ''), (string) setting('admin_hash'))) fail('Wrong password.', 401);
        out(['adminToken' => admin_token_make()]);
    }
    case 'admin/stats': {
        require_admin();
        $done = (int) db()->query("SELECT COUNT(*) FROM attempts WHERE status='completed'")->fetchColumn();
        $agg = db()->query("SELECT AVG(score) s, AVG(time_taken_sec) t FROM attempts WHERE status='completed'")->fetch(PDO::FETCH_ASSOC);
        $stats = []; $qs = db()->query('SELECT * FROM questions ORDER BY sort, created_at')->fetchAll(PDO::FETCH_ASSOC);
        $attempts = db()->query("SELECT order_json, answers_json FROM attempts WHERE status='completed'")->fetchAll(PDO::FETCH_ASSOC);
        $decoded = array_map(fn($a) => [json_decode($a['order_json'], true) ?: [], json_decode($a['answers_json'] ?: '{}', true) ?: []], $attempts);
        foreach ($qs as $q) { $n = $c = 0; foreach ($decoded as [$o, $ans]) { if (in_array($q['id'], $o, true)) { $n++; if (($ans[$q['id']] ?? null) === $q['correct']) $c++; } } $stats[] = ['id' => $q['id'], 'text' => $q['text'], 'attempts' => $n, 'correct' => $c]; }
        $ac = active_count(); $base = (int) db()->query('SELECT COUNT(*) FROM sms_base')->fetchColumn();
        $fromBase = (int) db()->query('SELECT COUNT(*) FROM participants p WHERE EXISTS (SELECT 1 FROM sms_base b WHERE b.phone=p.phone)')->fetchColumn();
        out(['participants' => (int) db()->query('SELECT COUNT(*) FROM participants')->fetchColumn(), 'completed' => $done, 'inProgress' => (int) db()->query("SELECT COUNT(*) FROM attempts WHERE status='in_progress'")->fetchColumn(), 'total' => $ac ? min((int) setting('questionCount', 25), $ac) : (int) setting('questionCount', 25), 'avgScore' => (float) ($agg['s'] ?? 0), 'avgTimeSec' => (float) ($agg['t'] ?? 0), 'questionStats' => $stats, 'quiz' => quiz_state(), 'smsBase' => $base, 'fromBase' => $fromBase]);
    }
    case 'admin/questions': { require_admin(); out(array_map('q_row_to_arr', db()->query('SELECT * FROM questions ORDER BY sort, created_at')->fetchAll(PDO::FETCH_ASSOC))); }
    case 'admin/question-save': {
        require_admin();
        $o = (array) ($in['options'] ?? []); $text = s($in['text'] ?? ''); $correct = strtoupper(s($in['correct'] ?? ''));
        if ($text === '' || !preg_match('/^[ABCD]$/', $correct) || count(array_filter(['A', 'B', 'C', 'D'], fn($k) => s($o[$k] ?? '') === ''))) fail('Fill in the question, all four options and the correct option.');
        $vals = [$text, s($o['A']), s($o['B']), s($o['C']), s($o['D']), $correct, s($in['explanation'] ?? ''), empty($in['active']) ? 0 : 1];
        if (!empty($in['id'])) { $st = db()->prepare('UPDATE questions SET text=?, opt_a=?, opt_b=?, opt_c=?, opt_d=?, correct=?, explanation=?, active=? WHERE id=?'); $st->execute([...$vals, $in['id']]); if (!$st->rowCount()) fail('Question not found.', 404); }
        else { $sort = (int) db()->query('SELECT COALESCE(MAX(sort),0)+1 FROM questions')->fetchColumn(); db()->prepare('INSERT INTO questions (id,text,opt_a,opt_b,opt_c,opt_d,correct,explanation,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute([uid(), ...$vals, $sort, now_ms()]); }
        out(['ok' => true]);
    }
    case 'admin/question-delete': { require_admin(); db()->prepare('DELETE FROM questions WHERE id=?')->execute([s($in['id'] ?? '')]); out(['ok' => true]); }
    case 'admin/question-import': {
        require_admin(); $list = (array) ($in['questions'] ?? []); $n = 0;
        db()->beginTransaction();
        if (!empty($in['replace'])) db()->exec('DELETE FROM questions');
        $sort = (int) db()->query('SELECT COALESCE(MAX(sort),0) FROM questions')->fetchColumn();
        $st = db()->prepare('INSERT INTO questions (id,text,opt_a,opt_b,opt_c,opt_d,correct,explanation,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)');
        foreach ($list as $q) {
            $o = (array) ($q['options'] ?? []); $c = strtoupper(s($q['correct'] ?? ''));
            if (s($q['text'] ?? '') === '' || !preg_match('/^[ABCD]$/', $c) || s($o['A'] ?? '') === '' || s($o['B'] ?? '') === '' || s($o['C'] ?? '') === '' || s($o['D'] ?? '') === '') continue;
            $st->execute([uid(), s($q['text']), s($o['A']), s($o['B']), s($o['C']), s($o['D']), $c, s($q['explanation'] ?? ''), ++$sort, now_ms()]); $n++;
        }
        db()->commit(); out(['count' => $n]);
    }
    case 'admin/participants': {
        require_admin(); $q = '%' . strtolower(s($in['q'] ?? '')) . '%';
        $st = db()->prepare(PARTICIPANT_SQL . " WHERE lower(p.name) LIKE ? OR lower(p.bmdc) LIKE ? OR p.phone LIKE ? OR lower(p.email) LIKE ? OR lower(COALESCE(p.institution,'')) LIKE ? ORDER BY p.registered_at DESC");
        $st->execute([$q, $q, $q, $q, $q]); out(array_map('participant_row', $st->fetchAll(PDO::FETCH_ASSOC)));
    }
    case 'admin/participant-answers': {
        require_admin(); $a = attempt_of(s($in['id'] ?? '')); if (!$a) fail('No attempt.', 404);
        $order = json_decode($a['order_json'], true) ?: []; $ans = json_decode($a['answers_json'] ?: '{}', true) ?: []; $qs = questions_by_id($order); $rows = [];
        foreach ($order as $qid) { $q = $qs[$qid] ?? ['text' => '(removed)', 'correct' => '']; $rows[] = ['text' => $q['text'], 'answer' => $ans[$qid] ?? null, 'correct' => $q['correct'], 'isCorrect' => ($ans[$qid] ?? null) === $q['correct']]; }
        out($rows);
    }
    case 'admin/participant-delete': { require_admin(); db()->prepare('DELETE FROM participants WHERE id=?')->execute([s($in['id'] ?? '')]); out(['ok' => true]); }
    case 'admin/participant-password': {
        require_admin(); $pw = (string) ($in['newPassword'] ?? ''); if (strlen($pw) < 6) fail('Password must be at least 6 characters.');
        $st = db()->prepare('UPDATE participants SET password_hash=? WHERE id=?'); $st->execute([password_hash($pw, PASSWORD_DEFAULT), s($in['id'] ?? '')]); if (!$st->rowCount()) fail('Participant not found.', 404); out(['ok' => true]);
    }
    case 'admin/participant-reset-attempt': {
        require_admin(); db()->prepare('DELETE FROM attempts WHERE participant_id=?')->execute([s($in['id'] ?? '')]); out(['ok' => true]);
    }
    case 'admin/export': {
        require_admin(); $stamp = date('Y-m-d'); $kind = s($in['kind'] ?? 'participants');
        if ($kind === 'answers') {
            $csv = csv_line(['name', 'phone', 'bmdc', 'question_no', 'question', 'answer', 'correct_option', 'is_correct']);
            $q = db()->query("SELECT a.order_json, a.answers_json, p.name, p.bmdc, p.phone FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.status='completed' ORDER BY a.submitted_at");
            foreach ($q as $r) { $order = json_decode($r['order_json'], true) ?: []; $ans = json_decode($r['answers_json'] ?: '{}', true) ?: []; $qs = questions_by_id($order); $n = 0;
                foreach ($order as $qid) { $n++; $qq = $qs[$qid] ?? ['text' => '', 'correct' => '']; $csv .= csv_line_raw([$r['name'], csv_phone($r['phone']), $r['bmdc'], $n, $qq['text'], $ans[$qid] ?? '', $qq['correct'], (($ans[$qid] ?? null) === $qq['correct']) ? 1 : 0]); } }
            out(['filename' => "battle-of-interns-answers-$stamp.csv", 'csv' => $csv]);
        }
        if ($kind === 'smsmatch') {
            $csv = csv_line(['phone', 'in_sms_base', 'registered', 'name', 'bmdc', 'email', 'institution', 'status', 'score', 'total', 'time_taken_sec', 'rank', 'registered_at']);
            $ps = []; foreach (db()->query(PARTICIPANT_SQL) as $r) { $ps[$r['phone']] = $r; }
            foreach (db()->query('SELECT phone FROM sms_base ORDER BY phone') as $b) {
                $r = $ps[$b['phone']] ?? null;
                $csv .= csv_line_raw([csv_phone($b['phone']), 'yes', $r ? 'yes' : 'no', $r['name'] ?? '', $r['bmdc'] ?? '', $r['email'] ?? '', $r['institution'] ?? '', $r ? ($r['status'] ?: 'registered') : '', $r['score'] ?? '', $r['total'] ?? '', $r['time_taken_sec'] ?? '', ($r && $r['status'] === 'completed') ? rank_of($r['aid']) : '', $r ? gmdate('c', (int) ($r['registered_at'] / 1000)) : '']);
                unset($ps[$b['phone']]);
            }
            foreach ($ps as $r) { $csv .= csv_line_raw([csv_phone($r['phone']), 'no', 'yes', $r['name'], $r['bmdc'], $r['email'], $r['institution'], $r['status'] ?: 'registered', $r['score'] ?? '', $r['total'] ?? '', $r['time_taken_sec'] ?? '', $r['status'] === 'completed' ? rank_of($r['aid']) : '', gmdate('c', (int) ($r['registered_at'] / 1000))]); }
            out(['filename' => "battle-of-interns-sms-base-match-$stamp.csv", 'csv' => $csv]);
        }
        $csv = csv_line(['rank', 'name', 'phone', 'bmdc', 'email', 'institution', 'birth_day', 'in_sms_base', 'registered_at', 'status', 'score', 'total', 'time_taken_sec', 'tab_switches', 'late_submission', 'submitted_at']);
        foreach (db()->query(PARTICIPANT_SQL . ' ORDER BY a.score DESC, a.time_taken_sec ASC, p.registered_at ASC') as $r) { $csv .= csv_line_raw([$r['status'] === 'completed' ? rank_of($r['aid']) : '', $r['name'], csv_phone($r['phone']), $r['bmdc'], $r['email'], $r['institution'], csv_phone((string) ($r['birth_day'] ?? '')), $r['in_base'] ? 'yes' : 'no', gmdate('c', (int) ($r['registered_at'] / 1000)), $r['status'] ?: 'registered', $r['score'] ?? '', $r['total'] ?? '', $r['time_taken_sec'] ?? '', $r['tab_switches'] ?? 0, !empty($r['late']) ? 'yes' : '', $r['submitted_at'] ? gmdate('c', (int) ($r['submitted_at'] / 1000)) : '']); }
        out(['filename' => "battle-of-interns-participants-$stamp.csv", 'csv' => $csv]);
    }
    case 'admin/ranking': {
        require_admin(); $rows = []; $i = 0;
        $q = db()->query("SELECT a.score, a.total, a.time_taken_sec, a.submitted_at, a.late, a.tab_switches, p.name, p.phone, p.bmdc, p.email, p.institution, (SELECT 1 FROM sms_base b WHERE b.phone=p.phone) in_base FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.status='completed' ORDER BY a.score DESC, a.time_taken_sec ASC, a.submitted_at ASC");
        foreach ($q as $r) { $i++; $rows[] = ['rank' => $i, 'name' => $r['name'], 'phone' => $r['phone'], 'bmdc' => $r['bmdc'], 'email' => $r['email'], 'institution' => $r['institution'], 'score' => (int) $r['score'], 'total' => (int) $r['total'], 'timeTakenSec' => (int) $r['time_taken_sec'], 'submittedAt' => (int) $r['submitted_at'], 'late' => (bool) $r['late'], 'tabSwitches' => (int) $r['tab_switches'], 'inBase' => (bool) $r['in_base']]; }
        out(['rows' => $rows, 'leaderboardPublic' => (bool) setting('leaderboardPublic')]);
    }
    case 'admin/institutions': { require_admin(); out(institutions()); }
    case 'admin/institutions-save': {
        require_admin(); $list = $in['institutions'] ?? null;
        if ($list === null) { set_setting('institutions', default_institutions()); out(['ok' => true]); }
        if (!is_array($list)) fail('Send a list of names.');
        $clean = []; foreach ($list as $n) { $n = mb_substr(s($n), 0, 120); if ($n !== '' && !in_array($n, $clean, true)) $clean[] = $n; }
        set_setting('institutions', $clean); out(['ok' => true]);
    }
    case 'admin/materials': { require_admin(); out(materials_list(true)); }
    case 'admin/material-save': {
        require_admin(); $title = s($in['title'] ?? ''); $url = s($in['url'] ?? ''); if ($title === '' || $url === '') fail('Give the material a title and a file or link.');
        $type = s($in['type'] ?? ''); if ($type === '') { $ext = strtolower(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION)); $type = in_array($ext, ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'pptx', 'png', 'jpg', 'jpeg'], true) ? $ext : 'link'; }
        if (!empty($in['id'])) { $st = db()->prepare('UPDATE materials SET title=?, description=?, url=?, type=?, size=?, visible=? WHERE id=?'); $st->execute([$title, s($in['description'] ?? ''), $url, $type, $in['size'] ?? null, empty($in['visible']) ? 0 : 1, $in['id']]); if (!$st->rowCount()) fail('Material not found.', 404); }
        else { $sort = (int) db()->query('SELECT COALESCE(MAX(sort),0)+1 FROM materials')->fetchColumn(); db()->prepare('INSERT INTO materials (id,title,description,url,type,size,sort,visible,created_at) VALUES (?,?,?,?,?,?,?,?,?)')->execute([uid(), $title, s($in['description'] ?? ''), $url, $type, $in['size'] ?? null, $sort, isset($in['visible']) && !$in['visible'] ? 0 : 1, now_ms()]); }
        out(['ok' => true]);
    }
    case 'admin/material-delete': { require_admin(); db()->prepare('DELETE FROM materials WHERE id=?')->execute([s($in['id'] ?? '')]); out(['ok' => true]); }
    case 'admin/material-order': { require_admin(); $i = 0; $st = db()->prepare('UPDATE materials SET sort=? WHERE id=?'); foreach ((array) ($in['ids'] ?? []) as $id) { $st->execute([$i++, (string) $id]); } out(['ok' => true]); }
    case 'admin/upload': {
        require_admin();
        $kind = s($_POST['kind'] ?? 'materials'); if (!in_array($kind, ['materials', 'banners', 'splash'], true)) fail('Unknown upload type.');
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) { $e = $_FILES['file']['error'] ?? -1; fail($e === UPLOAD_ERR_INI_SIZE || $e === UPLOAD_ERR_FORM_SIZE ? 'The file is larger than the server allows. Ask the developer to raise upload_max_filesize and post_max_size in PHP.' : 'Upload failed. Please try again.'); }
        $f = $_FILES['file']; $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        $allowed = $kind === 'materials' ? ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'pptx', 'png', 'jpg', 'jpeg'] : ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        if (!in_array($ext, $allowed, true)) fail('File type not allowed. Allowed: ' . implode(', ', $allowed) . '.');
        $dir = __DIR__ . '/../uploads/' . $kind; if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $base = preg_replace('/[^A-Za-z0-9_-]+/', '-', pathinfo($f['name'], PATHINFO_FILENAME)); $base = trim(mb_substr($base, 0, 60), '-') ?: 'file';
        $name = $base . '-' . substr(uid(), 0, 6) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) fail('Could not save the file. Check that public/uploads is writable.', 500);
        @chmod("$dir/$name", 0644);
        out(['url' => "uploads/$kind/$name", 'name' => $f['name'], 'size' => (int) $f['size'], 'type' => $ext]);
    }
    case 'admin/smsbase-upload': {
        require_admin(); $list = (array) ($in['phones'] ?? []); $n = $bad = 0;
        db()->beginTransaction(); if (!empty($in['replace'])) db()->exec('DELETE FROM sms_base');
        $st = db()->prepare('INSERT OR IGNORE INTO sms_base (phone, added_at) VALUES (?,?)');
        foreach ($list as $raw) { $ph = norm_phone(s($raw)); if (preg_match('/^01[3-9]\d{8}$/', $ph)) { $st->execute([$ph, now_ms()]); $n++; } else $bad++; }
        db()->commit(); out(['added' => $n, 'invalid' => $bad, 'total' => (int) db()->query('SELECT COUNT(*) FROM sms_base')->fetchColumn()]);
    }
    case 'admin/smsbase-stats': {
        require_admin();
        out(['total' => (int) db()->query('SELECT COUNT(*) FROM sms_base')->fetchColumn(), 'registered' => (int) db()->query('SELECT COUNT(*) FROM participants p WHERE EXISTS (SELECT 1 FROM sms_base b WHERE b.phone=p.phone)')->fetchColumn(), 'completed' => (int) db()->query("SELECT COUNT(*) FROM participants p JOIN attempts a ON a.participant_id=p.id WHERE a.status='completed' AND EXISTS (SELECT 1 FROM sms_base b WHERE b.phone=p.phone)")->fetchColumn(), 'outsideBase' => (int) db()->query('SELECT COUNT(*) FROM participants p WHERE NOT EXISTS (SELECT 1 FROM sms_base b WHERE b.phone=p.phone)')->fetchColumn()]);
    }
    case 'admin/smsbase-clear': { require_admin(); db()->exec('DELETE FROM sms_base'); out(['ok' => true]); }
    case 'admin/settings': { require_admin(); out(all_settings()); }
    case 'admin/settings-save': {
        require_admin();
        $allowed = ['campaignName' => 'string', 'sponsor' => 'string', 'durationSec' => 'int', 'questionCount' => 'int', 'shuffle' => 'bool', 'leaderboardPublic' => 'bool', 'showExplanations' => 'bool', 'registrationOpen' => 'bool',
            'quizMode' => 'string', 'quizOpen' => 'bool', 'quizStartAt' => 'int?', 'quizEndAt' => 'int?', 'splashIcon' => 'string', 'splashVisual' => 'string', 'splashKicker' => 'string', 'splashCta' => 'string', 'splashTheme' => 'theme', 'splashHeadline' => 'string', 'splashSub' => 'text', 'terms' => 'text', 'bannerTop' => 'banner', 'bannerPopup' => 'banner'];
        foreach ($allowed as $k => $type) {
            if (!array_key_exists($k, $in)) continue; $v = $in[$k];
            if ($type === 'string') $v = mb_substr(s($v), 0, 300); elseif ($type === 'text') $v = mb_substr(s($v), 0, 5000); elseif ($type === 'int') $v = max(1, (int) $v); elseif ($type === 'int?') $v = $v === null || $v === '' ? null : (int) $v;
            elseif ($type === 'theme') { $v = (array) $v; $col = fn($x) => preg_match('/^#[0-9a-fA-F]{6}$/', (string) $x) ? strtolower((string) $x) : ''; $v = ['bg1' => $col($v['bg1'] ?? ''), 'bg2' => $col($v['bg2'] ?? ''), 'bg3' => $col($v['bg3'] ?? ''), 'cta1' => $col($v['cta1'] ?? ''), 'cta2' => $col($v['cta2'] ?? ''), 'ctaText' => $col($v['ctaText'] ?? ''), 'logoWidth' => max(200, min(900, (int) ($v['logoWidth'] ?? 560))), 'visualWidth' => max(200, min(900, (int) ($v['visualWidth'] ?? 420))), 'hideLogo' => !empty($v['hideLogo']), 'hideVisual' => !empty($v['hideVisual'])]; }
            elseif ($type === 'banner') { $v = (array) $v; $v = ['enabled' => !empty($v['enabled']), 'image' => mb_substr(s($v['image'] ?? ''), 0, 300), 'link' => mb_substr(s($v['link'] ?? ''), 0, 300), 'seconds' => max(3, min(60, (int) ($v['seconds'] ?? 10)))]; }
            else $v = (bool) $v;
            if ($k === 'quizMode' && !in_array($v, ['manual', 'scheduled'], true)) $v = 'manual';
            set_setting($k, $v);
        }
        out(['ok' => true]);
    }
    case 'admin/password': {
        require_admin();
        if (!password_verify((string) ($in['oldPassword'] ?? ''), (string) setting('admin_hash'))) fail('Current password is wrong.');
        if (strlen((string) ($in['newPassword'] ?? '')) < 8) fail('New password must be at least 8 characters.');
        set_setting('admin_hash', password_hash((string) $in['newPassword'], PASSWORD_DEFAULT)); out(['ok' => true]);
    }
    case 'admin/reset': { require_admin(); db()->exec('DELETE FROM attempts; DELETE FROM participants;'); out(['ok' => true]); }
    case 'admin/reset-attempts': { require_admin(); db()->exec('DELETE FROM attempts;'); out(['ok' => true]); }
    default:
        fail('Unknown route.', 404);
}
