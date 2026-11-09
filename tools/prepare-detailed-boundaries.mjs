// Preparation only. Pinned public sources/tools live outside this repository.
// node tools/prepare-detailed-boundaries.mjs --prep C:/prep
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assert.equal(process.argv[2], "--prep");
assert.ok(process.argv[3], "Supply --prep with the pinned sources and preparation-only node_modules.");
const prep = path.resolve(process.argv[3]);
const require = createRequire(path.join(prep, "prepare.cjs"));
for (const [name, version] of Object.entries({ mapshaper: "0.6.113", "topojson-client": "3.1.0", "i18n-iso-countries": "7.14.0", d3: "7.9.0", "d3-geo-projection": "4.0.0" })) {
  assert.equal(JSON.parse(fs.readFileSync(path.join(prep, "node_modules", name, "package.json"))).version, version);
}
const topojson = require("topojson-client");
const d3 = await import(pathToFileURL(path.join(prep, "node_modules/d3/src/index.js")));
const { geoProject } = await import(pathToFileURL(path.join(prep, "node_modules/d3-geo-projection/src/index.js")));
const assetPath = (name) => path.join(root, "site/assets/vendor/leaflet", name);
function source(name, sha256) {
  const bytes = fs.readFileSync(path.join(prep, name));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256, `Use the pinned ${name} source.`);
  return JSON.parse(bytes);
}
const atlas = source("countries-10m.json", "3bc6f1d367a9bcec479841bae0e76092f512838411d0cef124e92eec4db45f79");
const units = source("map-units.geojson", "57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862");
const overview = JSON.parse(fs.readFileSync(assetPath("countries.geo.json")));
const ukOverview = JSON.parse(fs.readFileSync(assetPath("uk-countries.geo.json")));
const numericCodes = new Map(require("i18n-iso-countries/codes.json").map(([alpha2, , numeric]) => [numeric, alpha2]));
const polygons = (geometry) => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
const geometryFrom = (parts) => parts.length === 1 ? { type: "Polygon", coordinates: parts[0] } : { type: "MultiPolygon", coordinates: parts };
const key = (feature) => feature.properties.code || feature.properties.name;
const bounds = (geometry) => polygons(geometry).flat(2).reduce((box, [x, y]) => [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
const features = new Map();
for (const feature of topojson.feature(atlas, atlas.objects.countries).features) {
  const code = numericCodes.get(String(feature.id).padStart(3, "0")) || null;
  feature.properties = { code, name: feature.properties.name };
  const previous = features.get(key(feature));
  if (previous) {
    assert.equal(code, "AU", "Only Australia's separate source pieces need grouping.");
    previous.geometry = geometryFrom([...polygons(previous.geometry), ...polygons(feature.geometry)]);
  } else features.set(key(feature), feature);
}
// Retain separately tracked Caribbean destinations. Remove their complete
// source islands from France before using the maintained map-unit outlines.
const france = features.get("FR");
for (const code of ["GP", "MQ", "BQ"]) {
  const matches = units.features.filter((feature) => feature.properties.ISO_A2_EH === code);
  assert.equal(matches.length, 1);
  const unit = matches[0];
  if (code !== "BQ") {
    const box = bounds(unit.geometry);
    let moved = 0;
    france.geometry = geometryFrom(polygons(france.geometry).filter((polygon) => {
      const b = bounds({ type: "Polygon", coordinates: polygon });
      // Allow the World Atlas quantization grid when matching source islands.
      const belongs = b[0] >= box[0] - 0.01 && b[1] >= box[1] - 0.01 && b[2] <= box[2] + 0.01 && b[3] <= box[3] + 0.01;
      if (belongs) moved++;
      return !belongs;
    }));
    assert.ok(moved >= (code === "GP" ? 2 : 1), `Separate ${code} from France.`);
  }
  features.set(code, { type: "Feature", properties: { code, name: unit.properties.NAME }, geometry: unit.geometry });
}
const world = { type: "FeatureCollection", features: overview.features.map((feature) => {
  const detailed = features.get(key(feature));
  assert.ok(detailed, `Missing source region ${key(feature)}.`);
  return { type: "Feature", properties: feature.properties, geometry: structuredClone(detailed.geometry) };
}) };
// Normalize spherical ring directions before splitting the date-line seam.
for (const feature of world.features) {
  for (const polygon of polygons(feature.geometry)) {
    polygon.forEach((ring, index) => {
      const area = d3.geoArea({ type: "Polygon", coordinates: [ring] });
      if ((index === 0 && area > 2 * Math.PI) || (index > 0 && area < 2 * Math.PI)) ring.reverse();
    });
  }
}
const flat = geoProject(world, d3.geoEquirectangular().scale(180 / Math.PI).translate([0, 0]).reflectY(true).precision(0));
const uk = { type: "FeatureCollection", features: ukOverview.features.map((feature) => {
  const matches = units.features.filter((unit) => unit.properties.ADM0_A3 === "GBR" && unit.properties.GU_A3 === feature.properties.code.slice(3));
  assert.equal(matches.length, 1);
  return { type: "Feature", properties: feature.properties, geometry: matches[0].geometry };
}) };
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rustin-detailed-boundaries-"));
try {
  for (const [name, data, base] of [["countries-detail.geo.json", flat, overview], ["uk-countries-detail.geo.json", uk, ukOverview]]) {
    const input = path.join(temporary, "source.json");
    const output = path.join(temporary, "prepared.json");
    fs.writeFileSync(input, JSON.stringify(data));
    const ukOptions = name.startsWith("uk-") ? ["-explode"] : [];
    const dissolve = name.startsWith("uk-") ? ["-dissolve", "code", "copy-fields=name"] : [];
    const result = spawnSync(process.execPath, [path.join(prep, "node_modules/mapshaper/bin/mapshaper"),
      "-i", input, ...ukOptions, "-simplify", "50%", "keep-shapes", ...dissolve, "-o", "format=geojson", "precision=0.00001", output,
    ], { encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const prepared = JSON.parse(fs.readFileSync(output));
    prepared.features.sort((a, b) => base.features.findIndex((feature) => key(feature) === key(a)) - base.features.findIndex((feature) => key(feature) === key(b)));
    assert.deepEqual(prepared.features.map((feature) => feature.properties), base.features.map((feature) => feature.properties));
    // The original World Atlas Vatican is degenerate; retain the existing
    // overview geometry for that tiny region rather than inventing a border.
    prepared.features.forEach((feature, index) => {
      feature.properties = base.features[index].properties;
      if (!feature.geometry) {
        assert.equal(feature.properties.code, "VA");
        feature.geometry = base.features[index].geometry;
      }
      if (name.startsWith("uk-")) assert.equal(polygons(feature.geometry).length, polygons(data.features[index].geometry).length, "Retain every UK island.");
      for (const ring of polygons(feature.geometry).flat()) {
        assert.ok(ring.length >= 4);
        assert.deepEqual(ring[0], ring.at(-1));
        assert.ok(ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 180.00001 && Math.abs(y) <= 90));
        assert.ok(ring.slice(1).every((point, i) => Math.abs(point[0] - ring[i][0]) <= 180.00001), "No line may cross the world at the date-line seam.");
      }
    });
    const sourceName = name.startsWith("uk-") ? "uk-countries.geo.json" : "countries.geo.json";
    const sourceSha256 = createHash("sha256").update(fs.readFileSync(assetPath(sourceName))).digest("hex");
    fs.writeFileSync(assetPath(name), JSON.stringify({ type: "FeatureCollection", sourceSha256, features: prepared.features }) + "\n");
    console.log(`${name}: ${prepared.features.length} regions, ${fs.statSync(assetPath(name)).size} bytes`);
  }
} finally {
  for (const name of ["source.json", "prepared.json"]) {
    const file = path.join(temporary, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  fs.rmdirSync(temporary);
}
