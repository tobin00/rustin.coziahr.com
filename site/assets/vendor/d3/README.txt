Local, pinned D3 globe subset. No CDN, tile service, API key, or globe engine.

Asset: d3-globe.min.js
Global: window.RustinGlobeD3 (classic script/IIFE, no global d3 replacement)
77,825 bytes; 27,219 bytes with gzip level 9.
SHA-256: 00443e24fc6b46640d2211b92d0cd03902a052074c0c8634a03e713c10677984

This is a tree-shaken bundle of official D3 source packages, rather than the
whole D3 library. Maintained D3 projection/path routines draw the sphere and
country boundaries; native D3 drag/zoom routines handle interaction.
Exported functions:
  geoOrthographic, geoPath, geoGraticule10, geoCentroid, geoArea,
  geoDistance, geoContains, geoRotation, select, pointer, drag,
  zoom, zoomIdentity

Pinned runtime packages, verified against the official npm registry:
  d3-geo 3.1.1              https://github.com/d3/d3-geo/tree/v3.1.1
  d3-array 3.2.4            https://github.com/d3/d3-array/tree/v3.2.4
  d3-selection 3.0.0        https://github.com/d3/d3-selection/tree/v3.0.0
  d3-dispatch 3.0.1         https://github.com/d3/d3-dispatch/tree/v3.0.1
  d3-drag 3.0.0             https://github.com/d3/d3-drag/tree/v3.0.0
  d3-interpolate 3.0.1      https://github.com/d3/d3-interpolate/tree/v3.0.1
  d3-color 3.1.0            https://github.com/d3/d3-color/tree/v3.1.0
  d3-transition 3.0.1       https://github.com/d3/d3-transition/tree/v3.0.1
  d3-timer 3.0.1            https://github.com/d3/d3-timer/tree/v3.0.1
  d3-ease 3.0.1             https://github.com/d3/d3-ease/tree/v3.0.1
  d3-zoom 3.0.0             https://github.com/d3/d3-zoom/tree/v3.0.0
  internmap 2.0.3           https://github.com/mbostock/internmap/tree/v2.0.3
Most packages use ISC; d3-ease uses BSD-3-Clause. Their original license texts
are preserved in the neighboring LICENSE file. Unused exports and dependencies
are removed by tree shaking; retaining every pinned package's license is safe.

Preparation-only bundler: esbuild 0.28.2 (MIT)
https://github.com/evanw/esbuild/tree/v0.28.2
The bundler is neither shipped to visitors nor added as a project dependency.

Reproduce in a separate preparation folder, never the project root:
  npm install --prefix C:/prep/globe --save-exact --no-audit --no-fund d3-geo@3.1.1 d3-array@3.2.4 d3-selection@3.0.0 d3-dispatch@3.0.1 d3-drag@3.0.0 d3-interpolate@3.0.1 d3-color@3.1.0 d3-transition@3.0.1 d3-timer@3.0.1 d3-ease@3.0.1 d3-zoom@3.0.0 internmap@2.0.3 esbuild@0.28.2
Then, from this repository:
  node tools/prepare-globe-vendor.mjs --modules C:/prep/globe/node_modules
Optional --output writes to a separate comparison file and its adjacent LICENSE.
The script verifies every exact package version and reports the resulting
uncompressed/gzip sizes and SHA-256. It does not fetch data or change package.json.
The entry is kept in that script; esbuild bundles/minifies with browser platform,
IIFE format, globalName RustinGlobeD3, ES2018 target, UTF-8, and no source map.

Integration notes:
- Load this asset locally only when the Globe view is first requested.
- Use the existing prepared geography; see the Leaflet vendor README for the
  globe-only ring normalization asset and its source checksum.
- D3 uses clockwise spherical exterior rings, the opposite of RFC 7946's
  convention. Do not blindly reverse each ring: nested enclave fragments need
  correct ring containment as well as direction.
- Use drag().touchable(false) and zoom().touchable(false) in the consumer's
  default mode so phone swipes retain normal page scrolling. D3's configurable
  behavior API is unchanged; touch can be enabled by an explicit map-move mode.
- When drag controls rotation, zoom.filter(event => event.type === "wheel")
  limits D3 zoom to wheel gestures; the same zoom behavior supports zoom buttons.
- Respect reduced-motion preferences in the consumer; this subset starts no
  animation, timer, drag, or wheel listener until explicitly used.

Official API references:
https://d3js.org/d3-geo/azimuthal#geoOrthographic
https://d3js.org/d3-geo (spherical winding and antimeridian guidance)
https://d3js.org/d3-drag#drag_touchable
https://d3js.org/d3-zoom#zoom_touchable
