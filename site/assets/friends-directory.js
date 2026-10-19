(function () {
  const grid = document.querySelector("[data-friend-maps]");
  if (!grid) return;
  const more = document.querySelector("[data-friend-more]");
  let page = 0;
  let loading = false;
  function message(text) {
    const paragraph = document.createElement("p");
    paragraph.className = "friend-empty";
    paragraph.textContent = text;
    grid.replaceChildren(paragraph);
  }
  async function load() {
    if (loading) return;
    loading = true;
    if (more) more.disabled = true;
    try {
      const response = await fetch("/api/maps.php?action=list&page=" + page, { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.maps)) throw new Error("Directory unavailable");
      if (page === 0) grid.replaceChildren();
      for (const map of data.maps) {
        if (!/^[a-f0-9]{24}$/.test(map.id)) continue;
        const link = document.createElement("a");
        link.className = "friend-map-card";
        link.href = "/maps/?id=" + encodeURIComponent(map.id);
        link.setAttribute("aria-label", "View " + map.name + "’s travel map");
        const name = document.createElement("h3");
        name.textContent = map.name;
        const statistics = document.createElement("p");
        const destinations = document.createElement("strong");
        const destinationCount = new Set(map.countries).size;
        destinations.textContent = destinationCount + (destinationCount === 1 ? " destination" : " destinations");
        const states = document.createElement("strong");
        const stateCount = new Set(map.states).size;
        states.textContent = stateCount + (stateCount === 1 ? " state" : " states");
        statistics.append(destinations, document.createTextNode(" · "), states);
        const action = document.createElement("span");
        action.className = "friend-map-action";
        action.textContent = "Explore map ↗";
        link.append(name, statistics, action);
        grid.appendChild(link);
      }
      if (!grid.children.length) message("Your next adventure could start this collection. Be the first to share a map.");
      if (more) more.hidden = !data.hasMore;
      page = data.nextPage ?? page + 1;
    } catch {
      if (page === 0) message("Friends’ maps will appear here once they’re shared. Create your own map to join them.");
      if (more) more.hidden = true;
    } finally {
      loading = false;
      if (more) more.disabled = false;
    }
  }
  more?.addEventListener("click", load);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: "300px" });
    observer.observe(grid);
  } else load();
})();
