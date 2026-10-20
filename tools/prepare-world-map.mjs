// One-time Antarctica inset preparation. No tool runs in the browser.
// Supply unsimplified spherical GeoJSON with code/name properties.
// See site/assets/vendor/leaflet/README.txt for pinned tools and source details.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (!/^--(source|d3|projection|mapshaper|output)$/.test(name) || !value) {
    throw new Error("Usage: node tools/prepare-world-map.mjs --source source.geo.json --d3 d3-7.9.0.js --projection d3-geo-projection-4.0.0.js --mapshaper /path/to/mapshaper/bin/mapshaper [--output antarctica-polar.json]");
  }
  options[name.slice(2)] = path.resolve(value);
}
for (const name of ["source", "d3", "projection", "mapshaper"]) {
  if (!options[name]) throw new Error("Missing required --" + name + " preparation-tool path.");
}
const output = options.output || path.join(root, "site/assets/vendor/leaflet/antarctica-polar.json");
const source = JSON.parse(fs.readFileSync(options.source, "utf8"));
if (source.type !== "FeatureCollection" || !Array.isArray(source.features)) throw new Error("Source must be a spherical GeoJSON FeatureCollection.");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(options.d3, "utf8"), context, { filename: options.d3 });
const projectionBundle = fs.readFileSync(options.projection, "utf8");
if (!projectionBundle.slice(0, 200).includes("v4.0.0")) throw new Error("Use the pinned d3-geo-projection 4.0.0 preparation bundle.");
vm.runInContext(projectionBundle, context, { filename: options.projection });
const d3 = context.d3;
if (d3.version !== "7.9.0" || !d3.geoProject) throw new Error("Use the pinned D3 7.9.0 and d3-geo-projection 4.0.0 bundles.");
const mapshaperPackage = JSON.parse(fs.readFileSync(path.resolve(path.dirname(options.mapshaper), "../package.json"), "utf8"));
if (mapshaperPackage.version !== "0.6.113") throw new Error("Use pinned mapshaper 0.6.113.");

const antarctica = source.features.find((feature) => feature.properties.code === "AQ");
if (!antarctica) throw new Error("Source must include the original AQ geometry.");
// D3's spherical stream expects clockwise exteriors and opposite holes.
// Normalize order without changing any boundary coordinates.
let reversedRings = 0;
for (const feature of [antarctica]) {
  const geometry = feature.geometry;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) throw new Error("All source regions must have polygon geometry.");
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    polygon.forEach((ring, index) => {
      const area = d3.geoArea({ type: "Polygon", coordinates: [ring] });
      if ((index === 0 && area > 2 * Math.PI) || (index > 0 && area < 2 * Math.PI)) {
        ring.reverse();
        reversedRings++;
      }
    });
  }
}
const viewport = [200, 200];
const projection = d3.geoAzimuthalEqualArea().rotate([0, 90]).fitExtent([[12, 12], [188, 188]], antarctica);
const region = { type: "Feature", properties: { code: "AQ", name: antarctica.properties.name }, geometry: antarctica.geometry };
const projected = d3.geoProject({ type: "FeatureCollection", features: [region] }, projection);
const flatPath = d3.geoPath(null);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rustin-antarctica-polar-"));
const unsimplifiedFile = path.join(temporary, "projected.json");
const simplifiedFile = path.join(temporary, "simplified.json");
try {
  fs.writeFileSync(unsimplifiedFile, JSON.stringify(projected));
  const result = spawnSync(process.execPath, [options.mapshaper, "-i", unsimplifiedFile, "-simplify", "5%", "planar", "keep-shapes", "-o", "format=geojson", "precision=0.01", simplifiedFile], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error("Mapshaper failed: " + (result.stderr || result.stdout));
  const simplified = JSON.parse(fs.readFileSync(simplifiedFile, "utf8"));
  if (simplified.features.length !== 1 || simplified.features[0].properties.code !== "AQ") throw new Error("The inset must contain only Antarctica.");
  const feature = simplified.features[0];
  if (!feature.geometry) throw new Error("Antarctica disappeared during simplification.");
  const bounds = flatPath.bounds(feature);
  if (!bounds.flat().every(Number.isFinite) || bounds[0][0] < 0 || bounds[0][1] < 0 || bounds[1][0] > viewport[0] || bounds[1][1] > viewport[1]) throw new Error("Invalid Antarctic bounds.");
  const area = flatPath.area(feature);
  if (area <= 0 || area > viewport[0] * viewport[1] * 0.8) throw new Error("Antarctic projection produced an invalid area.");
  const asset = { type: "FeatureCollection", projection: "South Pole", viewport, bounds, features: simplified.features };
  fs.writeFileSync(output, JSON.stringify(asset) + "\n");
  console.log("Prepared Antarctica; " + reversedRings + " ring directions normalized; " + fs.statSync(output).size + " bytes.");
  console.log("Viewport " + JSON.stringify(viewport) + "; y increases downward; bounds " + JSON.stringify(asset.bounds) + ".");
} finally {
  // These are the two exact files created above, inside a fresh temporary folder.
  for (const file of [unsimplifiedFile, simplifiedFile]) if (fs.existsSync(file)) fs.unlinkSync(file);
  fs.rmdirSync(temporary);
}
