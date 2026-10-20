(function () {
  const continents = ["North America", "South America", "Europe", "Africa", "Asia", "Oceania", "Antarctica"];

  // One ISO destination belongs to one group, so the continent totals add up.
  // This uses the same visited list as the map; plans and state visits stay out.
  function summarize(codes, regions = window.RUSTIN_REGIONS) {
    if (!Array.isArray(codes)) throw new TypeError("Visited destinations must be a list.");
    const visited = [...new Set(codes.map((code) => String(code).trim().toUpperCase()))];
    const groups = continents.map((name) => ({ name, codes: [] }));
    let unMembers = 0;
    for (const code of visited) {
      const region = regions?.[code];
      const group = groups.find((entry) => entry.name === region?.continent);
      if (!group || typeof region.unMember !== "boolean") throw new Error("Missing travel classification for " + code);
      group.codes.push(code);
      if (region.unMember) unMembers++;
    }
    return {
      destinations: visited.length,
      unMembers,
      otherDestinations: visited.length - unMembers,
      continents: groups.filter((group) => group.codes.length).length,
      groups
    };
  }
  window.RustinTravelStats = Object.freeze({ summarize });

  const section = document.querySelector("[data-travel-breakdown]");
  if (!section) return;
  const config = window.RUSTIN_TRAVEL || {};
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const placeName = (code) => {
    const name = code === "MO" ? "Macau" : names.of(code);
    return config.countryNotes?.[code] ? name + " (" + config.countryNotes[code] + ")" : name;
  };
  const upcoming = new Set(config.showUpcoming ? (config.upcoming || []).map((code) => code.toUpperCase()) : []);
  const list = section.querySelector("[data-travel-continent-list]");

  function render(codes) {
    try {
      const stats = summarize(codes);
      const openGroups = new Set([...list.querySelectorAll("details[open]")].map((detail) => detail.dataset.continent));
      section.querySelector("[data-travel-un-count]").textContent = stats.unMembers;
      section.querySelector("[data-travel-other-count]").textContent = stats.otherDestinations;
      section.querySelector("[data-travel-continent-count]").textContent = stats.continents;
      const fragment = document.createDocumentFragment();
      for (const group of stats.groups) {
        const details = document.createElement("details");
        details.className = "travel-continent";
        details.dataset.continent = group.name;
        details.open = openGroups.has(group.name);
        const summary = document.createElement("summary");
        const title = document.createElement("span");
        title.textContent = group.name;
        const count = document.createElement("span");
        count.className = "travel-continent-count";
        count.textContent = group.codes.length + (group.codes.length === 1 ? " destination" : " destinations");
        summary.append(title, count);
        details.append(summary);
        if (group.codes.length) {
          const places = document.createElement("ul");
          places.className = "travel-continent-places";
          for (const code of group.codes.sort((a, b) => placeName(a).localeCompare(placeName(b)))) {
            const item = document.createElement("li");
            item.textContent = placeName(code);
            if (!window.RUSTIN_REGIONS[code].unMember) {
              const kind = document.createElement("span");
              kind.className = "travel-place-kind";
              kind.textContent = "Other destination";
              item.append(kind);
            }
            places.append(item);
          }
          details.append(places);
        } else {
          const empty = document.createElement("p");
          empty.className = "travel-continent-empty";
          const plans = [...upcoming].filter((code) => window.RUSTIN_REGIONS[code]?.continent === group.name).map(placeName).sort();
          empty.textContent = "No visited destinations yet." + (plans.length ? " Upcoming: " + plans.join(", ") + "." : "");
          details.append(empty);
        }
        fragment.append(details);
      }
      list.replaceChildren(fragment);
    } catch (error) {
      list.textContent = "The continent breakdown couldn’t load. Your explored destinations are listed below.";
      console.error("Travel breakdown could not load:", error);
    }
  }
  render(config.visited || []);
  window.addEventListener("rustinmaps:updated", (event) => {
    if (Array.isArray(event.detail?.countries)) render(event.detail.countries);
  });
})();
