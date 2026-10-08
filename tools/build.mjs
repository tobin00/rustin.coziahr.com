import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repo, "site");
const output = path.join(repo, "dist");
const versionedAssets = ["styles.css", "content.js", "site.js"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

const versions = new Map();
for (const filename of versionedAssets) {
  const contents = await readFile(path.join(source, "assets", filename));
  versions.set(filename, createHash("sha256").update(contents).digest("hex").slice(0, 12));
}

async function versionHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await versionHtml(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".html")) continue;

    let html = await readFile(fullPath, "utf8");
    html = html.replace(
      /((?:\.\.\/)*assets\/(styles\.css|content\.js|site\.js))(?:\?v=[a-f0-9]+)?/g,
      (_, assetPath, filename) => `${assetPath}?v=${versions.get(filename)}`
    );
    await writeFile(fullPath, html, "utf8");
  }
}

await versionHtml(output);
console.log(`Built cache-safe site in ${output}`);

