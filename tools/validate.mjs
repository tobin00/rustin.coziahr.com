import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Script, runInNewContext } from "node:vm";
import { createHash } from "node:crypto";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "site/index.html", "site/testing/index.html", "site/assets/content.js", "site/assets/site.js", "site/assets/styles.css",
  "site/assets/travel-map.js", "site/assets/travel-map.css", "site/assets/travel-countries.js",
  "site/assets/travel-globe.js", "site/assets/vendor/d3/d3-globe.min.js", "site/assets/vendor/d3/LICENSE", "site/assets/vendor/d3/README.txt",
  "site/assets/vendor/leaflet/countries-globe.geo.json",
  "site/assets/vendor/leaflet/countries-detail.geo.json", "site/assets/vendor/leaflet/countries-globe-detail.geo.json",
  "site/assets/vendor/leaflet/uk-countries-detail.geo.json",
  "site/assets/travel-regions.js", "site/assets/travel-stats.js",
  "site/assets/travel-states.js", "site/assets/vendor/leaflet/us-states-albers.json",
  "site/assets/travel-uk.js", "site/assets/vendor/leaflet/uk-countries.geo.json",
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
  for (const filename of ["content.js", "site.js", "travel-countries.js", "travel-states.js", "travel-uk.js", "travel-map.js", "travel-globe.js", "travel-regions.js", "travel-stats.js", "friends-map.js", "friends-config.js", "friends-directory.js"]) {
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
  runInNewContext(await readFile(path.join(repo, "site/assets/travel-uk.js"), "utf8"), sandbox);
  const uk = sandbox.window.RUSTIN_UK;
  const ukGeography = JSON.parse(await readFile(path.join(repo, "site/assets/vendor/leaflet/uk-countries.geo.json"), "utf8"));
  const ukNames = { "GB-ENG": "England", "GB-SCT": "Scotland", "GB-WLS": "Wales", "GB-NIR": "Northern Ireland" };
  const ukCodes = new Set(ukGeography.features.map((feature) => feature.properties.code));
  if (ukCodes.size !== 4 || ukGeography.features.length !== 4 || Object.keys(ukNames).some((code) => !ukCodes.has(code))) errors.push("The UK map must contain the four constituent countries.");
  if (ukGeography.features.some((feature) => !feature.geometry || feature.properties.name !== ukNames[feature.properties.code])) errors.push("Each UK country needs its own named geometry.");
  if (!Array.isArray(uk.visited) || uk.visited.some((code) => !ukCodes.has(code))) errors.push("Visited UK countries must use valid subdivision codes.");
  if (Object.keys(uk.names).length !== 4 || Object.entries(ukNames).some(([code, name]) => uk.names[code] !== name)) errors.push("UK country names must match the four map regions.");
  if (uk.visited.length && !travel.visited.includes("GB")) errors.push("A UK country visit also requires GB in the world visited list.");
  const friendConfig = { window: {} };
  runInNewContext(await readFile(path.join(repo, "site/assets/friends-config.js"), "utf8"), friendConfig);
  if (friendConfig.window.RUSTIN_TRAVEL.visited.length || friendConfig.window.RUSTIN_STATES.visited.length) errors.push("Friends must start with empty personal maps, not Rustin’s history.");
  const geography = JSON.parse(await readFile(path.join(repo, "site/assets/vendor/leaflet/countries.geo.json"), "utf8"));
  const globe = JSON.parse(await readFile(path.join(repo, "site/assets/vendor/leaflet/countries-globe.geo.json"), "utf8"));
  const globeScope = { setTimeout, clearTimeout, setInterval, clearInterval, performance };
  runInNewContext(await readFile(path.join(repo, "site/assets/vendor/d3/d3-globe.min.js"), "utf8"), globeScope);
  const d3 = globeScope.RustinGlobeD3;
  const globeSourceHash = createHash("sha256").update(await readFile(path.join(repo, "site/assets/vendor/leaflet/countries.geo.json"))).digest("hex");
  if (globe.sourceSha256 !== globeSourceHash) errors.push("Globe boundaries must be regenerated from the current flat world map.");
  if (globe.features.length !== geography.features.length || globe.features.some((feature, index) => JSON.stringify(feature.properties) !== JSON.stringify(geography.features[index].properties))) errors.push("Flat and globe views must retain the same destination catalog.");
  for (const feature of globe.features) {
    const area = d3.geoArea(feature);
    if (!Number.isFinite(area) || area >= 2 * Math.PI) errors.push(`Globe region ${feature.properties.code || feature.properties.name} has invalid spherical winding.`);
    if (!feature.geometry && feature.properties.code !== "VA") errors.push(`Globe region ${feature.properties.code || feature.properties.name} lost its geometry.`);
  }
  const globeRegion = (code) => globe.features.find((feature) => feature.properties.code === code);
  if (d3.geoContains(globeRegion("ZA"), [28.2, -29.6]) || d3.geoContains(globeRegion("IT"), [12.46, 43.94])) errors.push("The globe must preserve the Lesotho and San Marino enclaves.");
  if (!d3.geoContains(globeRegion("RU"), [37.62, 55.75]) || !d3.geoContains(globeRegion("RU"), [129.7, 62])) errors.push("The globe must include both European and Asian Russia.");
  const pointCount = (geometry) => !geometry ? 0 : geometry.type === "Polygon" ? geometry.coordinates.flat().length : geometry.coordinates.flat(2).length;
  const detailAssets = new Map();
  for (const [detailName, baseName, base] of [
    ["countries-detail.geo.json", "countries.geo.json", geography],
    ["countries-globe-detail.geo.json", "countries-detail.geo.json", null],
    ["uk-countries-detail.geo.json", "uk-countries.geo.json", ukGeography],
  ]) {
    const detail = JSON.parse(await readFile(path.join(repo, "site/assets/vendor/leaflet", detailName), "utf8"));
    const reference = base || detailAssets.get(baseName);
    const hash = createHash("sha256").update(await readFile(path.join(repo, "site/assets/vendor/leaflet", baseName))).digest("hex");
    if (detail.sourceSha256 !== hash) errors.push(`${detailName}: regenerate detail after its source changes.`);
    if (JSON.stringify(detail.features.map((feature) => feature.properties)) !== JSON.stringify(reference.features.map((feature) => feature.properties))) errors.push(`${detailName}: detail must preserve every destination and name in order.`);
    for (const feature of detail.features) {
      const code = feature.properties.code;
      if (!feature.geometry) {
        if (!(detailName.includes("globe") && code === "VA")) errors.push(`${detailName}: missing geometry for ${code}.`);
        continue;
      }
      const rings = feature.geometry.type === "Polygon" ? feature.geometry.coordinates : feature.geometry.coordinates.flat();
      for (const ring of rings) {
        if (ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))) errors.push(`${detailName}: an open ring in ${code}.`);
        if (ring.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 180.00001 || Math.abs(y) > 90)) errors.push(`${detailName}: invalid coordinates in ${code}.`);
        if (!detailName.includes("globe") && ring.slice(1).some((point, index) => Math.abs(point[0] - ring[index][0]) > 180.00001)) errors.push(`${detailName}: a line crosses the world in ${code}.`);
      }
      if (detailName.includes("globe")) {
        const area = d3.geoArea(feature);
        if (!Number.isFinite(area) || area <= 0 || area >= 2 * Math.PI) errors.push(`${detailName}: invalid globe fill in ${code}.`);
      }
    }
    detailAssets.set(detailName, detail);
  }
  for (const code of ["NO", "JP", "CL"]) {
    const detailed = detailAssets.get("countries-detail.geo.json").features.find((feature) => feature.properties.code === code);
    const original = geography.features.find((feature) => feature.properties.code === code);
    if (pointCount(detailed.geometry) < pointCount(original.geometry) * 3) errors.push(`${code}: zoomed boundaries must have substantially more detail.`);
  }
  const ukDetail = detailAssets.get("uk-countries-detail.geo.json");
  const ukPolygons = ukDetail.features.reduce((sum, feature) => sum + (feature.geometry.type === "Polygon" ? 1 : feature.geometry.coordinates.length), 0);
  if (ukPolygons !== 59) errors.push("Detailed UK boundaries must retain all 59 source islands/polygons.");
  const detailedGlobe = (code) => detailAssets.get("countries-globe-detail.geo.json").features.find((feature) => feature.properties.code === code);
  if (d3.geoContains(detailedGlobe("ZA"), [28.2, -29.6]) || d3.geoContains(detailedGlobe("IT"), [12.46, 43.94])) errors.push("Detailed globe must preserve enclave holes.");
  if (!d3.geoContains(detailedGlobe("RU"), [37.62, 55.75]) || !d3.geoContains(detailedGlobe("RU"), [129.7, 62])) errors.push("Detailed globe must retain both sides of Russia.");
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
    if (!/<section\b[^>]*id="united-kingdom"[^>]*\bhidden>/.test(html) || !html.includes("data-uk-country-list")) errors.push(`${page}: the UK breakout must start hidden and include its text alternative.`);
    if (!/<section\b[^>]*id="united-states"[^>]*\bhidden>/.test(html)) errors.push(`${page}: the state breakdown must start hidden.`);
    if (!html.includes("data-world-overview") || !html.includes("data-back-world")) errors.push(`${page}: world/state navigation is missing.`);
    if (!html.includes('id="create-map"') || !html.includes('id="friends-maps"')) errors.push(`${page}: community map sections are missing.`);
    if (!html.includes("data-travel-breakdown")) errors.push(`${page}: the countries and continents breakdown is missing.`);
    if (!html.includes("data-travel-state-count")) errors.push(`${page}: the U.S. states summary counter is missing.`);
    if (!html.includes('data-world-view="flat"') || !html.includes('data-world-view="globe"') || !/<div\b[^>]*id="travel-globe"[^>]*\bhidden>/.test(html)) errors.push(`${page}: the flat/globe choice and default hidden globe are required.`);
    for (const asset of ["travel-map.css", "travel-countries.js", "travel-states.js", "travel-uk.js", "travel-map.js", "travel-globe.js", "travel-regions.js", "travel-stats.js"]) {
      if (!html.includes(asset)) errors.push(`${page} does not load ${asset}.`);
    }
    if (html.indexOf("travel-regions.js") > html.indexOf("travel-stats.js")) errors.push(`${page}: travel classification must load before the statistics.`);
    if (html.indexOf("travel-states.js") > html.indexOf("travel-stats.js")) errors.push(`${page}: visited states must load before the statistics.`);
    if (html.indexOf("travel-uk.js") > html.indexOf("travel-map.js")) errors.push(`${page}: UK visit data must load before the map.`);
    if (html.indexOf("travel-globe.js") > html.indexOf("travel-map.js")) errors.push(`${page}: the globe component must load before the map.`);
  }
  const mapPage = await readFile(path.join(repo, "site/maps/index.html"), "utf8");
  for (const asset of ["friends-config.js", "friends-map.js", "travel-map.js", "travel-globe.js", "friends-map.css"]) {
    if (!mapPage.includes(asset)) errors.push(`Map creator is missing ${asset}.`);
  }
  if (mapPage.includes('src="../assets/travel-countries.js"') || mapPage.includes('src="../assets/travel-states.js"')) errors.push("Map creator must not load Rustin’s visited lists.");
  if (mapPage.includes("travel-uk.js")) errors.push("Map creator must not load Rustin’s personal UK visits.");
  if (!mapPage.includes('data-world-view="globe"') || !mapPage.includes('id="travel-globe"')) errors.push("Friends' maps must offer the same flat/globe choice.");
} catch (error) {
  errors.push(`Travel map check: ${error.message}`);
}

// Exercise the real homepage script without making requests to Google.
// In particular, private map links must never be collected by Analytics.
try {
  const contentSource = await readFile(path.join(repo, "site/assets/content.js"), "utf8");
  const siteSource = await readFile(path.join(repo, "site/assets/site.js"), "utf8");
  function analyticsPreview(url, measurementId) {
    const scripts = [];
    const context = {
      window: {}, URL, location: new URL(url),
      requestAnimationFrame: () => {},
      document: {
        referrer: "https://example.com/private?edit=private-referrer#secret",
        querySelector: () => null, querySelectorAll: () => [],
        getElementById: () => null, createElement: () => ({}),
        head: { append: (script) => scripts.push(script) }
      }
    };
    runInNewContext(contentSource, context);
    if (measurementId !== undefined) context.window.RUSTIN_SITE.analytics.measurementId = measurementId;
    runInNewContext(siteSource, context);
    return { scripts, measurementId: context.window.RUSTIN_SITE.analytics?.measurementId, calls: (context.window.dataLayer || []).map((args) => Array.from(args)) };
  }
  for (const page of ["/", "/index.html"]) {
    const { scripts, calls, measurementId } = analyticsPreview(`https://rustin.coziahr.com${page}?edit=private-query#private-fragment`);
    if (measurementId === "") {
      if (scripts.length || calls.length) errors.push("An empty measurement ID must disable Analytics.");
      continue;
    }
    const config = calls.find(([command]) => command === "config");
    if (scripts.length !== 1 || scripts[0].src !== `https://www.googletagmanager.com/gtag/js?id=${measurementId}` || !scripts[0].async || scripts[0].referrerPolicy !== "origin") errors.push("The live homepage must load its Analytics tag asynchronously without leaking URL parameters in the request referrer.");
    if (!config || config[2].page_location !== "https://rustin.coziahr.com/" || config[2].page_referrer !== "https://example.com" || JSON.stringify(calls).includes("private-")) errors.push("Analytics must omit private query strings, fragments, and referrer paths.");
    if (config?.[2].allow_google_signals !== false || config?.[2].allow_ad_personalization_signals !== false) errors.push("Analytics advertising features must stay disabled.");
  }
  for (const url of [
    "http://127.0.0.1:4173/", "http://localhost:4173/", "http://rustin.coziahr.com/",
    "https://rustin.coziahr.com/testing/", "https://rustin.coziahr.com/maps/?edit=private-link",
    ...[1, 2, 3, 4].map((number) => `https://rustin.coziahr.com/testing/options/${number}/`),
    "https://rustin.coziahr.com.example.com/"
  ]) {
    const { scripts, calls } = analyticsPreview(url);
    if (scripts.length || calls.length) errors.push(`Analytics must not run on ${url.split("?")[0]}`);
  }
  for (const invalidId of ["", "not-a-measurement-id"]) {
    if (analyticsPreview("https://rustin.coziahr.com/", invalidId).scripts.length) errors.push("An empty or invalid measurement ID must disable Analytics.");
  }
} catch (error) {
  errors.push(`Analytics check: ${error.message}`);
}

if (errors.length) {
  console.error("Site check failed:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`Site check passed. Homepage uses design ${match[1]}; all four testing options and shared assets are present.`);

