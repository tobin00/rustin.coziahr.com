import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../site");
const port = Number(process.env.PORT || 4173);
const php = process.env.PHP_BIN || "php";
let phpArgs = [];
try {
  phpArgs = JSON.parse(process.env.PHP_ARGS || "[]");
  if (!Array.isArray(phpArgs) || phpArgs.some((arg) => typeof arg !== "string")) throw new Error();
} catch {
  console.error("PHP_ARGS must be a JSON array of PHP command arguments.");
  process.exit(1);
}
const phpCheck = spawnSync(php, [...phpArgs, "-r", "exit(PHP_VERSION_ID >= 80000 && class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true) ? 0 : 1);"], { windowsHide: true, stdio: "ignore" });
if (phpCheck.status === 0) {
  const child = spawn(php, [...phpArgs, "-d", "display_errors=0", "-S", `127.0.0.1:${port}`, "-t", root, path.resolve(root, "../tools/php-router.php")], { windowsHide: true, stdio: "inherit" });
  console.log(`Local preview with online-map saving: http://127.0.0.1:${port}`);
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
  child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code || 0; });
} else {
  console.log("PHP with PDO SQLite is unavailable. The site can be previewed; online map saving needs PHP (see docs/HOW_TO_EDIT.md).");
  startStaticPreview();
}

function startStaticPreview() {
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };

const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    if (pathname.startsWith("/api/") || /\.php(?:\/|$)/i.test(pathname)) {
      response.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ error: "Online saving needs PHP with PDO SQLite in this local preview.", code: "service_unavailable" }));
      return;
    }
    let filePath = path.resolve(root, `.${pathname}`);
    if (filePath !== root && !filePath.startsWith(root + path.sep)) throw new Error("Invalid path");
    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(await readFile(path.join(root, "404.html")));
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Local preview: http://127.0.0.1:${port}`));
}

