// Preparation only. Uses maintained Natural Earth polygons; no browser dependency.
// See site/assets/vendor/leaflet/README.txt for pinned source/tool details.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  assert.ok(/^--(source|mapshaper|output)$/.test(name) && value,
    "Usage: node tools/prepare-uk-map.mjs --source map-units.geojson --mapshaper /path/to/mapshaper/bin/mapshaper [--output uk-countries.geo.json]");
  options[name.slice(2)] = path.resolve(value);
}
for (const name of ["source", "mapshaper"]) assert.ok(options[name], `Missing --${name}.`);
const output = options.output || path.join(root, "site/assets/vendor/leaflet/uk-countries.geo.json");
const sourceBytes = fs.readFileSync(options.source);
assert.equal(createHash("sha256").update(sourceBytes).digest("hex"),
  "57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862",
  "Use the exact pinned Natural Earth map-units source.");
const mapshaperPackage = JSON.parse(fs.readFileSync(path.resolve(path.dirname(options.mapshaper), "../package.json"), "utf8"));
assert.equal(mapshaperPackage.version, "0.6.113", "Use pinned mapshaper 0.6.113.");
const source = JSON.parse(sourceBytes);
const names = new Map([
  ["GB-ENG", "England"], ["GB-SCT", "Scotland"],
  ["GB-WLS", "Wales"], ["GB-NIR", "Northern Ireland"],
]);
const polygons = (geometry) => {
  assert.ok(geometry && ["Polygon", "MultiPolygon"].includes(geometry.type), "Expected polygon geography.");
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
};
const bounds = (geometry) => polygons(geometry).flat(2).reduce((box, [x, y]) => [
  Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y),
], [Infinity, Infinity, -Infinity, -Infinity]);
const features = [...names].map(([code, name]) => {
  const matches = source.features.filter((feature) => feature.properties.ADM0_A3 === "GBR"
    && feature.properties.GU_A3 === code.slice(3));
  assert.equal(matches.length, 1, `Expected exactly one ${code} source map unit.`);
  assert.equal(matches[0].properties.NAME_LONG, name);
  return { type: "Feature", properties: { code, name }, geometry: matches[0].geometry };
});
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rustin-uk-countries-"));
const unsimplifiedFile = path.join(temporary, "source.json");
const simplifiedFile = path.join(temporary, "simplified.json");
try {
  fs.writeFileSync(unsimplifiedFile, JSON.stringify({ type: "FeatureCollection", features }));
  // Topology is shared across all four source countries. Exploding each polygon
  // before keep-shapes preserves every source island, including tiny Rockall;
  // dissolving by code then restores the four constituent-country features.
  const result = spawnSync(process.execPath, [options.mapshaper,
    "-i", unsimplifiedFile, "-explode", "-simplify", "20%", "keep-shapes",
    "-dissolve", "code", "copy-fields=name", "-o", "format=geojson", "precision=0.001", simplifiedFile,
  ], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, `Mapshaper failed: ${result.stderr || result.stdout}`);
  const simplified = JSON.parse(fs.readFileSync(simplifiedFile, "utf8"));
  assert.equal(simplified.type, "FeatureCollection");
  assert.equal(simplified.features.length, names.size);
  const prepared = [...names].map(([code, name]) => {
    const matches = simplified.features.filter((feature) => feature.properties.code === code);
    assert.equal(matches.length, 1, `Expected one prepared ${code} feature.`);
    const feature = matches[0];
    assert.equal(feature.properties.name, name);
    const original = features.find((entry) => entry.properties.code === code);
    assert.equal(polygons(feature.geometry).length, polygons(original.geometry).length,
      `${name} must retain all its source polygons/islands.`);
    const sourceBounds = bounds(original.geometry);
    const displayBounds = bounds(feature.geometry);
    assert.ok(displayBounds.every(Number.isFinite));
    assert.ok(displayBounds[0] >= sourceBounds[0] - 0.0005 && displayBounds[1] >= sourceBounds[1] - 0.0005
      && displayBounds[2] <= sourceBounds[2] + 0.0005 && displayBounds[3] <= sourceBounds[3] + 0.0005,
    `${name} remains within its original source bounds, allowing rounding.`);
    for (const ring of polygons(feature.geometry).flat()) {
      assert.ok(ring.length >= 4, `${name} has a valid polygon ring.`);
      assert.deepEqual(ring[0], ring.at(-1), `${name} has closed rings.`);
      assert.ok(ring.every((point) => point.length === 2 && point.every(Number.isFinite)));
      const doubleArea = ring.slice(1).reduce((area, point, index) =>
        area + ring[index][0] * point[1] - point[0] * ring[index][1], 0);
      assert.ok(Math.abs(doubleArea) > 1e-12, `${name} retains nonzero island geometry.`);
    }
    return { type: "Feature", properties: { code, name }, geometry: feature.geometry };
  });
  fs.writeFileSync(output, JSON.stringify({ type: "FeatureCollection", features: prepared }) + "\n");
  console.log(`Prepared four UK constituent countries; retained all 59 source polygons; ${fs.statSync(output).size} bytes.`);
  console.log("Geographic longitude/latitude bounds: " + JSON.stringify(bounds({
    type: "MultiPolygon", coordinates: prepared.flatMap((feature) => polygons(feature.geometry)),
  })));
} finally {
  // Remove only the two exact preparation files created in this fresh folder.
  for (const file of [unsimplifiedFile, simplifiedFile]) if (fs.existsSync(file)) fs.unlinkSync(file);
  fs.rmdirSync(temporary);
}
