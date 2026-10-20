import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Preparation only: no added browser dependency or hand-drawn boundaries.
// Download the pinned Natural Earth source documented in the vendor README,
// then run: node tools/prepare-caribbean-map.mjs --source C:/prep/map-units.geojson
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const sourceFile = argument("--source");
assert.ok(sourceFile, "Supply --source with the pinned Natural Earth map-units GeoJSON.");
const targetFile = argument("--target", path.join(root, "site/assets/vendor/leaflet/countries.geo.json"));
const sourceBytes = await readFile(sourceFile);
assert.equal(createHash("sha256").update(sourceBytes).digest("hex"), "57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862", "Use the exact pinned Natural Earth source.");
const source = JSON.parse(sourceBytes);
const original = JSON.parse(await readFile(targetFile, "utf8"));
const updated = structuredClone(original);
const codes = ["GP", "MQ", "BQ"];
const units = new Map(codes.map((code) => {
  const matches = source.features.filter((feature) => feature.properties.ISO_A2_EH === code);
  assert.equal(matches.length, 1, `The source must identify exactly one ${code} map unit.`);
  return [code, matches[0]];
}));
const polygons = (geometry) => {
  assert.ok(["Polygon", "MultiPolygon"].includes(geometry.type));
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
};
const bounds = (geometry) => polygons(geometry).flat(2).reduce((box, [x, y]) => [
  Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y),
], [Infinity, Infinity, -Infinity, -Infinity]);
// Existing map coordinates have 0.001-degree precision; allow half of that
// rounding unit when comparing them with the full-precision source bounds.
const within = (inner, outer) => inner[0] >= outer[0] - 0.0005 && inner[1] >= outer[1] - 0.0005
  && inner[2] <= outer[2] + 0.0005 && inner[3] <= outer[3] + 0.0005;
const geometryFrom = (parts) => parts.length === 1
  ? { type: "Polygon", coordinates: parts[0] }
  : { type: "MultiPolygon", coordinates: parts };
const roundCoordinates = (coordinates) => typeof coordinates[0] === "number"
  ? coordinates.map((value) => Math.round(value * 1000) / 1000)
  : coordinates.map(roundCoordinates);
const bonaireGeometry = {
  type: units.get("BQ").geometry.type,
  coordinates: roundCoordinates(units.get("BQ").geometry.coordinates),
};

const present = codes.filter((code) => updated.features.some((feature) => feature.properties.code === code));
if (present.length > 0) {
  assert.equal(present.length, 3, "The asset is only partially prepared; restore its unpatched source first.");
  for (const code of ["GP", "MQ"]) {
    const feature = updated.features.find((entry) => entry.properties.code === code);
    assert.ok(within(bounds(feature.geometry), bounds(units.get(code).geometry)), `${code} remains within its maintained source map unit.`);
  }
  assert.deepEqual(updated.features.find((feature) => feature.properties.code === "BQ").geometry, bonaireGeometry);
  console.log("Caribbean map units are already prepared; no asset changed.");
} else {
  const france = updated.features.find((feature) => feature.properties.code === "FR");
  assert.ok(france, "The original France feature must exist.");
  const originalFrance = structuredClone(france);
  const separated = new Map([["GP", []], ["MQ", []]]);
  const remaining = [];
  for (const polygon of polygons(france.geometry)) {
    const polygonBounds = bounds({ type: "Polygon", coordinates: polygon });
    // Maintained map-unit bounds identify complete existing island polygons.
    // We relocate those polygons intact; no clipping or new border is drawn.
    const matches = ["GP", "MQ"].filter((code) => within(polygonBounds, bounds(units.get(code).geometry)));
    assert.ok(matches.length <= 1, "Each existing French polygon belongs to at most one source map unit.");
    if (matches.length === 1) separated.get(matches[0]).push(polygon);
    else remaining.push(polygon);
  }
  assert.equal(separated.get("GP").length, 2, "Identify exactly the two existing Guadeloupe polygons.");
  assert.equal(separated.get("MQ").length, 1, "Identify exactly the existing Martinique polygon.");
  assert.equal(remaining.length, polygons(originalFrance.geometry).length - 3);
  france.geometry = geometryFrom(remaining);
  for (const code of codes) {
    updated.features.push({
      type: "Feature",
      properties: { code, name: units.get(code).properties.NAME },
      geometry: code === "BQ" ? bonaireGeometry : geometryFrom(separated.get(code)),
    });
  }
  // Preserve every other feature, including the existing world-map seams and
  // Antarctica. France loses only the three polygons transferred unchanged.
  for (let index = 0; index < original.features.length; index += 1) {
    if (original.features[index].properties.code !== "FR") {
      assert.deepEqual(updated.features[index], original.features[index]);
    }
  }
  const reconstructed = [
    ...polygons(france.geometry),
    ...separated.get("GP"),
    ...separated.get("MQ"),
  ].map((polygon) => JSON.stringify(polygon)).sort();
  assert.deepEqual(reconstructed, polygons(originalFrance.geometry).map((polygon) => JSON.stringify(polygon)).sort());
  assert.equal(polygons(bonaireGeometry).length, 3, "BQ includes Bonaire, Sint Eustatius, and Saba.");
  assert.equal(updated.features.length, original.features.length + 3);
  await writeFile(targetFile, JSON.stringify(updated) + "\n");
  console.log(`Added GP, MQ, and BQ: ${original.features.length} → ${updated.features.length} regions. Moved three existing France polygons unchanged; preserved all other features exactly.`);
}
