(function () {
  "use strict";
  const scriptAssets = new URL(".", document.currentScript.src);
  const ownerStorageKey = "rustin-map-owners-v1";
  const draftStorageKey = "rustin-map-draft-v1";
  const api = "/api/maps.php";
  const form = document.querySelector("#map-form");
  if (!form) return;
  const title = document.querySelector("[data-map-title]");
  const intro = document.querySelector("[data-map-intro]");
  const nameInput = document.querySelector("#map-name");
  const listedInput = document.querySelector("#map-listed");
  const websiteInput = document.querySelector("#map-website");
  const countryOptions = document.querySelector("#destination-options");
  const stateOptions = document.querySelector("#state-options");
  const saveButton = document.querySelector("[data-save-map]");
  const saveStatus = document.querySelector("[data-save-status]");
  const errorPanel = document.querySelector("[data-map-error]");
  const linksPanel = document.querySelector("[data-map-links]");
  const publicLink = document.querySelector("#public-map-link");
  const privateLink = document.querySelector("#private-map-link");
  const privateRow = document.querySelector("[data-private-link-row]");
  const deleteButton = document.querySelector("[data-delete-map]");
  const viewOnly = document.querySelector("[data-view-only]");
  const savingNote = document.querySelector("[data-saving-note]");
  const ownerPanel = document.querySelector("[data-owner-maps]");
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const nameOverrides = { HK: "Hong Kong", MO: "Macau", TW: "Taiwan", PR: "Puerto Rico" };
  const aliases = { GB: "uk britain great britain england scotland wales northern ireland", US: "usa america united states of america", AE: "uae emirates", MO: "macao", KR: "south korea", KP: "north korea" };
  const countries = new Set();
  const states = new Set();
  let validCountries = new Set();
  let validStates = new Set();
  let stateNames = new Map();
  let currentMap = null;
  let editingKey = null;
  let saving = false;
  let ready = false;
  let storageBlocked = false;
  let ownerRender = 0;
  let owners = readStorage(ownerStorageKey, {});
  if (!owners || typeof owners !== "object" || Array.isArray(owners)) owners = {};
  owners = Object.fromEntries(Object.entries(owners).filter(([id, key]) => validId(id) && validKey(key)));
  const url = new URL(window.location.href);
  let requestedId = url.searchParams.get("id");
  const secret = new URLSearchParams(url.hash.slice(1));
  const fragmentKey = secret.get("edit");
  // A private key belongs in a bookmark, never in a public URL or referrer.
  if (secret.has("edit")) {
    secret.delete("edit");
    url.hash = secret.toString();
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  if (validId(requestedId)) {
    editingKey = validKey(fragmentKey) ? fragmentKey : owners[requestedId] || null;
    if (editingKey && !owners[requestedId]) {
      owners[requestedId] = editingKey;
      writeStorage(ownerStorageKey, owners);
    }
  }

  function validId(id) { return typeof id === "string" && /^[a-f0-9]{24}$/.test(id); }
  function validKey(key) { return typeof key === "string" && /^[A-Za-z0-9_-]{24,160}$/.test(key); }
  function readStorage(key, fallback) {
    let value;
    try { value = localStorage.getItem(key); }
    catch (_) { storageBlocked = true; return fallback; }
    try { return value ? JSON.parse(value) : fallback; }
    catch (_) { return fallback; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { storageBlocked = true; return false; }
  }
  function removeStorage(key) {
    try { localStorage.removeItem(key); }
    catch (_) { storageBlocked = true; }
  }
  function storageWarning() {
    return storageBlocked ? " Browser storage is unavailable. Keep your private editing link to return from this or another device." : "";
  }
  function setStatus(message) { saveStatus.textContent = message; }
  function showError(message) { errorPanel.textContent = message; errorPanel.hidden = !message; }
  function displayName(code) { return nameOverrides[code] || names.of(code); }
  function normalized(value, valid) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((code) => typeof code === "string").map((code) => code.toUpperCase()).filter((code) => valid.has(code)))];
  }
  function body() {
    return { name: nameInput.value.trim(), countries: [...countries].sort(), states: [...states].sort(), listed: listedInput.checked };
  }
  function rememberDraft() {
    const stored = writeStorage(draftStorageKey, { id: currentMap?.id || null, ...body() });
    setStatus(stored ? "Changes saved on this browser. Choose Save map online to update the public map." : "You have unsaved changes. Browser storage is unavailable; keep this page open and save your map online.");
  }
  function updateTitle() {
    const name = nameInput.value.trim();
    title.textContent = name ? name + "’s travel map" : "Create your own map";
    document.title = (name ? name + "’s travel map" : "Create your own map") + " · Rustin";
  }
  function updateSelections() {
    countryOptions.querySelectorAll("input[type=checkbox]").forEach((input) => { input.checked = countries.has(input.value); });
    stateOptions.querySelectorAll("input[type=checkbox]").forEach((input) => { input.checked = states.has(input.value); });
    document.querySelector("[data-destination-selected]").textContent = countries.size + " selected";
    document.querySelector("[data-state-selected]").textContent = states.size + " of 50 selected";
    window.RustinMaps.updateVisited({ countries: [...countries], states: [...states] });
  }
  function replaceSelections(data) {
    countries.clear();
    states.clear();
    normalized(data.countries, validCountries).forEach((code) => countries.add(code));
    normalized(data.states, validStates).forEach((code) => states.add(code));
    if (states.size) countries.add("US");
    nameInput.value = typeof data.name === "string" ? data.name.slice(0, 60) : "";
    listedInput.checked = data.listed === true;
    updateTitle();
    updateSelections();
  }
  function setDisabled(disabled) {
    form.querySelectorAll("input, button").forEach((input) => { input.disabled = disabled; });
    saveButton.disabled = disabled;
  }
  function publicUrl(id) {
    const link = new URL("/maps/", location.origin);
    link.searchParams.set("id", id);
    return link.href;
  }
  function updateLinks() {
    linksPanel.hidden = !currentMap;
    const editable = !currentMap || Boolean(editingKey);
    privateRow.hidden = !currentMap || !editingKey;
    deleteButton.hidden = !currentMap || !editingKey;
    if (currentMap) {
      publicLink.value = publicUrl(currentMap.id);
      privateLink.value = editingKey ? publicUrl(currentMap.id) + "#edit=" + encodeURIComponent(editingKey) : "";
    } else {
      publicLink.value = "";
      privateLink.value = "";
    }
    form.hidden = !editable;
    viewOnly.hidden = editable;
    if (savingNote) savingNote.hidden = !editable;
    if (!editable) viewOnly.textContent = "This is a public, read-only map. Its owner can update it with their private editing link.";
    intro.textContent = editable ? "Choose the destinations and U.S. states you’ve explored. Save your map online, then share it with friends." : "A few places visited, and a whole world still to explore. Click the United States for the state breakdown.";
    saveButton.textContent = currentMap ? "Save changes online" : "Save map online";
  }
  async function request(path, options = {}) {
    let response;
    try { response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options }); }
    catch (_) { throw new Error("The map service couldn’t be reached. Your selections are still here; try saving again in a moment."); }
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error("The map service isn’t available right now. Your selections are still here; please try again later."); }
    if (!response.ok) {
      const error = new Error(typeof data.error === "string" ? data.error : "The map could not be saved. Please try again.");
      error.code = data.code;
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function createChoices(container, codes, getName, type) {
    const fragment = document.createDocumentFragment();
    codes.sort((a, b) => getName(a).localeCompare(getName(b))).forEach((code) => {
      const label = document.createElement("label");
      label.className = "map-choice";
      label.dataset.search = (getName(code) + " " + code + " " + (type === "countries" ? aliases[code] || "" : "")).toLocaleLowerCase();
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = type;
      input.value = code;
      const text = document.createElement("span");
      text.textContent = getName(code);
      label.append(input, text);
      fragment.append(label);
    });
    container.append(fragment);
    const empty = document.createElement("p");
    empty.className = "map-no-results";
    empty.textContent = "No matches. Try another name or a two-letter code.";
    empty.hidden = true;
    container.append(empty);
    return (query) => {
      const term = query.trim().toLocaleLowerCase();
      let matches = 0;
      container.querySelectorAll(".map-choice").forEach((label) => { label.hidden = !label.dataset.search.includes(term); if (!label.hidden) matches++; });
      empty.hidden = matches > 0;
    };
  }
  async function renderOwnerMaps() {
    if (!ownerPanel) return;
    const render = ++ownerRender;
    let list = ownerPanel.querySelector("[data-owner-map-list]");
    if (!list) { list = document.createElement("ul"); list.className = "map-owner-list"; list.dataset.ownerMapList = ""; ownerPanel.append(list); }
    list.replaceChildren();
    ownerPanel.hidden = false;
    const ids = Object.keys(owners);
    if (!ids.length) return;
    const rows = ids.map((id) => {
      const row = document.createElement("li");
      const link = document.createElement("a");
      link.href = publicUrl(id);
      link.textContent = "Open your saved map";
      row.append(link);
      list.append(row);
      return { id, row, link };
    });
    const results = await Promise.allSettled(rows.map(({ id }) => request(api + "?id=" + encodeURIComponent(id))));
    if (render !== ownerRender) return;
    results.forEach((result, index) => {
      const { id, link, row } = rows[index];
      if (result.status === "fulfilled" && result.value.map) {
        link.textContent = result.value.map.name + "’s map";
        if (id === currentMap?.id) link.setAttribute("aria-current", "page");
      } else if (result.status === "rejected" && result.reason.status === 404) {
        row.remove();
        delete owners[id];
        writeStorage(ownerStorageKey, owners);
      }
    });
  }
  function newMap(message) {
    if (saving) return;
    if (!ready) { location.href = "/maps/"; return; }
    currentMap = null;
    requestedId = null;
    editingKey = null;
    history.replaceState(null, "", "/maps/");
    removeStorage(draftStorageKey);
    replaceSelections({ name: "", countries: [], states: [], listed: false });
    updateLinks();
    setDisabled(false);
    showError("");
    setStatus(message || "Choose your destinations, then save your map online.");
    nameInput.focus();
  }
  async function copyLink(input) {
    if (!input.value) return;
    const linkStatus = document.querySelector("[data-link-status]");
    try {
      await navigator.clipboard.writeText(input.value);
      linkStatus.textContent = input === privateLink ? "Private editing link copied. Keep it for yourself; anyone with it can change this map." : "Public map link copied. Share this one with friends.";
    } catch (_) {
      input.focus();
      input.select();
      linkStatus.textContent = "The link is selected. Use your device’s Copy command to copy it.";
    }
  }

  // A bookmarked edit link can open on the same document without a reload.
  window.addEventListener("hashchange", () => {
    const incoming = new URL(location.href);
    const fragment = new URLSearchParams(incoming.hash.slice(1));
    const key = fragment.get("edit");
    if (!fragment.has("edit")) return;
    fragment.delete("edit");
    incoming.hash = fragment.toString();
    history.replaceState(null, "", incoming.pathname + incoming.search + incoming.hash);
    const id = incoming.searchParams.get("id");
    if (!validId(id) || !validKey(key) || id !== (currentMap?.id || requestedId)) return;
    editingKey = key;
    // Keep remembered access if a mistyped incoming key has not been verified.
    if (!owners[id]) {
      owners[id] = key;
      writeStorage(ownerStorageKey, owners);
    }
    if (currentMap) {
      updateLinks();
      setDisabled(false);
      renderOwnerMaps();
      setStatus("Your private link is open. Make your changes, then save them online." + storageWarning());
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ready || saving || (currentMap && !editingKey)) return;
    nameInput.setCustomValidity(nameInput.value.trim() ? "" : "Add your name so friends can recognize your map.");
    if (!form.reportValidity()) return;
    saving = true;
    setDisabled(true);
    form.setAttribute("aria-busy", "true");
    showError("");
    setStatus("Saving your map online…");
    const payload = { ...body(), website: websiteInput?.value || "" };
    if (currentMap) payload.version = currentMap.version;
    try {
      const result = await request(api + (currentMap ? "?id=" + encodeURIComponent(currentMap.id) : ""), {
        method: "POST", headers: { "Content-Type": "application/json", ...(editingKey ? { "X-Map-Edit-Key": editingKey } : {}) }, body: JSON.stringify(payload)
      });
      if (!result.map || !validId(result.map.id)) throw new Error("The save response was incomplete. Keep this page open and try again.");
      if (!currentMap && !validKey(result.editKey)) throw new Error("Your editing link could not be created. Keep this page open and try again.");
      currentMap = result.map;
      requestedId = currentMap.id;
      editingKey = result.editKey || editingKey;
      owners[currentMap.id] = editingKey;
      writeStorage(ownerStorageKey, owners);
      removeStorage(draftStorageKey);
      history.replaceState(null, "", "/maps/?id=" + encodeURIComponent(currentMap.id));
      replaceSelections(currentMap);
      updateLinks();
      setStatus("Saved online. Share the public link with friends, and bookmark your private editing link to update this map on another device." + storageWarning());
      renderOwnerMaps();
    } catch (error) {
      rememberDraft();
      const message = error.status === 409 ? "This map changed in another window or device. Refresh before saving again; your draft is kept on this browser." : error.message;
      showError(message);
      setStatus("Not saved online. Your current selections remain on this page." + storageWarning());
    } finally {
      saving = false;
      setDisabled(false);
      form.removeAttribute("aria-busy");
    }
  });
  nameInput.addEventListener("input", () => { nameInput.setCustomValidity(""); updateTitle(); rememberDraft(); });
  listedInput.addEventListener("change", rememberDraft);
  countryOptions.addEventListener("change", (event) => {
    const input = event.target;
    if (input.type !== "checkbox" || !validCountries.has(input.value)) return;
    if (input.checked) countries.add(input.value);
    else { countries.delete(input.value); if (input.value === "US") states.clear(); }
    updateSelections();
    rememberDraft();
  });
  stateOptions.addEventListener("change", (event) => {
    const input = event.target;
    if (input.type !== "checkbox" || !validStates.has(input.value)) return;
    if (input.checked) { states.add(input.value); countries.add("US"); }
    else states.delete(input.value);
    updateSelections();
    rememberDraft();
  });
  document.querySelector("[data-select-all-states]").addEventListener("click", () => { validStates.forEach((code) => states.add(code)); countries.add("US"); updateSelections(); rememberDraft(); });
  document.querySelector("[data-clear-states]").addEventListener("click", () => { states.clear(); updateSelections(); rememberDraft(); });
  document.querySelector("[data-clear-destinations]").addEventListener("click", () => { countries.clear(); states.clear(); updateSelections(); rememberDraft(); });
  document.querySelector("[data-copy-public]").addEventListener("click", () => copyLink(publicLink));
  document.querySelector("[data-copy-private]").addEventListener("click", () => copyLink(privateLink));
  document.querySelectorAll("[data-new-map]").forEach((button) => button.addEventListener("click", () => newMap()));
  deleteButton.addEventListener("click", async () => {
    if (!currentMap || !editingKey || saving || !window.confirm("Permanently delete this map and remove its public link? This cannot be undone.")) return;
    saving = true;
    deleteButton.disabled = true;
    showError("");
    setStatus("Deleting your map…");
    try {
      await request(api + "?id=" + encodeURIComponent(currentMap.id), { method: "DELETE", headers: { "X-Map-Edit-Key": editingKey } });
      delete owners[currentMap.id];
      writeStorage(ownerStorageKey, owners);
      saving = false;
      newMap("Your map was deleted. You can start a new one whenever you’re ready.");
      renderOwnerMaps();
    } catch (error) { showError(error.message); setStatus("The map was not deleted. Please try again."); }
    finally { saving = false; deleteButton.disabled = false; }
  });

  async function initialize() {
    setDisabled(true);
    if (requestedId) form.hidden = true;
    setStatus("Loading the destination lists…");
    try {
      if (requestedId && !validId(requestedId)) throw new Error("This map link isn’t valid. Use Create a new map to start your own.");
      const [codes, geography, result] = await Promise.all([
        fetch(new URL("vendor/leaflet/iso-codes.json", scriptAssets)).then((response) => { if (!response.ok) throw new Error("The destination list couldn’t load. Refresh to try again."); return response.json(); }),
        fetch(new URL("vendor/leaflet/us-states-albers.json", scriptAssets)).then((response) => { if (!response.ok) throw new Error("The state list couldn’t load. Refresh to try again."); return response.json(); }),
        requestedId ? request(api + "?id=" + encodeURIComponent(requestedId)) : Promise.resolve(null)
      ]);
      validCountries = new Set(codes);
      stateNames = new Map(geography.features.map((feature) => [feature.properties.code, feature.properties.name]));
      validStates = new Set(stateNames.keys());
      const filterCountries = createChoices(countryOptions, [...validCountries], displayName, "countries");
      const filterStates = createChoices(stateOptions, [...validStates], (code) => stateNames.get(code), "states");
      const countrySearch = document.querySelector("#destination-search");
      const stateSearch = document.querySelector("#state-search");
      countrySearch.addEventListener("input", () => filterCountries(countrySearch.value));
      stateSearch.addEventListener("input", () => filterStates(stateSearch.value));
      // Enter in a search field should filter the choices, never save a map.
      [countrySearch, stateSearch].forEach((input) => input.addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); }));
      currentMap = result?.map || null;
      if (requestedId && !currentMap) throw new Error("This map could not be found. Use Create a new map to start your own.");
      ready = true;
      const draft = readStorage(draftStorageKey, null);
      const matchingDraft = draft && typeof draft === "object" && draft.id === (currentMap?.id || null) && (!currentMap || editingKey);
      replaceSelections(matchingDraft ? draft : currentMap || { name: "", countries: [], states: [], listed: false });
      updateLinks();
      setDisabled(Boolean(currentMap && !editingKey));
      setStatus(matchingDraft ? "Your unsaved draft was restored from this browser. Save it online when you’re ready." + storageWarning() : (currentMap ? (editingKey ? "You can update this map. Save changes online when you’re ready." + storageWarning() : "") : "Choose your destinations, then save your map online." + storageWarning()));
      renderOwnerMaps();
    } catch (error) {
      showError(error.message || "The map could not be loaded. Refresh to try again.");
      setStatus("The map editor isn’t ready yet. Your saved maps and drafts have not been changed.");
    }
  }
  initialize();
})();
