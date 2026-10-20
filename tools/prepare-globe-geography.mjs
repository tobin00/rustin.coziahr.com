// Globe-only winding/topology preparation with maintained mapshaper routines.
// The existing Leaflet world asset is read, never changed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  assert.ok(/^--(source|mapshaper|d3|output)$/.test(name) && value,
    "Usage: node tools/prepare-globe-geography.mjs --mapshaper C:/prep/node_modules/mapshaper/bin/mapshaper [--source countries.geo.json] [--d3 d3-globe.min.js] [--output countries-globe.geo.json]");
  options[name.slice(2)] = path.resolve(value);
}
assert.ok(options.mapshaper, "Supply the separate preparation-only --mapshaper path.");
const sourceFile = options.source || path.join(root, "site/assets/vendor/leaflet/countries.geo.json");
const output = options.output || path.join(root, "site/assets/vendor/leaflet/countries-globe.geo.json");
const d3File = options.d3 || path.join(root, "site/assets/vendor/d3/d3-globe.min.js");
const mapshaperPackage = JSON.parse(fs.readFileSync(path.resolve(path.dirname(options.mapshaper), "../package.json"), "utf8"));
assert.equal(mapshaperPackage.version, "0.6.113", "Use pinned mapshaper 0.6.113.");
const sourceBytes = fs.readFileSync(sourceFile);
const source = JSON.parse(sourceBytes);
assert.equal(source.type, "FeatureCollection");
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
const scope = vm.createContext({ setTimeout, clearTimeout, setInterval, clearInterval, performance });
vm.runInContext(fs.readFileSync(d3File, "utf8"), scope, { filename: d3File });
const d3 = scope.RustinGlobeD3;
assert.equal(typeof d3.geoArea, "function");
const polygons = (geometry) => {
  if (!geometry) return [];
  assert.ok(["Polygon", "MultiPolygon"].includes(geometry.type));
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
};
const positions = (geometry) => polygons(geometry).flat(2);
const positionSet = (geometry) => new Set(positions(geometry).map((point) => JSON.stringify(point)));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rustin-globe-geography-"));
const preparedFile = path.join(temporary, "prepared.json");
try {
  // Do not build cross-country topology, snap, simplify, add intersection cuts,
  // fill gaps, or dissolve overlaps. The library's ring-containment routine
  // rewinds nested rings; its exporter groups holes under their proper shell.
  const result = spawnSync(process.execPath, [options.mapshaper,
    "-i", sourceFile, "no-topology", "-clean", "rewind", "allow-empty", "only-arcs",
    "-o", "format=geojson", "gj2008", preparedFile,
  ], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, `Mapshaper failed: ${result.stderr || result.stdout}`);
  const prepared = JSON.parse(fs.readFileSync(preparedFile, "utf8"));
  assert.equal(prepared.features.length, source.features.length);
  prepared.features.forEach((feature, index) => {
    const original = source.features[index];
    assert.deepEqual(feature.properties, original.properties, "Every code and name must remain unchanged.");
    if (!feature.geometry) {
      assert.equal(feature.properties.code, "VA", "Only the existing degenerate Vatican ring may be empty.");
      assert.equal(d3.geoArea(original), 0, "The omitted source geometry has no spherical area.");
      assert.equal(positionSet(original.geometry).size, 2, "Vatican source has only two distinct collinear points.");
      return;
    }
    assert.deepEqual(positionSet(feature.geometry), positionSet(original.geometry),
      `${feature.properties.code || feature.properties.name} must retain exactly its original coordinate values.`);
    for (const ring of polygons(feature.geometry).flat()) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1), "All geographic rings must close.");
      assert.ok(ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)
        && x >= -180 && x <= 180 && y >= -90 && y <= 90));
    }
    const area = d3.geoArea(feature);
    assert.ok(Number.isFinite(area) && area > 0 && area < 2 * Math.PI,
      `${feature.properties.code || feature.properties.name} must have positive area smaller than a hemisphere.`);
  });
  for (const [code, point] of [["ZA", [28.2, -29.6]], ["IT", [12.46, 43.94]]]) {
    assert.equal(d3.geoContains(prepared.features.find((feature) => feature.properties.code === code), point), false,
      `${code} must preserve its separately mapped enclave as a hole.`);
  }
  for (const rotation of [[0, 0], [100, -20], [180, 0], [-100, -30], [0, 90]]) {
    const globePath = d3.geoPath(d3.geoOrthographic().rotate(rotation).scale(240).translate([250, 250]));
    for (const feature of prepared.features) {
      if (!feature.geometry) continue;
      const area = globePath.area(feature);
      assert.ok(Number.isFinite(area) && area < Math.PI * 240 * 240 * 0.9,
        `${feature.properties.code || feature.properties.name} must not paint the whole globe.`);
    }
  }
  const asset = { type: "FeatureCollection", sourceSha256, features: prepared.features };
  fs.writeFileSync(output, JSON.stringify(asset) + "\n");
  console.log(`Prepared ${asset.features.length} globe regions; source SHA-256 ${sourceSha256}.`);
  console.log("Preserved every nondegenerate region's coordinate-value set, all codes/names, and enclave holes; "
    + fs.statSync(output).size + " bytes.");
  console.log("Asset SHA-256: " + createHash("sha256").update(fs.readFileSync(output)).digest("hex"));
} finally {
  if (fs.existsSync(preparedFile)) fs.unlinkSync(preparedFile);
  fs.rmdirSync(temporary);
}
