import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Script, runInNewContext } from "node:vm";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "site/index.html", "site/testing/index.html", "site/assets/content.js", "site/assets/site.js", "site/assets/styles.css",
  "site/assets/travel-map.js", "site/assets/travel-map.css", "site/assets/travel-countries.js",
  "site/assets/travel-regions.js", "site/assets/travel-stats.js",
  "site/assets/travel-states.js", "site/assets/vendor/leaflet/us-states-albers.json",
  "site/assets/vendor/leaflet/leaflet-1.9.4.js", "site/assets/vendor/leaflet/leaflet-1.9.4.css",
  "site/assets/vendor/leaflet/countries.geo.json", "site/assets/vendor/leaflet/iso-codes.json",
  "site/assets/vendor/leaflet/antarctica-polar.json",
  "site/maps/index.html", "site/api/maps.php", "site/assets/friends-config.js",
  "site/assets/friends-map.js", "site/assets/friends-map.css", "site/assets/friends-directory.js",
  ...[1, 2, 3, 4].map((number) => `site/testing/options/${number}/index.html`)
];
const errors = [];
for (const file of required) await access(path.join(repo, file)).catch(() => errors.push(`Missing ${file}`));

const homepage = await readFile(path.join(repo, "site/index.html"), "utf8");
const match = homepage.match(/<body data-design="([1-4])">/);
if (!match) errors.push("Homepage must select design 1, 2, 3, or 4.");
for (const asset of ["assets/styles.css", "assets/content.js", "assets/site.js"]) {
  if (!homepage.includes(asset)) errors.push(`Homepage does not load ${asset}`);
}
const styles = await readFile(path.join(repo, "site/assets/styles.css"), "utf8");
for (const number of [1, 2, 3, 4]) if (!styles.includes(`data-design=\"${number}\"`)) errors.push(`Missing CSS for design ${number}`);

try {
  for (const filename of ["content.js", "site.js", "travel-countries.js", "travel-states.js", "travel-map.js", "travel-regions.js", "travel-stats.js", "friends-map.js", "friends-config.js", "friends-directory.js"]) {
    new Script(await readFile(path.join(repo, "site/assets", filename), "utf8"), { filename });
  }
  const sandbox = { window: {} };
  runInNewContext(await readFile(path.join(repo, "site/assets/travel-countries.js"), "utf8"), sandbox);
  const travel = sandbox.window.RUSTIN_TRAVEL;
  const codes = new Set(JSON.parse(await readFile(path.join(repo, "site/assets/vendor/leaflet/iso-codes.json"), "utf8")));
  runInNewContext(await readFile(path.join(repo, "site/assets/travel-regions.js"), "utf8"), sandbox);
  const regions = sandbox.window.RUSTIN_REGIONS;
  const continentNames = new Set(["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"]);
  if (Object.keys(regions).length !== codes.size || [...codes].some((code) => !regions[code])) errors.push("Travel classification must cover the complete ISO destination catalog.");
  if (Object.values(regions).some((region) => !continentNames.has(region.continent) || typeof region.unMember !== "boolean")) errors.push("Every destination needs a valid continent and UN-membership flag.");
  if (Object.values(regions).filter((region) => region.unMember).length !== 193) errors.push("The country baseline must contain the 193 UN member states.");
  runInNewContext(await readFile(path.join(repo, "site/assets/travel-stats.js"), "utf8"), { window: sandbox.window, document: { querySelector: () => null } });
  const summarize = sandbox.window.RustinTravelStats.summarize;
  const fixture = summarize(["us", " US ", "PR", "TW", "AQ", "US"]);
  if (fixture.destinations !== 4 || fixture.unMembers !== 1 || fixture.otherDestinations !== 3 || fixture.continents !== 3) errors.push("Travel totals must deduplicate visits and distinguish UN countries, other destinations, and continents.");
  const emptyStats = summarize([]);
  if (emptyStats.destinations || emptyStats.unMembers || emptyStats.otherDestinations || emptyStats.continents) errors.push("An empty visited list must have zero totals.");
  let rejectsUnknown = false;
  try { summarize(["ZZ"]); } catch { rejectsUnknown = true; }
  if (!rejectsUnknown) errors.push("Unknown destinations must not silently disappear from the continent breakdown.");
  for (const field of ["visited", "upcoming"]) {
    if (!Array.isArray(travel[field])) throw new Error(`Travel ${field} must be a list.`);
    for (const code of travel[field]) {
      if (!codes.has(code)) errors.push(`Invalid travel country code in ${field}: ${code}. Use an uppercase ISO two-letter code.`);
    }
  }
  if (typeof travel.showUpcoming !== "boolean") errors.push("Travel showUpcoming must be true or false.");
  runInNewContext(await readFile(path.join(repo, "site/assets/travel-states.js"), "utf8"), sandbox);
  const states = JSON.parse(await readFile(path.join(repo, "site/assets/vendor/leaflet/us-states-albers.json"), "utf8"));
  const stateCodes = new Set(states.features.map((feature) => feature.properties.code));
  if (stateCodes.size !== 50 || states.features.length !== 50 || stateCodes.has("DC")) errors.push("U.S. map must contain exactly the 50 states.");
  if (states.features.some((feature) => !feature.geometry)) errors.push("U.S. map contains a state with missing geometry.");
  if (!stateCodes.has("AK") || !stateCodes.has("HI")) errors.push("U.S. map must include Alaska and Hawaii.");
  const visitedStates = sandbox.window.RUSTIN_STATES.visited;
  if (!Array.isArray(visitedStates)) throw new Error("Visited states must be a list of postal codes.");
  for (const code of visitedStates) {
    if (!stateCodes.has(code)) errors.push(`Invalid visited-state postal code: ${code}.`);
  }
  if (new Set(visitedStates).size !== 50) errors.push("The all-50-states milestone must contain all 50 distinct state codes.");
  const friendConfig = { window: {} };
  runInNewContext(await readFile(path.join(repo, "site/assets/friends-config.js"), "utf8"), friendConfig);
  if (friendConfig.window.RUSTIN_TRAVEL.visited.length || friendConfig.window.RUSTIN_STATES.visited.length) errors.push("Friends must start with empty personal maps, not Rustin’s history.");
  const geography = JSON.parse(await readFile(path.join(repo, "site/assets/vendor/leaflet/countries.geo.json"), "utf8"));
  const polar = JSON.parse(await readFile(path.join(repo, "site/assets/vendor/leaflet/antarctica-polar.json"), "utf8"));
  if (polar.projection !== "South Pole" || !Array.isArray(polar.viewport) || polar.viewport.length !== 2 || polar.viewport.some((value) => !Number.isFinite(value) || value <= 0)) errors.push("Antarctica needs a valid prepared polar viewport.");
  if (polar.features.length !== 1 || polar.features[0].properties.code !== "AQ" || !polar.features[0].geometry) errors.push("The polar inset must contain Antarctica only.");
  for (const code of travel.visited) {
    if (!geography.features.some((feature) => feature.properties.code === code && feature.geometry)) errors.push(`Visited destination ${code} has no world-map region.`);
  }
  for (const code of ["US", "JP", "CL", "AQ", "TV", "VA", "SG"]) {
    if (!geography.features.some((feature) => feature.properties.code === code && feature.geometry)) errors.push(`World map is missing ${code}.`);
  }
  function projectedPoints(coordinates) {
    return typeof coordinates[0] === "number" ? [coordinates] : coordinates.flatMap(projectedPoints);
  }
  if (polar.features[0]?.geometry) {
    const points = projectedPoints(polar.features[0].geometry.coordinates);
    if (points.some((point) => point.some((value, axis) => !Number.isFinite(value) || value < 0 || value > polar.viewport[axis]))) errors.push("Antarctica's prepared shape must stay inside its inset.");
  }
  for (const page of ["site/index.html", ...[1, 2, 3, 4].map((number) => `site/testing/options/${number}/index.html`)]) {
    const html = await readFile(path.join(repo, page), "utf8");
    if (!html.includes('id="world"') || html.indexOf('id="world"') > html.indexOf('id="links"')) errors.push(`${page}: world map must precede Around the web.`);
    if (!html.includes('id="united-states"')) errors.push(`${page} is missing the U.S. states breakout.`);
    if (!/<section\b[^>]*id="united-states"[^>]*\bhidden>/.test(html)) errors.push(`${page}: the state breakdown must start hidden.`);
    if (!html.includes("data-world-overview") || !html.includes("data-back-world")) errors.push(`${page}: world/state navigation is missing.`);
    if (!html.includes('id="create-map"') || !html.includes('id="friends-maps"')) errors.push(`${page}: community map sections are missing.`);
    if (!html.includes("data-travel-breakdown")) errors.push(`${page}: the countries and continents breakdown is missing.`);
    if (!html.includes("data-travel-state-count")) errors.push(`${page}: the U.S. states summary counter is missing.`);
    for (const asset of ["travel-map.css", "travel-countries.js", "travel-states.js", "travel-map.js", "travel-regions.js", "travel-stats.js"]) {
      if (!html.includes(asset)) errors.push(`${page} does not load ${asset}.`);
    }
    if (html.indexOf("travel-regions.js") > html.indexOf("travel-stats.js")) errors.push(`${page}: travel classification must load before the statistics.`);
    if (html.indexOf("travel-states.js") > html.indexOf("travel-stats.js")) errors.push(`${page}: visited states must load before the statistics.`);
  }
  const mapPage = await readFile(path.join(repo, "site/maps/index.html"), "utf8");
  for (const asset of ["friends-config.js", "friends-map.js", "travel-map.js", "friends-map.css"]) {
    if (!mapPage.includes(asset)) errors.push(`Map creator is missing ${asset}.`);
  }
  if (mapPage.includes('src="../assets/travel-countries.js"') || mapPage.includes('src="../assets/travel-states.js"')) errors.push("Map creator must not load Rustin’s visited lists.");
} catch (error) {
  errors.push(`Travel map check: ${error.message}`);
}

if (errors.length) {
  console.error("Site check failed:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`Site check passed. Homepage uses design ${match[1]}; all four testing options and shared assets are present.`);

