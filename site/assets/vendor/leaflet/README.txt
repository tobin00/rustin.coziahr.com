Local, pinned map assets. No visitor requests to a CDN, map tile service or API.

Leaflet 1.9.4 (BSD-2-Clause)
Source: https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js
CSS: https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css
License: LICENSE
No tile layers or marker images are used.

Country boundaries: World Atlas 2.0.2 / Natural Earth 1:10m (public domain)
Source: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json
Project: https://github.com/topojson/world-atlas
License: LICENSE-world-atlas
Converted to GeoJSON with topojson-client 3.1.0, numeric country IDs mapped
to ISO alpha-2 via i18n-iso-countries 7.14.0, then simplified once with:
  npx mapshaper@0.6.113 -i source.geo.json -simplify 8% keep-shapes -o format=geojson precision=0.001 countries.geo.json
Country properties retained: code (ISO alpha-2, or null for areas without
a distinct standard code) and name. Shapes with the same ISO code were
grouped (Australia and Ashmore/Cartier); Vatican's source shape was retained
at original precision because simplification collapsed it. Coordinates and boundaries come from
the dataset, not hand-drawn geography. All source features are retained.
Natural Earth is a generalized small-scale map, not a boundary authority.
Longitude seams were normalized with D3 7.9.0 and d3-geo-projection 4.0.0
(geoProject with an equirectangular projection in degrees). This splits
antimeridian-crossing polygons, avoiding lines across Russia and Fiji.
These D3 packages are also preparation tools only, not visitor dependencies.

Caribbean map units (public domain, Natural Earth 1:10m)
Source: https://github.com/nvkelso/natural-earth-vector
Pinned commit: 117488dc884bad03366ff727eca013e434615127
Exact source file:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/117488dc884bad03366ff727eca013e434615127/geojson/ne_10m_admin_0_map_units.geojson
SHA-256: 57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862
The source ISO_A2_EH field identifies Guadeloupe (GP), Martinique (MQ), and
Caribbean Netherlands (BQ). tools/prepare-caribbean-map.mjs separates the
three existing French island polygons (two GP, one MQ) into their own features.
Those coordinates are moved intact, so France does not overlap the new regions.
All remaining France polygons and every other existing feature stay unchanged.
BQ adds the source's three polygons for Bonaire, Sint Eustatius, and Saba,
rounded to the asset's existing 0.001-degree precision. No boundary is invented.
The preparation script verifies the pinned source checksum, region identities,
polygon counts, exact preservation of all other features, and unchanged France
coordinates outside the moved islands. It does not fetch data or add dependencies.
To reproduce, download the exact source to a preparation folder, then run:
  node tools/prepare-caribbean-map.mjs --source C:/prep/map-units.geojson
An already prepared asset is validated without being rewritten. Rebuilding the
world asset from its original World Atlas source requires applying this step
again. The new regions add about 1.4 KB, and no upstream file is shipped to visitors.

Antarctica inset asset: antarctica-polar.json
The main world map keeps its familiar equirectangular country shapes.
Antarctica is also available as a compact South Pole inset, prepared from the
same World Atlas 2.0.2 / Natural Earth 1:10m source boundary. The inset uses
D3's standard azimuthal equal-area projection, rotated to the South Pole;
it is not a hand-drawn or invented boundary.
Projection reference: https://d3js.org/d3-geo/azimuthal#geoAzimuthalEqualArea

The file is planar GeoJSON, not longitude/latitude GeoJSON. Metadata:
  projection: "South Pole"
  viewport: [200, 200]
Coordinates increase rightward and downward. Leaflet CRS.Simple displays them
with coordsToLatLng([x, y]) = L.latLng(-y, x). Fit the full viewport, not geographic
latitude bounds. Do not run these projected coordinates through another
geographic projection. countries.geo.json remains the geographic reference and
main-map source, including its original AQ feature and all country codes.

Preparation uses tools/prepare-world-map.mjs with these pinned, separate tools:
  D3 7.9.0: https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js
  d3-geo-projection 4.0.0:
    https://cdn.jsdelivr.net/npm/d3-geo-projection@4.0.0/dist/d3-geo-projection.min.js
  mapshaper 0.6.113 (installed in a separate preparation folder)
The D3 bundles and mapshaper are not distributed or loaded by the website.
Existing Natural Earth / World Atlas provenance and licenses cover the data.

Give the script an UNSIMPLIFIED spherical FeatureCollection converted from the
pinned countries-10m.json with topojson-client 3.1.0. For each source feature,
retain only properties {code, name}: map the zero-padded numeric feature id to
the ISO alpha-2 field of the pinned i18n-iso-countries 7.14.0 codes.json, or null
if there is no standard code; retain the original source name and geometry.
Do not use countries.geo.json as this source: its prior equirectangular seam
and polar patches cannot safely be streamed through a second projection.
Example (all preparation files are outside the project):
  node tools/prepare-world-map.mjs --source C:/prep/source.geo.json --d3 C:/prep/d3-7.9.0.js --projection C:/prep/d3-geo-projection-4.0.0.js --mapshaper C:/prep/node_modules/mapshaper/bin/mapshaper

The preparation script extracts only AQ, normalizes spherical ring direction,
and applies geoProject with geoAzimuthalEqualArea().rotate([0, 90]), fitted to
the inset viewport with padding. It simplifies the projected topology at 5%
with planar keep-shapes and 0.01-unit precision. The small inset contains one
AQ feature and is about 18 KB; all main-map geography remains unchanged.
The script checks the region code, finite viewport bounds, and positive area
without a globe-covering polygon. Re-run npm run check after regeneration and
inspect the Antarctic tooltip/selection at phone and desktop widths.

ISO country-code catalog: i18n-iso-countries 7.14.0 (MIT)
Source: https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/codes.json
License: LICENSE-iso-countries
Reduced to ISO alpha-2 codes; nonstandard XK omitted from this catalog.
The map may still show geographic areas with no ISO code as neutral shapes.
The country selector/text fallback includes all standard codes, including
territories incorporated into a larger country's shape by Natural Earth.

Converter and simplifier are preparation tools only, not runtime or project
dependencies. To update boundaries, repeat this preparation from the pinned
upstream source, preserve the licenses, and review the small-country checks.

U.S. state boundaries: U.S. Atlas 3.0.1 / U.S. Census Bureau 2017 (ISC)
Source: https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json
Project: https://github.com/topojson/us-atlas
License: LICENSE-us-atlas
Converted once with topojson-client 3.1.0, filtering to the 50 state FIPS codes
and adding standard postal abbreviations. D.C. and territories are excluded.
Coordinates retain the dataset's precomputed Albers USA projection, including
Alaska/Hawaii insets in a 975 x 610 viewport, rounded to 0.01 projected units.
Leaflet CRS.Simple displays these projected shapes without a new projection
library or custom state geography. State data loads separately when approached.

United Kingdom constituent countries: uk-countries.geo.json
Public domain, Natural Earth 1:10m Admin-0 map units. The upstream theme explicitly
separates England, Scotland, Wales, and Northern Ireland:
https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/
Pinned commit: 117488dc884bad03366ff727eca013e434615127
Exact source file (the same source already used for the Caribbean map units):
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/117488dc884bad03366ff727eca013e434615127/geojson/ne_10m_admin_0_map_units.geojson
SHA-256: 57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862

tools/prepare-uk-map.mjs selects ADM0_A3=GBR and the four GU_A3 values ENG, SCT,
WLS, and NIR. It retains only {code, name} properties, with the standard ISO
3166-2 subdivision identifiers GB-ENG, GB-SCT, GB-WLS, and GB-NIR. These codes
identify the breakout regions; they do not replace GB in the world ISO catalog.

The existing preparation-only mapshaper 0.6.113 tool shares topology across the
four source regions, explodes their 59 polygons, simplifies at 20% with
keep-shapes, then dissolves by code. Exploding before keep-shapes preserves
every source polygon, including Scotland's islands and Rockall. Output uses
0.001-degree coordinate precision. It is geographic longitude/latitude GeoJSON,
not a preprojected inset. The resulting four-feature asset is about 28 KB and
loads only when needed. No source files, mapshaper code, or extra dependencies
are sent to visitors. The existing Natural Earth public-domain license applies.

The script verifies the exact upstream checksum, pinned tool version, region
identities, all 59 retained polygons, finite coordinates within original bounds,
closed rings, and nonzero island areas. The original world map is unchanged.
To reproduce, download the exact source into a preparation folder, then run:
  node tools/prepare-uk-map.mjs --source C:/prep/map-units.geojson --mapshaper C:/prep/node_modules/mapshaper/bin/mapshaper
Optional --output writes to a different file for comparison. Run npm run check
and inspect the UK breakout at desktop and phone widths after regeneration.

Globe-only country boundaries: countries-globe.geo.json
This lazy-loaded companion comes from the existing countries.geo.json above;
all World Atlas / Natural Earth provenance and licenses remain applicable.
It contains the same 257 features, codes, names, and every nondegenerate
region's exact original coordinate-value set. The Leaflet world asset remains
untouched. Only polygon grouping, ring order/direction, redundant references,
and the existing degenerate Vatican geometry are normalized for D3's spherical
stream. There is no new country geography or extra simplification.

The flat map uses an even-odd fill rule. Several of its nested enclave rings
are stored as separate MultiPolygon fragments, and Russia has an invalid
shell/hole grouping at the longitude seam. Simply reversing every outer ring
would fill enclaves or paint the whole globe. Preparation delegates ring
containment and winding repair to maintained mapshaper 0.6.113 routines:
  -i countries.geo.json no-topology
  -clean rewind allow-empty only-arcs
  -o format=geojson gj2008 countries-globe.geo.json
No cross-country topology, snapping, intersection cuts, gap fills, overlap
dissolves, projection, coordinate rounding, or boundary simplification runs.
The no-topology/only-arcs options preserve every nondegenerate region's exact
coordinate-value set while grouping nested holes correctly. Natural Earth
generalization and original source precision still limit geographic accuracy.

Vatican's existing source ring has only two distinct collinear points and zero
spherical area. The companion retains its VA code/name with null geometry,
rather than inventing a shape or drawing an inverted globe-sized fill. Text
lists and selectors can still report its visit status. All other features
retain polygon geography.

tools/prepare-globe-geography.mjs verifies identical feature properties and
per-feature coordinate-value sets, finite geographic coordinates, closed rings,
positive country areas smaller than a hemisphere, Lesotho and San Marino holes,
and non-complement fills in five globe rotations using the pinned local D3
subset. It includes a sourceSha256 field in the asset, so validation catches a
stale globe after the original country boundaries change.
Current source SHA-256:
50e81c8c4849d541ba12dd4eec6fd0241c4a0effbb4c9a1e83ec70868a783381
Current companion SHA-256:
b56b5db61c068a15ad40206081f3cc6f3d4b9cb6d191ca5ee64b210425583f45
Size: about 875 KB, requested only when the visitor first switches to Globe.

Reproduce using the separate preparation-only mapshaper installation:
  node tools/prepare-globe-geography.mjs --mapshaper C:/prep/node_modules/mapshaper/bin/mapshaper
Optional --source, --d3, and --output paths support comparison/regeneration.
Run npm run check and inspect all map views after regeneration. The local D3
subset's source versions, licenses, and build instructions are in ../d3/.
