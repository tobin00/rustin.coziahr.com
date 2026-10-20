(function () {
  "use strict";
  const assets = new URL(".", document.currentScript.src);
  let library;
  let instance = 0;

  function loadLibrary() {
    if (window.RustinGlobeD3) return Promise.resolve(window.RustinGlobeD3);
    if (!library) {
      library = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("vendor/d3/d3-globe.min.js", assets);
        script.onload = () => window.RustinGlobeD3 ? resolve(window.RustinGlobeD3) : reject(new Error("The globe library did not initialize."));
        script.onerror = () => reject(new Error("The globe library could not load."));
        document.head.appendChild(script);
      }).catch((error) => { library = undefined; throw error; });
    }
    return library;
  }

  async function create(options) {
    const { host, geography } = options;
    if (!host || !Array.isArray(geography?.features)) throw new TypeError("The globe needs a container and country boundaries.");
    const d3 = await loadLibrary();
    const features = geography.features;
    const palette = getComputedStyle(host);
    const color = (name) => palette.getPropertyValue(name).trim();
    const initialRotation = [35, -20, 0];
    const projection = d3.geoOrthographic().rotate(initialRotation).clipAngle(90).precision(0.45);
    const path = d3.geoPath(projection);
    const sphere = { type: "Sphere" };
    const graticule = d3.geoGraticule10();
    let active = true;
    let touchEnabled = false;
    let width = 0;
    let height = 0;
    let baseRadius = 1;
    let scale = 1;
    let frame;
    let selected;
    let touchModeButton;

    host.replaceChildren();
    host.classList.add("travel-globe");
    host.classList.toggle("is-reduced-motion", Boolean(options.reducedMotion));
    const svg = d3.select(host).append("svg")
      .attr("class", "travel-globe-svg")
      .attr("role", "group")
      .attr("tabindex", "0")
      .attr("aria-label", "Interactive world globe. Drag with the mouse or use arrow keys to rotate. Use the mouse wheel, plus and minus keys, or bottom-left buttons to zoom. Home resets the view. Country details are available by keyboard and in the text list below.");
    const ocean = svg.append("path").attr("class", "globe-ocean").attr("aria-hidden", "true");
    const grid = svg.append("path").attr("class", "globe-graticule").attr("aria-hidden", "true");
    const countries = svg.append("g").attr("class", "globe-countries").selectAll("path")
      .data(features).join("path")
      .attr("class", "globe-country")
      .attr("role", "button")
      .attr("data-country-code", (feature) => feature.properties.code || "")
      .attr("aria-label", (feature) => options.getDescription(feature));
    const tooltip = document.createElement("div");
    tooltip.className = "globe-tooltip";
    tooltip.id = "travel-globe-tooltip-" + (++instance);
    tooltip.role = "tooltip";
    tooltip.hidden = true;
    host.appendChild(tooltip);
    const controls = document.createElement("div");
    controls.className = "globe-zoom-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Globe zoom controls");
    host.appendChild(controls);

    function closeTooltip() {
      tooltip.hidden = true;
      selected?.removeAttribute("aria-describedby");
      selected = undefined;
    }

    function positionTooltip(event, element) {
      const bounds = host.getBoundingClientRect();
      const shape = element?.getBoundingClientRect();
      const x = Number.isFinite(event?.clientX) ? event.clientX - bounds.left : shape ? (shape.left + shape.right) / 2 - bounds.left : width / 2;
      const y = Number.isFinite(event?.clientY) ? event.clientY - bounds.top : shape ? shape.top - bounds.top : height / 2;
      const left = Math.max(8, Math.min(width - tooltip.offsetWidth - 8, x - tooltip.offsetWidth / 2));
      const top = Math.max(8, Math.min(height - tooltip.offsetHeight - 8, y - tooltip.offsetHeight - 14));
      tooltip.style.left = left + "px";
      tooltip.style.top = top + "px";
    }

    function showTooltip(feature, element, event) {
      if (!active) return;
      closeTooltip();
      const content = options.getTooltip(feature);
      tooltip.replaceChildren(content);
      tooltip.hidden = false;
      selected = element;
      element.setAttribute("aria-describedby", tooltip.id);
      positionTooltip(event, element);
      options.onStatus?.(options.getDescription(feature));
    }

    function paint() {
      if (!active || !width || !height || host.hidden || !host.clientWidth || !host.clientHeight) return;
      projection.scale(baseRadius * scale).translate([width / 2, height / 2]);
      ocean.attr("d", path(sphere)).attr("fill", color("--world-ocean")).attr("stroke", color("--world-border"));
      grid.attr("d", path(graticule)).attr("stroke", color("--world-border"));
      countries.each(function (feature) {
        const shape = path(feature);
        const visible = Boolean(shape);
        this.setAttribute("d", shape || "");
        this.setAttribute("tabindex", visible ? "0" : "-1");
        if (!visible && document.activeElement === this) svg.node().focus({ preventScroll: true });
        this.setAttribute("aria-hidden", String(!visible));
        const style = options.getStyle(feature);
        this.setAttribute("fill", style.fillColor);
        this.setAttribute("fill-opacity", style.fillOpacity ?? 1);
        this.setAttribute("stroke", style.color);
        this.setAttribute("stroke-width", style.weight ?? 0.65);
        this.setAttribute("aria-label", options.getDescription(feature));
        if (!visible && this === selected) closeTooltip();
      });
      controls.querySelector("[data-globe-zoom-out]").disabled = scale <= 0.8501;
      controls.querySelector("[data-globe-zoom-in]").disabled = scale >= 4.9999;
    }

    function schedulePaint() {
      if (!active || frame || host.hidden || !host.clientWidth || !host.clientHeight) return;
      frame = requestAnimationFrame(() => { frame = undefined; paint(); });
    }

    function resize() {
      if (!active || host.hidden) return;
      const nextWidth = host.clientWidth;
      const nextHeight = host.clientHeight;
      if (!nextWidth || !nextHeight) return;
      width = nextWidth;
      height = nextHeight;
      baseRadius = Math.max(1, Math.min(width, height) / 2 - (width < 600 ? 18 : 28));
      svg.attr("viewBox", "0 0 " + width + " " + height);
      closeTooltip();
      schedulePaint();
    }

    const zoom = d3.zoom().scaleExtent([0.85, 5])
      .extent(() => [[0, 0], [width || 1, height || 1]])
      .touchable(() => touchEnabled)
      .filter((event) => active && (event.type === "wheel" || (touchEnabled && event.type.startsWith("touch") && event.touches?.length >= 2)))
      .on("zoom", (event) => {
        if (!active) return;
        scale = event.transform.k;
        closeTooltip();
        schedulePaint();
      });
    const drag = d3.drag().clickDistance(5).touchable(() => touchEnabled)
      .filter((event) => active && !event.ctrlKey && (event.type === "mousedown" ? event.button === 0 : touchEnabled && event.touches?.length === 1))
      .on("start", () => { host.classList.add("is-globe-dragging"); closeTooltip(); })
      .on("drag", (event) => {
        if (!active || event.sourceEvent.touches?.length > 1) return;
        const rotation = projection.rotate();
        const degrees = 180 / (Math.PI * baseRadius * scale);
        projection.rotate([rotation[0] + event.dx * degrees, Math.max(-80, Math.min(80, rotation[1] - event.dy * degrees)), 0]);
        schedulePaint();
      })
      .on("end", () => host.classList.remove("is-globe-dragging"));

    function bindGestures() {
      svg.on(".drag", null).on(".zoom", null);
      svg.call(zoom).call(drag);
      svg.style("touch-action", touchEnabled ? "none" : "pan-y pinch-zoom");
    }
    function setTouchEnabled(enabled) {
      touchEnabled = Boolean(enabled);
      host.classList.toggle("is-touch-enabled", touchEnabled);
      if (touchModeButton) {
        touchModeButton.textContent = touchEnabled ? "Done rotating" : "Rotate globe";
        touchModeButton.setAttribute("aria-pressed", String(touchEnabled));
      }
      bindGestures();
    }
    function changeScale(next) {
      if (!active) return;
      svg.call(zoom.scaleTo, Math.max(0.85, Math.min(5, next)));
    }
    function reset() {
      closeTooltip();
      projection.rotate(initialRotation);
      svg.call(zoom.transform, d3.zoomIdentity);
      schedulePaint();
    }
    function rotate(dx, dy) {
      const rotation = projection.rotate();
      projection.rotate([rotation[0] + dx, Math.max(-80, Math.min(80, rotation[1] + dy)), 0]);
      closeTooltip();
      schedulePaint();
    }

    const zoomIn = document.createElement("button");
    zoomIn.type = "button";
    zoomIn.textContent = "+";
    zoomIn.setAttribute("aria-label", "Zoom in on globe");
    zoomIn.setAttribute("data-globe-zoom-in", "");
    zoomIn.addEventListener("click", () => changeScale(scale * 1.4));
    const zoomOut = document.createElement("button");
    zoomOut.type = "button";
    zoomOut.textContent = "−";
    zoomOut.setAttribute("aria-label", "Zoom out on globe");
    zoomOut.setAttribute("data-globe-zoom-out", "");
    zoomOut.addEventListener("click", () => changeScale(scale / 1.4));
    controls.append(zoomIn, zoomOut);
    if (options.allowTouchToggle) {
      touchModeButton = document.createElement("button");
      touchModeButton.type = "button";
      touchModeButton.className = "globe-touch-toggle";
      touchModeButton.textContent = "Rotate globe";
      touchModeButton.setAttribute("aria-pressed", "false");
      touchModeButton.addEventListener("click", () => {
        setTouchEnabled(!touchEnabled);
        options.onStatus?.(touchEnabled ? "Touch rotation enabled. Drag to rotate, or pinch to zoom. Choose Done rotating to scroll the page." : "Touch rotation off. Swipes scroll the page.");
      });
      host.appendChild(touchModeButton);
      host.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !touchEnabled) return;
        setTouchEnabled(false);
        closeTooltip();
        event.preventDefault();
        event.stopPropagation();
        touchModeButton.focus({ preventScroll: true });
      }, { capture: true });
    }

    countries
      .on("pointerenter", function (event, feature) {
        if (event.pointerType !== "touch" && !host.classList.contains("is-globe-dragging")) showTooltip(feature, this, event);
      })
      .on("pointermove", function (event) { if (selected === this && !tooltip.hidden) positionTooltip(event, this); })
      .on("pointerleave", function () { if (selected === this && document.activeElement !== this) closeTooltip(); })
      .on("focus", function (event, feature) { showTooltip(feature, this); })
      .on("blur", closeTooltip)
      .on("click", function (event, feature) {
        if (!active || event.defaultPrevented) return;
        showTooltip(feature, this, event);
        options.onSelect?.(feature, this);
      })
      .on("keydown", function (event, feature) {
        if (!active) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          showTooltip(feature, this);
          options.onSelect?.(feature, this);
        }
      });
    svg.on("keydown.globe", (event) => {
      if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
      const amount = event.shiftKey ? 20 : 8;
      switch (event.key) {
        case "ArrowLeft": rotate(-amount, 0); break;
        case "ArrowRight": rotate(amount, 0); break;
        case "ArrowUp": rotate(0, -amount); break;
        case "ArrowDown": rotate(0, amount); break;
        case "+": case "=": changeScale(scale * 1.4); break;
        case "-": case "−": changeScale(scale / 1.4); break;
        case "Home": reset(); break;
        // The parent map also uses Escape to leave friends' touch-move mode.
        case "Escape": closeTooltip(); return;
        default: return;
      }
      event.preventDefault();
      event.stopPropagation();
    });
    svg.on("click.globe", (event) => { if (event.target === ocean.node() || event.target === svg.node()) closeTooltip(); });
    bindGestures();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return Object.freeze({
      resize,
      reset,
      refresh() { if (active) { closeTooltip(); schedulePaint(); } },
      focusCountry(code) {
        if (!active) return false;
        const feature = features.find((entry) => entry.properties.code === code);
        if (!feature) return false;
        if (!feature.geometry) {
          options.onStatus?.(options.getDescription(feature) + ". A separate shape is not available at this map scale.");
          return false;
        }
        const center = d3.geoCentroid(feature);
        projection.rotate([-center[0], Math.max(-80, Math.min(80, -center[1])), 0]);
        paint();
        const element = countries.filter((entry) => entry === feature).node();
        element.focus({ preventScroll: true });
        showTooltip(feature, element);
        return true;
      },
      setTouchEnabled,
      setActive(enabled) {
        active = Boolean(enabled);
        if (!active) {
          closeTooltip();
          host.classList.remove("is-globe-dragging");
          if (options.allowTouchToggle && touchEnabled) setTouchEnabled(false);
          if (frame) cancelAnimationFrame(frame);
          frame = undefined;
        } else resize();
      },
      closeTooltip
    });
  }

  window.RustinGlobe = Object.freeze({ create });
})();
