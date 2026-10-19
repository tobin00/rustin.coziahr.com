import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Uses an isolated temporary database and a local PHP process. No real maps or
// hosting credentials are read. For portable PHP, set PHP_BIN and PHP_ARGS
// (a JSON array of PHP flags, e.g. SQLite extension configuration).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const php = process.env.PHP_BIN || "php";
const phpArgs = JSON.parse(process.env.PHP_ARGS || "[]");
assert.ok(Array.isArray(phpArgs) && phpArgs.every((arg) => typeof arg === "string"), "PHP_ARGS must be a JSON string array");
const temporary = await mkdtemp(path.join(os.tmpdir(), "rustin-map-api-test-"));
const dataDirectory = path.join(temporary, "private-maps");
async function reservePort() {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const result = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return result;
}
const port = await reservePort();
const origin = `http://127.0.0.1:${port}`;
let server;
let peerServer;
let assertions = 0;

async function startServer(directory = dataDirectory, serverPort = port) {
  let serverOutput = "";
  const processHandle = spawn(php, [...phpArgs, "-d", "display_errors=0", "-S", `127.0.0.1:${serverPort}`, "-t", "site", "tools/php-router.php"], {
    cwd: root,
    env: { ...process.env, RUSTIN_MAPS_DATA_DIR: directory },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  if (serverPort === port) server = processHandle;
  let startupError;
  processHandle.on("error", (error) => { startupError = error; });
  for (const stream of [processHandle.stdout, processHandle.stderr]) {
    stream.on("data", (chunk) => { serverOutput = (serverOutput + chunk).slice(-12000); });
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (startupError) throw new Error(`Could not start PHP. Set PHP_BIN if needed: ${startupError.message}`);
    if (processHandle.exitCode !== null) throw new Error(`PHP exited before starting: ${serverOutput}`);
    try {
      const response = await fetch(`http://127.0.0.1:${serverPort}/`);
      if (response.status === 200) return processHandle;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`PHP did not start: ${serverOutput}`);
}

async function stopServer(processHandle = server) {
  if (!processHandle || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  const stopped = once(processHandle, "exit");
  processHandle.kill();
  await stopped;
}

async function request(query = "", options = {}) {
  const { payload, rawBody, headers = {}, method = "GET", base = origin } = options;
  const response = await fetch(`${base}/api/maps.php${query}`, {
    method,
    headers: { ...(method !== "GET" ? { Origin: base } : {}), ...(payload !== undefined || rawBody !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(payload !== undefined || rawBody !== undefined ? { body: rawBody ?? JSON.stringify(payload) } : {}),
  });
  const body = await response.json();
  return { status: response.status, body, headers: response.headers };
}

function equal(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  assertions += 1;
}

function noSecrets(value, key) {
  const serialized = JSON.stringify(value);
  equal(serialized.includes(key), false, "Public records never expose editing keys");
  equal(/edit_key_hash|editKey|rate_salt/.test(serialized), false, "Public records never expose internal security fields");
}

const initial = { name: "Test traveler", countries: ["US", "HK", "MO", "TW", "PR", "GB", "RU", "US"], states: ["CA", "NY", "CA"], listed: true, website: "" };
try {
  await startServer();
  equal((await request("?action=list")).body.maps, [], "Fresh directory is empty");
  equal((await request("", { method: "PUT" })).status, 405, "Unsupported methods rejected");
  equal((await request("", { method: "POST", payload: initial, headers: { Origin: "https://other.example" } })).status, 403, "Cross-origin writes rejected");
  equal((await request("", { method: "POST", payload: initial, headers: { Origin: origin + ".evil.example" } })).status, 403, "Look-alike origins rejected");
  equal((await request("", { method: "POST", payload: initial, headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403, "Cross-site browser requests rejected");
  equal((await request("", { method: "POST", payload: initial, headers: { "Content-Type": "text/plain" } })).status, 415, "Non-JSON writes rejected");
  equal((await request("", { method: "POST", rawBody: "{" })).status, 400, "Malformed JSON rejected");
  equal((await request("", { method: "POST", rawBody: "[]" })).status, 400, "JSON arrays rejected");
  equal((await request("", { method: "POST", rawBody: " ".repeat(17000) })).status, 413, "Oversized body rejected");
  equal((await request("", { method: "POST", payload: { ...initial, countries: ["UK"] } })).status, 422, "Invalid ISO code rejected");
  equal((await request("", { method: "POST", payload: { ...initial, states: ["DC"] } })).status, 422, "Non-state code rejected");
  equal((await request("", { method: "POST", payload: { ...initial, countries: "US" } })).status, 422, "Code fields require arrays");
  equal((await request("", { method: "POST", payload: { ...initial, name: "x\u0000y" } })).status, 422, "Names reject controls");
  equal((await request("", { method: "POST", payload: { ...initial, name: " " } })).status, 422, "Names cannot be blank");
  equal((await request("", { method: "POST", payload: { ...initial, name: "x".repeat(61) } })).status, 422, "Names have a length limit");
  equal((await request("", { method: "POST", payload: { ...initial, listed: "true" } })).status, 422, "Listing requires explicit boolean consent");
  equal((await request("", { method: "POST", payload: { ...initial, website: "spam" } })).status, 400, "Honeypot rejected");

  const created = await request("", { method: "POST", payload: initial });
  equal(created.status, 201, "Map created");
  const { id, version } = created.body.map;
  const key = created.body.editKey;
  equal(/^[a-f0-9]{24}$/.test(id), true, "Random public ID has expected length");
  equal(/^[a-f0-9]{64}$/.test(key), true, "Private edit key has 256 bits");
  equal(created.body.map.countries, ["GB", "HK", "MO", "PR", "RU", "TW", "US"], "Territories preserved and countries deduplicated");
  equal(created.body.map.states, ["CA", "NY"], "States deduplicated");
  equal(version, 1, "New map version starts at one");
  equal(/Z$/.test(created.body.map.updatedAt), true, "Generated timestamp is UTC");
  const read = await request(`?id=${id}`);
  equal(read.body.map, created.body.map, "Public map can be read");
  noSecrets(read.body, key);
  const hidden = await request("", { method: "POST", payload: { ...initial, name: "Unlisted traveler", listed: false } });
  equal(hidden.status, 201, "Unlisted map created");
  const directory = await request("?action=list");
  equal(directory.body.maps.map((map) => map.id), [id], "Directory includes only opted-in maps");
  noSecrets(directory.body, key);
  equal((await request(`?id=${hidden.body.map.id}`)).body.map.listed, false, "Unlisted maps remain available through their public link");
  equal((await request("?action=list&page=-1")).status, 400, "Invalid directory pages rejected");
  equal((await request("?id=../../maps.sqlite")).status, 400, "Invalid IDs rejected");

  const updated = { ...initial, countries: ["US", "JP"], states: ["AK", "HI"], version };
  equal((await request(`?id=${id}`, { method: "POST", payload: updated })).status, 403, "Public visitors cannot edit");
  equal((await request(`?id=${id}`, { method: "DELETE" })).status, 403, "Public visitors cannot delete");
  equal((await request(`?id=${id}`, { method: "POST", payload: updated, headers: { "X-Map-Edit-Key": "0".repeat(64) } })).status, 403, "Incorrect edit keys rejected");
  const saved = await request(`?id=${id}`, { method: "POST", payload: updated, headers: { "X-Map-Edit-Key": key } });
  equal(saved.status, 200, "Owner can update");
  equal(saved.body.map.version, 2, "Revision increments");
  equal(saved.body.map.countries, ["JP", "US"], "Updated selection saved");
  noSecrets(saved.body, key);
  equal((await request(`?id=${id}`, { method: "POST", payload: updated, headers: { "X-Map-Edit-Key": key } })).status, 409, "Stale revisions cannot overwrite newer edits");

  // Stop PHP entirely; the next process must recover the same private SQLite
  // record and the same edit-key hash from disk.
  await stopServer();
  await startServer();
  equal((await request(`?id=${id}`)).body.map, saved.body.map, "Map survives a new PHP process");
  const unlisted = await request(`?id=${id}`, { method: "POST", payload: { ...updated, listed: false, version: 2 }, headers: { "X-Map-Edit-Key": key } });
  equal(unlisted.status, 200, "Editing key survives process restart");
  equal((await request("?action=list")).body.maps, [], "Removing directory consent immediately hides map");

  // A single PHP development server handles one request at a time, so use a
  // second independent PHP worker sharing the same SQLite file. Paired saves
  // must produce one successful revision and one conflict, never a lock-error
  // 503 or two successful overwrites. Repeat to cover both process schedules.
  const peerPort = await reservePort();
  const peerOrigin = `http://127.0.0.1:${peerPort}`;
  peerServer = await startServer(dataDirectory, peerPort);
  let concurrentVersion = unlisted.body.map.version;
  for (let round = 0; round < 12; round += 1) {
    const common = { ...updated, listed: false, version: concurrentVersion };
    const saves = await Promise.all([
      request(`?id=${id}`, { method: "POST", payload: { ...common, name: `Worker A ${round}` }, headers: { "X-Map-Edit-Key": key } }),
      request(`?id=${id}`, { method: "POST", payload: { ...common, name: `Worker B ${round}` }, headers: { "X-Map-Edit-Key": key }, base: peerOrigin }),
    ]);
    equal(saves.map((save) => save.status).sort(), [200, 409], "Concurrent workers serialize saves and report the stale revision");
    concurrentVersion += 1;
    const winner = saves.find((save) => save.status === 200).body.map;
    equal(winner.version, concurrentVersion, "Concurrent pair increments exactly one revision");
    equal((await request(`?id=${id}`)).body.map, winner, "Concurrent winning update persists without being overwritten");
  }
  await stopServer(peerServer);

  const databaseInspection = JSON.parse(execFileSync(php, [...phpArgs, "-r", '$db = new PDO("sqlite:" . $argv[1]); echo json_encode(["maps" => $db->query("SELECT edit_key_hash FROM maps")->fetchAll(PDO::FETCH_COLUMN), "ips" => $db->query("SELECT subject FROM rate_limits")->fetchAll(PDO::FETCH_COLUMN)]);', path.join(dataDirectory, "maps.sqlite")], { encoding: "utf8", windowsHide: true }));
  equal(databaseInspection.maps.includes(key), false, "Only an edit-key hash is stored");
  equal(databaseInspection.maps.every((value) => /^[a-f0-9]{64}$/.test(value)), true, "Stored edit credentials are SHA-256 hashes");
  equal(databaseInspection.ips.every((value) => /^[a-f0-9]{64}$/.test(value)), true, "Rate limiter stores salted IP hashes");
  equal(JSON.stringify(databaseInspection).includes("127.0.0.1"), false, "Raw IP address is not stored");

  const deleted = await request(`?id=${id}`, { method: "DELETE", headers: { "X-Map-Edit-Key": key } });
  equal(deleted.body, { deleted: true }, "Owner can delete their map");
  equal((await request(`?id=${id}`)).status, 404, "Deleted map is no longer readable");
  // The first two creates above still count after the process restart.
  for (let index = 0; index < 3; index += 1) {
    equal((await request("", { method: "POST", payload: { ...initial, name: `Rate limit test ${index}`, listed: false } })).status, 201, "Creation allowed up to the daily limit");
  }
  const limited = await request("", { method: "POST", payload: initial });
  equal(limited.status, 429, "Persistent daily create limit enforced");
  equal(Number(limited.headers.get("Retry-After")) > 0, true, "Rate-limit response provides retry time");

  // Storage inside the public site must fail closed, before any directory is
  // created there. Use a fresh name and verify that no runtime data is exposed.
  await stopServer();
  await startServer(path.join(root, "site", "forbidden-map-storage-test"));
  equal((await request("?action=list")).status, 503, "Public database storage is forbidden");
  console.log(`Friend map API: ${assertions} checks passed, including persistence, privacy, ownership, validation, concurrent workers, conflicts, and rate limits.`);
} finally {
  await stopServer(peerServer);
  await stopServer();
  await rm(temporary, { recursive: true, force: true });
}
