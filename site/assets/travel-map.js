(function () {
  const assets = new URL(".", document.currentScript.src);
  let library;
  const worldSection = document.querySelector("#world");
  const overview = worldSection?.querySelector("[data-world-overview]");
  const statesSection = document.querySelector("#united-states");
  let worldOpener;
  let usTrigger;

  function normalizeCodes(codes) {
    if (!Array.isArray(codes)) throw new TypeError("Visited places must be an array of two-letter codes.");
    return [...new Set(codes.map((code) => String(code).trim().toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code)))];
  }

  function openStates(opener) {
    if (!statesSection || !overview) return;
    worldOpener = opener || usTrigger;
    overview.hidden = true;
    statesSection.hidden = false;
    worldSection.classList.add("is-drilled-down");
    usTrigger?.setAttribute("aria-expanded", "true");
    statesSection.querySelector("#states-title").focus({ preventScroll: true });
    worldSection.scrollIntoView({ block: "start", behavior: "auto" });
  }

  function backToWorld() {
    if (!statesSection || !overview) return;
    statesSection.hidden = true;
    overview.hidden = false;
    worldSection.classList.remove("is-drilled-down");
    usTrigger?.setAttribute("aria-expanded", "false");
    (worldOpener || usTrigger)?.focus({ preventScroll: true });
    worldSection.scrollIntoView({ block: "start", behavior: "auto" });
  }
  statesSection?.querySelector("[data-back-world]").addEventListener("click", backToWorld);
  statesSection?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      backToWorld();
    }
  });

  function mountMap(section, settings) {
    if (!section) return;
    const config = settings.config || { visited: [], upcoming: [], showUpcoming: false };
    const visited = new Set(normalizeCodes(config.visited || []));
    const upcoming = new Set(config.showUpcoming ? (config.upcoming || []).map((code) => code.toUpperCase()) : []);
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const count = section.querySelector("[data-map-count]");
    const status = section.querySelector("[data-map-status]");
    const picker = section.querySelector("[data-map-picker]");
    const list = section.querySelector("[data-visited-list]");
    const moveButton = section.querySelector("[data-move-map]");
    const host = section.querySelector(".travel-map");
    const countLabel = section.querySelector("[data-map-count-label]");
    if (countLabel) countLabel.textContent = settings.states ? "States Explored" : "Destinations Explored";
    section.querySelectorAll("[data-upcoming-legend]").forEach((item) => { item.hidden = !config.showUpcoming; });
    let refreshMap;
    let placeName = (code) => {
      const name = settings.states ? code : (code === "MO" ? "Macau" : names.of(code));
      const note = !settings.states && config.countryNotes?.[code];
      return note ? name + " (" + note + ")" : name;
    };
    function refreshSummary() {
      count.textContent = visited.size;
      list.textContent = visited.size ? [...visited].map(placeName).sort().join(", ") :
        (config.emptyMessage || (settings.states ? "No U.S. states selected yet." : "No destinations selected yet."));
    }
    function updateVisited(codes) {
      const next = normalizeCodes(codes);
      visited.clear();
      next.forEach((code) => visited.add(code));
      refreshSummary();
      refreshMap?.();
    }
    refreshSummary();

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
        const [, geography, catalog] = await Promise.all([
          library ||= Promise.all([
            loadAsset("link", "vendor/leaflet/leaflet-1.9.4.css"),
            loadAsset("script", "vendor/leaflet/leaflet-1.9.4.js")
          ]),
          fetch(new URL("vendor/leaflet/" + settings.geography, assets)).then((response) => {
            if (!response.ok) throw new Error("Country boundaries could not load");
            return response.json();
          }),
          settings.states ? Promise.resolve(null) : fetch(new URL("vendor/leaflet/iso-codes.json", assets)).then((response) => {
            if (!response.ok) throw new Error("Country names could not load");
            return response.json();
          })
        ]);
        // A visitor may return to the world while the state file is loading.
        // Wait for a visible map container before Leaflet measures its size.
        if (!host.clientWidth || !host.clientHeight) {
          await new Promise((resolve) => {
            const visible = new ResizeObserver(() => {
              if (host.clientWidth && host.clientHeight) { visible.disconnect(); resolve(); }
            });
            visible.observe(host);
          });
        }
        const palette = getComputedStyle(section);
        const color = (variable) => palette.getPropertyValue(variable).trim();
        const stateNames = new Map(geography.features.map((feature) => [feature.properties.code, feature.properties.name]));
        if (settings.states) placeName = (code) => stateNames.get(code) || code;
        const countryCodes = catalog || [...stateNames.keys()];
        const countryName = (feature) => feature.properties.code ? placeName(feature.properties.code) : feature.properties.name;
        refreshSummary();
        const description = (code, name) => name + " — " + (visited.has(code) ? "Visited" : "Not yet visited") + (upcoming.has(code) ? " · Upcoming" : "");
        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const homeBounds = L.latLngBounds(settings.states ? [[-610, 0], [0, 975]] : [[-90, -180], [90, 180]]);
        const idleStatus = "Hover or tap a " + (settings.states ? "state" : "country") + " to explore.";
        // Leaflet handles rendering, tooltips, zooming and panning. The U.S.
        // dataset is already projected by U.S. Atlas, with Alaska/Hawaii insets.
        const map = L.map(host, {
          crs: settings.states ? L.CRS.Simple : L.CRS.EPSG4326,
          zoomSnap: 0, zoomDelta: 0.75, minZoom: -5, maxZoom: settings.states ? 4 : 8,
          scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false,
          dragging: false, keyboard: true, zoomAnimation: !reducedMotion,
          fadeAnimation: !reducedMotion, inertia: false, attributionControl: false,
          maxBounds: settings.states ? homeBounds.pad(0.15) : [[-105, -200], [105, 200]], maxBoundsViscosity: 1
        });
        host.setAttribute("aria-label", (settings.states ? "U.S. state travel map" : "World travel map") + ". Use arrow keys to pan, plus and minus to zoom, or the selector for a text alternative.");
        const layers = new Map();
        let selectedCode;
        const baseStyle = (feature) => {
          const code = feature.properties.code;
          const wasVisited = visited.has(code);
          const isUpcoming = upcoming.has(code);
          const returning = wasVisited && isUpcoming;
          return {
            fillColor: color(wasVisited ? "--world-visited" : isUpcoming ? "--world-upcoming" : "--world-unvisited"),
            fillOpacity: 1,
            color: color(returning ? "--world-upcoming" : "--world-border"),
            opacity: 1, weight: returning ? 1.6 : 0.65
          };
        };
        function tooltipContent(code, name) {
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
          if (!settings.states && code === "US" && statesSection) {
            const hint = document.createElement("span");
            hint.textContent = "Explore U.S. states →";
            content.append(hint);
          }
          return content;
        }
        function refreshLayer(feature, layer) {
          const code = feature.properties.code;
          const name = countryName(feature);
          layer.setStyle(baseStyle(feature));
          layer.setTooltipContent(tooltipContent(code, name));
          const element = layer.getElement();
          if (!element) return;
          element.setAttribute("aria-label", description(code, name) + (!settings.states && code === "US" && statesSection ? ". Explore U.S. states" : ""));
          element.classList.toggle("is-visited", visited.has(code));
          element.classList.toggle("is-upcoming", upcoming.has(code));
        }
        const countries = L.geoJSON(geography, {
          style: baseStyle,
          coordsToLatLng: settings.states ? (coords) => L.latLng(-coords[1], coords[0]) : undefined,
          onEachFeature(feature, layer) {
            const code = feature.properties.code;
            const name = countryName(feature);
            if (code) layers.set(code, layer);
            layer.bindTooltip(tooltipContent(code, name), { sticky: true, direction: "top", className: "world-tooltip", opacity: 1 });
            layer.on({
              mouseover() { layer.setStyle({ fillOpacity: 0.8, weight: 1.8 }); },
              mouseout() { layer.setStyle(baseStyle(feature)); },
              click(event) {
                if (!settings.states && code === "US" && statesSection) {
                  layer.closeTooltip();
                  openStates(layer.getElement());
                  return;
                }
                selectedCode = code;
                status.textContent = description(code, name);
                layer.openTooltip(event.latlng);
              }
            });
            layer.on("add", () => {
              const element = layer.getElement();
              refreshLayer(feature, layer);
              if (!settings.states && code === "US" && statesSection) {
                usTrigger = element;
                element.setAttribute("role", "button");
                element.setAttribute("tabindex", "0");
                element.setAttribute("aria-controls", "united-states");
                element.setAttribute("aria-expanded", String(!statesSection.hidden));
                element.addEventListener("keydown", (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    layer.closeTooltip();
                    openStates(element);
                  }
                });
              }
            });
          }
        }).addTo(map);

        refreshMap = () => {
          countries.eachLayer((layer) => refreshLayer(layer.feature, layer));
          if (selectedCode) status.textContent = description(selectedCode, placeName(selectedCode));
        };

        function reset() {
          picker.value = "";
          selectedCode = undefined;
          status.textContent = idleStatus;
          map.setMinZoom(-5);
          map.fitBounds(homeBounds, { padding: [12, 12], animate: false });
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
        countryCodes.sort((a, b) => placeName(a).localeCompare(placeName(b))).forEach((code) => picker.add(new Option(placeName(code), code)));
        picker.disabled = false;
        picker.addEventListener("change", () => {
          countries.eachLayer((layer) => layer.closeTooltip());
          if (!picker.value) { reset(); status.textContent = idleStatus; return; }
          const code = picker.value;
          selectedCode = code;
          status.textContent = description(code, placeName(code));
          if (!settings.states && code === "US" && statesSection) { openStates(picker); return; }
          const layer = layers.get(code);
          if (layer) {
            map.fitBounds(layer.getBounds(), { padding: [35, 35], maxZoom: settings.states ? 2 : 6, animate: false });
            layer.openTooltip(layer.getBounds().getCenter());
          }
        });
        new ResizeObserver(() => {
          if (!host.clientWidth || !host.clientHeight) return;
          map.invalidateSize({ pan: false });
          reset();
        }).observe(host);
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
    return { updateVisited, getVisited: () => [...visited] };
  }
  const world = mountMap(document.querySelector("#world"), { config: window.RUSTIN_TRAVEL, states: false, geography: "countries.geo.json" });
  const states = mountMap(document.querySelector("#united-states"), { config: window.RUSTIN_STATES, states: true, geography: "us-states-albers.json" });
  // Editors change their own saved data, then use this read-only rendering API.
  // The sets also update before Leaflet loads, so lazy maps show current choices.
  window.RustinMaps = {
    updateVisited(selections = {}) {
      if (Object.hasOwn(selections, "countries")) world?.updateVisited(selections.countries);
      if (Object.hasOwn(selections, "states")) states?.updateVisited(selections.states);
      const detail = { countries: world?.getVisited() || [], states: states?.getVisited() || [] };
      window.dispatchEvent(new CustomEvent("rustinmaps:updated", { detail }));
      return detail;
    }
  };
  window.dispatchEvent(new CustomEvent("rustinmaps:ready"));
})();
