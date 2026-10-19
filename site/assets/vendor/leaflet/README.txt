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
