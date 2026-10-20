// Preparation only: bundle a small, pinned subset of official D3 packages.
// Install the versions documented in vendor/d3/README.txt outside the project.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  assert.ok(/^--(modules|output)$/.test(name) && value,
    "Usage: node tools/prepare-globe-vendor.mjs --modules C:/prep/node_modules [--output C:/prep/d3-globe.min.js]");
  options[name.slice(2)] = path.resolve(value);
}
assert.ok(options.modules, "Supply --modules pointing to the separate preparation node_modules folder.");
const versions = {
  "d3-geo": "3.1.1", "d3-array": "3.2.4", "d3-selection": "3.0.0",
  "d3-dispatch": "3.0.1", "d3-drag": "3.0.0", "d3-interpolate": "3.0.1",
  "d3-color": "3.1.0", "d3-transition": "3.0.1", "d3-timer": "3.0.1",
  "d3-ease": "3.0.1", "d3-zoom": "3.0.0", internmap: "2.0.3", esbuild: "0.28.2",
};
for (const [name, version] of Object.entries(versions)) {
  const installed = JSON.parse(fs.readFileSync(path.join(options.modules, name, "package.json"), "utf8"));
  assert.equal(installed.version, version, `Use pinned ${name} ${version}.`);
}
const esbuild = await import(pathToFileURL(path.join(options.modules, "esbuild/lib/main.js")));
const contents = [
  'export {geoOrthographic, geoPath, geoGraticule10, geoCentroid, geoArea, geoDistance, geoContains, geoRotation} from "d3-geo";',
  'export {select, pointer} from "d3-selection";',
  'export {drag} from "d3-drag";',
  'export {zoom, zoomIdentity} from "d3-zoom";',
].join("\n");
const result = await esbuild.build({
  stdin: { contents, resolveDir: path.dirname(options.modules), sourcefile: "globe-entry.js", loader: "js" },
  nodePaths: [options.modules], bundle: true, minify: true, treeShaking: true,
  format: "iife", globalName: "RustinGlobeD3", platform: "browser", target: ["es2018"],
  charset: "utf8", legalComments: "none", write: false,
  banner: { js: "/*! Official D3 globe subset; pinned versions and licenses in README.txt and LICENSE. */" },
});
assert.equal(result.outputFiles.length, 1);
const output = options.output || path.join(root, "site/assets/vendor/d3/d3-globe.min.js");
fs.mkdirSync(path.dirname(output), { recursive: true });
const bytes = result.outputFiles[0].contents;
fs.writeFileSync(output, bytes);
const licenses = Object.entries(versions).filter(([name]) => name !== "esbuild").map(([name, version]) =>
  `${name} ${version}\nhttps://github.com/${name === "internmap" ? "mbostock/internmap" : "d3/" + name}\n\n`
    + fs.readFileSync(path.join(options.modules, name, "LICENSE"), "utf8").trim() + "\n");
fs.writeFileSync(path.join(path.dirname(output), "LICENSE"), licenses.join("\n" + "=".repeat(72) + "\n\n"));
console.log(`D3 globe subset: ${bytes.length} bytes; ${gzipSync(bytes, { level: 9 }).length} gzip bytes.`);
console.log("SHA-256: " + createHash("sha256").update(bytes).digest("hex"));
