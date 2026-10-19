(function () {
  const section = document.querySelector("#world");
  if (!section) return;
  const assets = new URL(".", document.currentScript.src);
  const config = window.RUSTIN_TRAVEL || { visited: [], upcoming: [], showUpcoming: false };
  const visited = new Set(config.visited.map((code) => code.toUpperCase()));
  const upcoming = new Set(config.showUpcoming ? config.upcoming.map((code) => code.toUpperCase()) : []);
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const count = section.querySelector("[data-country-count]");
  const status = section.querySelector("[data-country-status]");
  const picker = section.querySelector("[data-country-picker]");
  const list = section.querySelector("[data-visited-list]");
  const moveButton = section.querySelector("[data-move-map]");
  const host = section.querySelector("#travel-map");
  count.textContent = visited.size;
  section.querySelector("[data-upcoming-legend]").hidden = !config.showUpcoming;
  list.textContent = visited.size ? [...visited].map((code) => names.of(code)).sort().join(", ") : "My visited-country list is coming soon.";

  function loadAsset(tag, path) {
    return new Promise((resolve, reject) => {
      const element = document.createElement(tag);
      if (tag === "script") element.src = new URL(path, assets);
      else { element.rel = "stylesheet"; element.href = new URL(path, assets); }
      element.onload = resolve;
      element.onerror = reject;
      document.head.appendChild(element);
    });
  }

  async function initialize() {
    try {
      const [, , geography, countryCodes] = await Promise.all([
        loadAsset("link", "vendor/leaflet/leaflet-1.9.4.css"),
        loadAsset("script", "vendor/leaflet/leaflet-1.9.4.js"),
        fetch(new URL("vendor/leaflet/countries.geo.json", assets)).then((response) => {
          if (!response.ok) throw new Error("Country boundaries could not load");
          return response.json();
        }),
        fetch(new URL("vendor/leaflet/iso-codes.json", assets)).then((response) => {
          if (!response.ok) throw new Error("Country names could not load");
          return response.json();
        })
      ]);
      const palette = getComputedStyle(section);
      const color = (variable) => palette.getPropertyValue(variable).trim();
      const countryName = (feature) => feature.properties.code ? names.of(feature.properties.code) : feature.properties.name;
      const description = (code, name) => name + " — " + (visited.has(code) ? "Visited" : "Not yet visited") + (upcoming.has(code) ? " · Upcoming" : "");
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const worldBounds = L.latLngBounds([[-90, -180], [90, 180]]);
      // Leaflet handles projection, country rendering, tooltips, zooming and panning.
      // EPSG:4326 shows the whole world, including Antarctica, without tile requests.
      const map = L.map(host, {
        crs: L.CRS.EPSG4326, zoomSnap: 0, zoomDelta: 0.75, minZoom: -3, maxZoom: 8,
        scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false,
        dragging: false, keyboard: true, zoomAnimation: !reducedMotion,
        fadeAnimation: !reducedMotion, inertia: false, attributionControl: false,
        maxBounds: [[-105, -200], [105, 200]], maxBoundsViscosity: 1
      });
      host.setAttribute("aria-label", "World travel map. Use arrow keys to pan, plus and minus to zoom, or the country selector for a text alternative.");
      const layers = new Map();
      const baseStyle = (feature) => ({
        fillColor: color(visited.has(feature.properties.code) ? "--world-visited" : "--world-unvisited"),
        fillOpacity: 1,
        color: color(upcoming.has(feature.properties.code) ? "--world-upcoming" : "--world-border"),
        opacity: 1, weight: upcoming.has(feature.properties.code) ? 1.6 : 0.65
      });
      const countries = L.geoJSON(geography, {
        style: baseStyle,
        onEachFeature(feature, layer) {
          const code = feature.properties.code;
          const name = countryName(feature);
          if (code) layers.set(code, layer);
          const content = document.createElement("div");
          content.className = "world-tooltip-content";
          const title = document.createElement("strong");
          title.textContent = name;
          const detail = document.createElement("span");
          detail.textContent = visited.has(code) ? "Visited" : "Not yet visited";
          content.append(title, detail);
          if (upcoming.has(code)) {
            const note = document.createElement("span");
            note.textContent = "Upcoming";
            content.append(note);
          }
          layer.bindTooltip(content, { sticky: true, direction: "top", className: "world-tooltip", opacity: 1 });
          layer.on({
            mouseover() { layer.setStyle({ fillOpacity: 0.8, weight: 1.8 }); },
            mouseout() { layer.setStyle(baseStyle(feature)); },
            click(event) {
              status.textContent = description(code, name);
              layer.openTooltip(event.latlng);
            }
          });
          layer.on("add", () => {
            const element = layer.getElement();
            element.setAttribute("aria-label", description(code, name));
            element.classList.toggle("is-visited", visited.has(code));
            element.classList.toggle("is-upcoming", upcoming.has(code));
          });
        }
      }).addTo(map);

      function reset() {
        picker.value = "";
        status.textContent = "Hover or tap a country to explore.";
        map.setMinZoom(-3);
        map.fitBounds(worldBounds, { padding: [12, 12], animate: false });
        map.setMinZoom(map.getZoom());
        countries.eachLayer((layer) => layer.closeTooltip());
      }
      reset();
      const resetButton = section.querySelector("[data-reset-map]");
      resetButton.hidden = false;
      resetButton.addEventListener("click", reset);
      let moving = false;
      moveButton.hidden = false;
      moveButton.addEventListener("click", () => {
        moving = !moving;
        moveButton.setAttribute("aria-pressed", String(moving));
        moveButton.textContent = moving ? "Done moving map" : "Move map";
        host.classList.toggle("is-moving", moving);
        if (moving) { map.dragging.enable(); map.touchZoom.enable(); }
        else { map.dragging.disable(); map.touchZoom.disable(); }
      });
      section.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          countries.eachLayer((layer) => layer.closeTooltip());
          if (moving) moveButton.click();
        }
      });
      countryCodes.sort((a, b) => names.of(a).localeCompare(names.of(b))).forEach((code) => picker.add(new Option(names.of(code), code)));
      picker.disabled = false;
      picker.addEventListener("change", () => {
        countries.eachLayer((layer) => layer.closeTooltip());
        if (!picker.value) { reset(); status.textContent = "Hover or tap a country to explore."; return; }
        const code = picker.value;
        status.textContent = description(code, names.of(code));
        const layer = layers.get(code);
        if (layer) {
          map.fitBounds(layer.getBounds(), { padding: [35, 35], maxZoom: 6, animate: !reducedMotion });
          layer.openTooltip(layer.getBounds().getCenter());
        }
      });
      new ResizeObserver(() => { map.invalidateSize({ pan: false }); reset(); }).observe(host);
      section.querySelector("[data-map-loading]").hidden = true;
    } catch (error) {
      section.querySelector("[data-map-loading]").textContent = "The map couldn’t load. Please refresh to try again; the visited list is available below.";
      console.error("Travel map could not load:", error);
    }
  }
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); initialize(); }
    }, { rootMargin: "400px" });
    observer.observe(section);
  } else initialize();
})();
