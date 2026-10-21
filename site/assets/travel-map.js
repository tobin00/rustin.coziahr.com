(function () {
  const assets = new URL(".", document.currentScript.src);
  let library;
  const worldSection = document.querySelector("#world");
  const overview = worldSection?.querySelector("[data-world-overview]");
  const breakouts = new Map([
    ["US", { section: document.querySelector("#united-states"), title: "#states-title", hint: "Explore U.S. states" }],
    ["GB", { section: document.querySelector("#united-kingdom"), title: "#uk-title", hint: "Explore England, Scotland, Wales & Northern Ireland" }]
  ].filter(([, breakout]) => breakout.section));
  let worldOpener;
  let activeBreakout;

  function normalizeCodes(codes, pattern = /^[A-Z]{2}$/) {
    if (!Array.isArray(codes)) throw new TypeError("Visited places must be an array of codes.");
    return [...new Set(codes.map((code) => String(code).trim().toUpperCase()).filter((code) => pattern.test(code)))];
  }

  function openBreakout(code, opener) {
    const breakout = breakouts.get(code);
    if (!breakout || !overview) return;
    worldOpener = opener || breakout.trigger;
    if (worldOpener?.hasAttribute("aria-controls")) worldOpener.setAttribute("aria-expanded", "true");
    activeBreakout = breakout;
    overview.hidden = true;
    for (const entry of breakouts.values()) {
      entry.section.hidden = entry !== breakout;
      entry.trigger?.setAttribute("aria-expanded", String(entry === breakout));
    }
    document.querySelectorAll("[data-open-uk]").forEach((button) => button.setAttribute("aria-expanded", String(code === "GB")));
    worldSection.classList.add("is-drilled-down");
    breakout.section.querySelector(breakout.title).focus({ preventScroll: true });
    worldSection.scrollIntoView({ block: "start", behavior: "auto" });
  }

  function backToWorld() {
    if (!activeBreakout || !overview) return;
    for (const breakout of breakouts.values()) {
      breakout.section.hidden = true;
      breakout.trigger?.setAttribute("aria-expanded", "false");
    }
    document.querySelectorAll("[data-open-uk]").forEach((button) => button.setAttribute("aria-expanded", "false"));
    overview.hidden = false;
    worldSection.classList.remove("is-drilled-down");
    if (worldOpener?.hasAttribute("aria-controls")) worldOpener.setAttribute("aria-expanded", "false");
    (worldOpener || activeBreakout.trigger)?.focus({ preventScroll: true });
    activeBreakout = undefined;
    worldSection.scrollIntoView({ block: "start", behavior: "auto" });
  }
  for (const breakout of breakouts.values()) {
    breakout.section.querySelector("[data-back-world]").addEventListener("click", backToWorld);
    breakout.section.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        backToWorld();
      }
    });
  }
  worldSection?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-uk]");
    if (button) openBreakout("GB", button);
  });

  function mountMap(section, settings) {
    if (!section) return;
    const config = settings.config || { visited: [], upcoming: [], showUpcoming: false };
    const regional = settings.states || settings.uk;
    const codePattern = settings.uk ? /^GB-(ENG|SCT|WLS|NIR)$/ : /^[A-Z]{2}$/;
    const visited = new Set(normalizeCodes(config.visited || [], codePattern));
    const upcoming = new Set(config.showUpcoming ? (config.upcoming || []).map((code) => code.toUpperCase()) : []);
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const count = section.querySelector("[data-map-count]");
    const status = section.querySelector("[data-map-status]");
    const controls = regional ? section : section.querySelector("[data-world-overview]") || section;
    const picker = controls.querySelector("[data-map-picker]");
    const list = section.querySelector("[data-visited-list]");
    const ukList = section.querySelector("[data-uk-country-list]");
    const moveButton = controls.querySelector("[data-move-map]");
    const host = section.querySelector(".travel-map");
    const globeHost = regional ? null : controls.querySelector("#travel-globe");
    const viewButtons = regional ? [] : [...controls.querySelectorAll("[data-world-view]")];
    let globe;
    let globePromise;
    let viewMode = "flat";
    const countLabel = section.querySelector("[data-map-count-label]");
    if (countLabel) countLabel.textContent = settings.uk ? "of 4 UK countries explored" : settings.states ? "States Explored" : "Destinations Explored";
    section.querySelectorAll("[data-upcoming-legend]").forEach((item) => { item.hidden = !config.showUpcoming; });
    let refreshMap;
    let placeName = (code) => {
      const name = regional ? config.names?.[code] || code : (code === "MO" ? "Macau" : names.of(code));
      const note = !regional && config.countryNotes?.[code];
      return note ? name + " (" + note + ")" : name;
    };
    function refreshSummary() {
      count.textContent = visited.size;
      list.textContent = visited.size ? [...visited].map(placeName).sort().join(", ") :
        (config.emptyMessage || (settings.states ? "No U.S. states selected yet." : "No destinations selected yet."));
      if (ukList) {
        ukList.replaceChildren(...Object.entries(config.names || {}).map(([code, name]) => {
          const item = document.createElement("li");
          item.textContent = name + " — " + (visited.has(code) ? "Visited" : "Not yet recorded");
          return item;
        }));
      }
    }
    function updateVisited(codes) {
      const next = normalizeCodes(codes, codePattern);
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
        const [, geography, catalog, antarctica] = await Promise.all([
          library ||= Promise.all([
            loadAsset("link", "vendor/leaflet/leaflet-1.9.4.css"),
            loadAsset("script", "vendor/leaflet/leaflet-1.9.4.js")
          ]),
          fetch(new URL("vendor/leaflet/" + settings.geography, assets), { cache: "no-cache" }).then((response) => {
            if (!response.ok) throw new Error("Country boundaries could not load");
            return response.json();
          }),
          regional ? Promise.resolve(null) : fetch(new URL("vendor/leaflet/iso-codes.json", assets)).then((response) => {
            if (!response.ok) throw new Error("Country names could not load");
            return response.json();
          }),
          regional ? Promise.resolve(null) : fetch(new URL("vendor/leaflet/antarctica-polar.json", assets)).then((response) => {
            if (!response.ok) throw new Error("Antarctica could not load");
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
        if (regional) placeName = (code) => stateNames.get(code) || code;
        const countryCodes = catalog || [...stateNames.keys()];
        const countryName = (feature) => feature.properties.code ? placeName(feature.properties.code) : feature.properties.name;
        refreshSummary();
        const visitLabel = (code) => visited.has(code) ? "Visited" : settings.uk ? "Not yet recorded" : "Not yet visited";
        const description = (code, name) => name + " — " + visitLabel(code) + (upcoming.has(code) ? " · Upcoming" : "");
        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const homeBounds = settings.uk ? L.geoJSON(geography).getBounds() : L.latLngBounds(settings.states ? [[-610, 0], [0, 975]] : [[-60, -180], [85, 180]]);
        const idleStatus = "Hover or tap a " + (settings.states ? "state" : "country") + " to explore.";
        // Keep the familiar world proportions. Antarctica is shown separately
        // in a compact polar inset, leaving the main view focused on travel.
        const map = L.map(host, {
          crs: settings.uk ? L.CRS.EPSG3857 : settings.states ? L.CRS.Simple : L.CRS.EPSG4326,
          zoomSnap: 0, zoomDelta: 0.75, minZoom: -5, maxZoom: settings.uk ? 12 : settings.states ? 4 : 8,
          scrollWheelZoom: true, wheelPxPerZoomLevel: 90,
          doubleClickZoom: false, touchZoom: false, boxZoom: false,
          dragging: true, keyboard: true, zoomAnimation: !reducedMotion,
          fadeAnimation: !reducedMotion, inertia: false, attributionControl: false,
          maxBounds: regional ? homeBounds.pad(0.15) : [[-105, -200], [105, 200]], maxBoundsViscosity: 1
        });
        map.zoomControl.setPosition("bottomleft");
        let moving = false;
        // Use Leaflet's own mouse drag handler. Touch keeps normal page scrolling
        // unless the visitor explicitly enables the friends' Move map control.
        // Capture runs before Leaflet handles the same press, including on laptops
        // with both a touchscreen and a mouse. Keep its drag/click tolerance intact.
        function allowDragging(isMouse) {
          if (isMouse || moving) map.dragging.enable();
          else map.dragging.disable();
        }
        host.addEventListener("pointerenter", (event) => allowDragging(event.pointerType === "mouse"));
        host.addEventListener("pointerdown", (event) => allowDragging(event.pointerType === "mouse"), { capture: true, passive: true });
        host.addEventListener("touchstart", () => allowDragging(false), { capture: true, passive: true });
        host.addEventListener("mousedown", () => allowDragging(true), { capture: true, passive: true });
        host.setAttribute("aria-label", (settings.uk ? "UK constituent country travel map" : settings.states ? "U.S. state travel map" : "World travel map") + ". Left-click and drag to pan. Use the mouse wheel or the bottom-left plus and minus buttons to zoom; arrow keys pan. " + (picker ? "Use the selector for a text alternative." : "Explored places are listed below."));
        const layers = new Map();
        let selectedCode;
        let antarcticaInset;
        const baseStyle = (feature) => {
          const code = feature.properties.code;
          const wasVisited = visited.has(code);
          const isUpcoming = upcoming.has(code);
          // U.S. visits keep the normal border, including on upcoming returns.
          const returning = wasVisited && isUpcoming && code !== "US";
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
          detail.textContent = visitLabel(code);
          content.append(title, detail);
          if (upcoming.has(code)) {
            const note = document.createElement("span");
            note.textContent = "Upcoming";
            content.append(note);
          }
          if (!regional && breakouts.has(code)) {
            const hint = document.createElement("span");
            hint.textContent = breakouts.get(code).hint + " →";
            content.append(hint);
          }
          return content;
        }
        function placeTooltip(tooltip) {
          if (!tooltip?.isOpen()) return;
          const anchor = map.latLngToContainerPoint(tooltip.getLatLng());
          // Long details need room below countries near the map's top edge.
          const direction = anchor.y >= tooltip.getElement().offsetHeight + 12 ? "top" : "bottom";
          if (tooltip.options.direction !== direction) {
            tooltip.options.direction = direction;
            tooltip.update();
          }
        }
        function refreshLayer(feature, layer) {
          const code = feature.properties.code;
          const name = countryName(feature);
          layer.setStyle(baseStyle(feature));
          layer.setTooltipContent(tooltipContent(code, name));
          const element = layer.getElement();
          if (!element) return;
          element.setAttribute("aria-label", description(code, name) + (!regional && breakouts.has(code) ? ". " + breakouts.get(code).hint : ""));
          element.classList.toggle("is-visited", visited.has(code));
          element.classList.toggle("is-upcoming", upcoming.has(code));
        }
        const countries = L.geoJSON(geography, {
          style: baseStyle,
          filter: regional ? undefined : (feature) => feature.properties.code !== "AQ",
          coordsToLatLng: settings.states ? (coords) => L.latLng(-coords[1], coords[0]) : undefined,
          onEachFeature(feature, layer) {
            const code = feature.properties.code;
            const name = countryName(feature);
            if (code) layers.set(code, layer);
            layer.bindTooltip(tooltipContent(code, name), { sticky: true, direction: "top", className: "world-tooltip", opacity: 1 });
            layer.on({
              mouseover() { layer.setStyle({ fillOpacity: 0.8, weight: 1.8 }); },
              mouseout() { layer.setStyle(baseStyle(feature)); },
              tooltipopen(event) { placeTooltip(event.tooltip); },
              mousemove() { placeTooltip(layer.getTooltip()); },
              click(event) {
                antarcticaInset?.close();
                if (!regional && breakouts.has(code)) {
                  layer.closeTooltip();
                  openBreakout(code, layer.getElement());
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
              if (settings.uk) {
                element.setAttribute("role", "button");
                element.setAttribute("tabindex", "0");
                element.addEventListener("keydown", (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    selectedCode = code;
                    status.textContent = description(code, name);
                    layer.openTooltip(layer.getBounds().getCenter());
                  }
                });
              }
              if (!regional && breakouts.has(code)) {
                const breakout = breakouts.get(code);
                breakout.trigger = element;
                element.setAttribute("role", "button");
                element.setAttribute("tabindex", "0");
                element.setAttribute("aria-controls", breakout.section.id);
                element.setAttribute("aria-expanded", String(!breakout.section.hidden));
                element.addEventListener("keydown", (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    layer.closeTooltip();
                    openBreakout(code, element);
                  }
                });
              }
            });
          }
        }).addTo(map);

        if (!regional) {
          const inset = document.createElement("aside");
          inset.className = "antarctica-inset";
          inset.setAttribute("aria-label", "Antarctica inset");
          const insetHost = document.createElement("div");
          insetHost.className = "antarctica-map";
          insetHost.id = "antarctica-map";
          insetHost.setAttribute("role", "button");
          insetHost.setAttribute("tabindex", "0");
          const caption = document.createElement("div");
          caption.className = "antarctica-caption";
          const title = document.createElement("h3");
          title.textContent = "Antarctica";
          const detail = document.createElement("p");
          caption.append(title, detail);
          inset.append(insetHost, caption);
          section.querySelector(".world-frame").append(inset);
          const insetBounds = L.latLngBounds([[-antarctica.viewport[1], 0], [0, antarctica.viewport[0]]]);
          const insetMap = L.map(insetHost, {
            crs: L.CRS.Simple, zoomControl: false, attributionControl: false,
            dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
            touchZoom: false, keyboard: false, boxZoom: false, zoomSnap: 0,
            minZoom: -5, maxZoom: 4
          });
          let insetLayer;
          L.geoJSON(antarctica, {
            coordsToLatLng: (coords) => L.latLng(-coords[1], coords[0]),
            style: baseStyle,
            onEachFeature(feature, layer) {
              insetLayer = layer;
              layer.bindTooltip(tooltipContent("AQ", "Antarctica"), { direction: "right", className: "world-tooltip", opacity: 1 });
              layer.on({
                mouseover() { layer.setStyle({ fillOpacity: .8 }); },
                mouseout() { layer.setStyle(baseStyle(feature)); }
              });
            }
          }).addTo(insetMap);
          function fitInset() { insetMap.fitBounds(insetBounds, { padding: [3, 3], animate: false }); }
          function openInset(focus = false) {
            selectedCode = "AQ";
            status.textContent = description("AQ", "Antarctica");
            fitInset();
            insetLayer.openTooltip(insetLayer.getBounds().getCenter());
            if (focus) insetHost.focus({ preventScroll: true });
          }
          insetHost.addEventListener("click", () => openInset());
          insetHost.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openInset(); }
          });
          antarcticaInset = {
            open: openInset,
            close() { insetLayer.closeTooltip(); },
            refresh() {
              refreshLayer(insetLayer.feature, insetLayer);
              const label = description("AQ", "Antarctica");
              insetHost.setAttribute("aria-label", label + ". Show details");
              detail.textContent = label.replace("Antarctica — ", "");
            }
          };
          fitInset();
          antarcticaInset.refresh();
          new ResizeObserver(() => {
            if (!insetHost.clientWidth || !insetHost.clientHeight) return;
            insetMap.invalidateSize({ pan: false });
            fitInset();
          }).observe(insetHost);
        }

        refreshMap = () => {
          countries.eachLayer((layer) => refreshLayer(layer.feature, layer));
          antarcticaInset?.refresh();
          globe?.refresh();
          if (selectedCode) status.textContent = description(selectedCode, placeName(selectedCode));
        };

        function reset() {
          if (picker) picker.value = "";
          selectedCode = undefined;
          status.textContent = idleStatus;
          map.setMinZoom(-5);
          map.fitBounds(homeBounds, { padding: [12, 12], animate: false });
          map.setMinZoom(map.getZoom());
          countries.eachLayer((layer) => layer.closeTooltip());
          antarcticaInset?.close();
        }
        reset();
        if (globeHost && viewButtons.length) {
          const frame = host.closest(".world-frame");
          const globeButton = viewButtons.find((button) => button.dataset.worldView === "globe");
          const errorNote = document.createElement("p");
          errorNote.className = "world-help";
          errorNote.setAttribute("role", "status");
          errorNote.hidden = true;
          frame.before(errorNote);
          async function setView(mode) {
            viewMode = mode;
            errorNote.hidden = true;
            host.hidden = mode === "globe";
            globeHost.hidden = mode !== "globe";
            frame.classList.toggle("is-globe", mode === "globe");
            viewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.worldView === mode)));
            countries.eachLayer((layer) => layer.closeTooltip());
            antarcticaInset?.close();
            if (mode === "flat") {
              globe?.setActive(false);
              map.invalidateSize({ pan: false });
              status.textContent = idleStatus;
              return;
            }
            globeButton.disabled = true;
            globeHost.setAttribute("aria-busy", "true");
            status.textContent = "Loading the globe…";
            if (!globePromise) {
              globeHost.textContent = "Loading the globe…";
              // The extra projection library and spherical-ready boundaries load
              // only after Globe is selected. The regular flat map stays light.
              globePromise = fetch(new URL("vendor/leaflet/countries-globe.geo.json", assets), { cache: "no-cache" })
                .then((response) => {
                  if (!response.ok) throw new Error("Globe boundaries could not load");
                  return response.json();
                })
                .then((globeGeography) => window.RustinGlobe.create({
                  host: globeHost,
                  geography: globeGeography,
                  getStyle: baseStyle,
                  getName: countryName,
                  getDescription: (feature) => {
                    const code = feature.properties.code;
                    return description(code, countryName(feature)) + (breakouts.has(code) ? ". " + breakouts.get(code).hint : "");
                  },
                  getTooltip: (feature) => tooltipContent(feature.properties.code, countryName(feature)),
                  onSelect(feature, opener) {
                    const code = feature.properties.code;
                    selectedCode = code;
                    status.textContent = description(code, countryName(feature));
                    if (breakouts.has(code)) {
                      opener.setAttribute("aria-controls", breakouts.get(code).section.id);
                      openBreakout(code, opener);
                      globe?.closeTooltip();
                    }
                  },
                  onStatus: (message) => { status.textContent = message; },
                  reducedMotion,
                  allowTouchToggle: !moveButton
                }));
            }
            try {
              globe = await globePromise;
              globe.setActive(viewMode === "globe");
              if (viewMode === "globe") {
                globe.setTouchEnabled(moving);
                globe.resize();
                status.textContent = "Drag to rotate the globe. Use the mouse wheel or the + and − buttons to zoom. Arrow keys rotate; Home restores the full globe.";
              }
            } catch (error) {
              globePromise = undefined;
              globeHost.replaceChildren();
              await setView("flat");
              errorNote.textContent = "The globe couldn’t load. You can still use the flat map, or try Globe again.";
              errorNote.hidden = false;
              console.error("Travel globe could not load:", error);
            } finally {
              globeHost.removeAttribute("aria-busy");
              globeButton.disabled = false;
            }
          }
          viewButtons.forEach((button) => {
            button.disabled = false;
            button.addEventListener("click", () => setView(button.dataset.worldView));
          });
        }
        const resetButton = controls.querySelector("[data-reset-map]");
        if (resetButton) {
          resetButton.hidden = false;
          resetButton.addEventListener("click", () => viewMode === "globe" ? globe?.reset() : reset());
        }
        if (moveButton) {
          moveButton.hidden = false;
          moveButton.addEventListener("click", () => {
            moving = !moving;
            moveButton.setAttribute("aria-pressed", String(moving));
            moveButton.textContent = moving ? "Done moving map" : "Move map";
            host.classList.toggle("is-moving", moving);
            globe?.setTouchEnabled(moving);
            if (moving) { map.dragging.enable(); map.touchZoom.enable(); }
            else { map.dragging.disable(); map.touchZoom.disable(); }
          });
        }
        section.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            countries.eachLayer((layer) => layer.closeTooltip());
            antarcticaInset?.close();
            globe?.closeTooltip();
            if (moving) moveButton.click();
          }
        });
        if (picker) {
          countryCodes.sort((a, b) => placeName(a).localeCompare(placeName(b))).forEach((code) => picker.add(new Option(placeName(code), code)));
          picker.disabled = false;
          picker.addEventListener("change", () => {
            countries.eachLayer((layer) => layer.closeTooltip());
            antarcticaInset?.close();
            if (!picker.value) {
              if (viewMode === "globe") globe?.reset();
              else reset();
              status.textContent = idleStatus;
              return;
            }
            const code = picker.value;
            selectedCode = code;
            status.textContent = description(code, placeName(code));
            if (!regional && breakouts.has(code)) { openBreakout(code, picker); return; }
            if (viewMode === "globe") { globe?.focusCountry(code); return; }
            if (!regional && code === "AQ") { antarcticaInset.open(true); return; }
            const layer = layers.get(code);
            if (layer) {
              map.fitBounds(layer.getBounds(), { padding: [35, 35], maxZoom: settings.states ? 2 : 6, animate: false });
              layer.openTooltip(layer.getBounds().getCenter());
            }
          });
        }
        let lastWidth = host.clientWidth;
        let lastHeight = host.clientHeight;
        new ResizeObserver(() => {
          if (!host.clientWidth || !host.clientHeight) return;
          map.invalidateSize({ pan: false });
          if (host.clientWidth === lastWidth && host.clientHeight === lastHeight) return;
          lastWidth = host.clientWidth;
          lastHeight = host.clientHeight;
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
  mountMap(document.querySelector("#united-kingdom"), { config: window.RUSTIN_UK, uk: true, geography: "uk-countries.geo.json" });
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
