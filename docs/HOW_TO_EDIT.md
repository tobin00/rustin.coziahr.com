# How to update your website

You do not need to understand the code. Your AI helper has instructions built into this repository and should handle the details.

## The normal workflow

1. Open this project folder in Codex or ChatGPT.
2. Say what you want in normal language.
3. Ask it to preview the result.
4. Look at the homepage and the testing page.
5. If you like it, say: **“Check everything and publish it.”**

Publishing means the assistant checks the site, saves a Git commit, and pushes it to GitHub. GitHub then securely copies the public site files to DreamHost automatically.

After the introduction, the homepage and all four testing designs show
**Countries Visited**, **Create your own map**, **Rustin's friends' maps**,
**Currently into**, and **Around the web**, in that order. The introduction's
buttons are **Find me online**, **Travel map**, and **See what I'm into**.

## Safe prompts you can copy

### Change words or links

> Update my bio to say: “…” Keep the current design. Preview it, but do not publish yet.

> Add this social link: “…”. Use a clear label and open it in a new tab. Preview it, but do not publish yet.

### Experiment with a design

> Change testing option 2 so it feels more like “…”. Do not change the live homepage. Preview the testing option for me.

> Create a fifth testing option inspired by “…”. Keep the existing four options. Do not make it live yet.

### Make a design live

> Make testing option 4 the live homepage. Do not change its words. Run the site check and preview the homepage. Do not publish until I approve it.

### Publish

> Check everything and show me what will be published. If the checks pass and there are no unrelated changes, commit and push it to main. Confirm that the DreamHost upload completed.

## Update the travel map

Open `site/assets/travel-countries.js`. This is the only file you need to
change for the world map's visited list, count, and upcoming highlights. The
separate U.S. state and UK country lists are described below.

- `visited` currently records your 68 confirmed destinations. The count says
  **Destinations Explored** because it includes countries and separately tracked
  territories. Hong Kong (`HK`), Macau (`MO`), Taiwan (`TW`), and Puerto Rico (`PR`)
  each have their own region. `GB` covers the United Kingdom; clicking it opens
  a separate map with individual shapes for England, Scotland, Wales, and
  Northern Ireland. England and Scotland are confirmed as visited.
  The United States (`US`) counts as one destination,
  while its breakout separately shows all 50 states you have visited.
- Your Caribbean list includes 26 countries and territories from the
  [UN Caribbean region](https://unstats.un.org/unsd/methodology/m49/overview/).
  Cuba (`CU`) and Haiti (`HT`) remain unvisited. Bonaire, Sint Eustatius and Saba share
  one destination code (`BQ`); the French and Dutch sides of Saint Martin
  use separate codes (`MF` and `SX`), as do the British and U.S. Virgin
  Islands (`VG` and `VI`).
- Put uppercase ISO two-letter country codes inside the brackets, in quotes,
  separated by commas. For example only: `visited: ["US", "JP", "FR"],`.
  That example means United States, Japan, and France; it is not your actual list.
- Use `GB` for the United Kingdom, not `UK`. The checker catches invalid codes.
- Each distinct visited code counts once. Countries and territories with their
  own ISO code can be tracked separately. Antarctica is `AQ`.
- **Countries & continents** uses this same visited list to show UN member
  countries, other destinations, and continents explored. Country totals use
  the [193 UN member states](https://research.un.org/en/unmembers/currentmembers)
  as their baseline. Expand a continent to see its destinations, or open
  **Why “destinations”?** for the counting rules. Each code belongs to one
  continent; North America includes Central America and the Caribbean.
  The helper files `travel-regions.js` and `travel-stats.js` calculate this
  automatically, so adding a visit still only requires `travel-countries.js`.
- `upcoming` controls the planned destinations. It currently includes `US`,
  `JP`, `CL`, and `AQ` from the adventures you supplied. No cruise stops were
  assumed. Update this list separately when your plans change.
- New upcoming destinations have a solid orange fill. Destinations in both
  `visited` and `upcoming` keep their visited fill with an orange outline,
  shown in the legend as **Visited & Upcoming**.
- The United States is the exception: it keeps its visited fill and a neutral
  border, even with another trip planned. Its tooltip still shows **Upcoming**,
  and clicking it still opens the state breakdown.
- Set `showUpcoming: false` to hide upcoming highlights and both upcoming legend items.
- Upcoming destinations never add to the visited count. No dates appear
  on the map. Your homepage map remains read-only; friends edit their own maps
  on the separate `/maps/` page.

Refresh the local preview to see your changes, run `npm run check`, and ask
to publish when ready. The published site changes only after publishing.
The homepage and all four personal testing designs keep hover/tap details,
the + and − zoom buttons at the bottom left, the U.S. state and UK country
breakdowns with back buttons, the legend, and the expandable explored-place lists. The text lists provide a
keyboard and screen-reader alternative. These personal views use a simpler
layout without country/state selectors, reset or “Move map” controls, or a
visible source-credit footer. On a computer, the mouse wheel zooms when the
pointer is over the main world, U.S. state, or UK map. Move the pointer outside the
map to scroll the page. Phone swipes still scroll the page normally; the small
Antarctica inset does not use mouse-wheel zoom.

The map uses local Leaflet files and prepared Natural Earth boundaries. The main
world view keeps its original roomy, equirectangular proportions. Antarctica
appears in a separate small polar inset, so it does not change the main map's
scale. It remains selectable with a tooltip, and `AQ` follows the usual
country-list and visited-count rules. An upcoming Antarctica trip adds no visit
until `AQ` is added to `visited`.
The source boundaries are simplified for display, and the polar inset is prepared
in advance. Visitors need no extra projection library. There is no paid service,
API key, map tiles, or visitor CDN calls.
The map assets load only as a visitor approaches the section. Provenance and
licenses are in `site/assets/vendor/leaflet/`. Keep those files intact.

The separate **Across the United States** breakout uses
`site/assets/travel-states.js`. All 50 state postal codes are listed as visited,
and this breakout stays hidden until someone clicks or taps the United States
on the world map. “Back to world map” or
Escape returns to the world view. Only one map is shown at a time. State
boundaries load on demand when the breakout opens. The country shape also
supports keyboard focus and Enter/Space to open the breakdown.
The visited-state list is
based on your confirmation. Alaska and Hawaii appear as insets. The count is
calculated from distinct state codes. Washington, D.C. and territories are
excluded; they are not states. State visits do not add 50 to the country count:
the United States is one country in `travel-countries.js`.
The **U.S. states** counter beside the country and continent totals also uses
this same state list and currently shows **50 / 50**.
The checker confirms that the all-50 milestone contains exactly the 50 states.
Both maps share the existing Leaflet library, so there is no new runtime dependency.

### England, Scotland, Wales, and Northern Ireland

The separate **Across the United Kingdom** view opens when someone clicks or
taps the United Kingdom on your world map, or uses its link in the Europe list.
England and Scotland have their own highlighted shapes. Wales and Northern
Ireland are shown in neutral gray as **Not yet recorded**; no visit was assumed.
“Back to world map” or Escape returns to the world view. The UK country shapes
support keyboard focus, and a text list provides each country's visit status.

Manage these visits in `site/assets/travel-uk.js`, independently from the world
list. Its `visited` list currently contains `GB-ENG` (England) and `GB-SCT`
(Scotland). Add `GB-WLS` for Wales or `GB-NIR` for Northern Ireland only when a
visit is confirmed. The UK count updates from distinct codes and currently shows
**2 of 4 UK countries explored**. Keep `GB` in `travel-countries.js`: this still
counts as one destination and one UN member country, so the world total stays
at 68. These subdivisions do not become extra world destinations or change the
continent totals. Friends' maps keep their existing country/state selections.

The UK boundaries are prepared local data, loaded only when this breakout opens.
All three maps share the existing Leaflet library; no service or key is needed.

## Friends' travel maps

The homepage's **Create your own map** link opens `/maps/`. Friends enter a
display name, choose the countries and territories they have visited, and select
any of the 50 U.S. states. **Save map online** keeps the map on the website so
they can return later. Selecting a state also marks the United States visited.
This never changes your own 68-destination list in `travel-countries.js` or
your all-50-state list in `travel-states.js`.

The `/maps/` creator and shared-map views keep their country/state selectors,
reset buttons, “Move map” controls, and visible source credits. Their selectors
and expandable text lists offer keyboard and screen-reader alternatives.
Normal swipes scroll the page; “Move map” enables dragging and pinch zoom,
and “Done moving map” turns those off. The mouse wheel zooms over the main world
or U.S. state map in either mode, and the + and − buttons remain at the bottom
left. Move the pointer outside the map to scroll the page. Phone swipes scroll
normally while “Move map” is off. Selectors also work in either mode; selecting
the United States opens the state breakdown.

- **Public map link:** share this so people can view the map. The display name
  and selected places are visible to anyone with the link.
- **Private edit link:** copy and bookmark this to update the map later, including
  from another device. Anyone with this link can edit or delete the map. There
  are no accounts, passwords, or account-recovery process, so preserve this link.
- **Show my map in Rustin's friends' maps:** optional. Leave it unchecked to keep
  the map out of the homepage directory; the public link still works.
- Changes are also kept as a draft in the current browser when browser storage
  is available. A draft does not update the public map until saved online.
  Clearing browser data can remove drafts and remembered editing access.

### Preview and check map saving

Run `npm run preview` as usual. It automatically uses PHP when PHP 8+ with
PDO SQLite is installed. Without that runtime, the site and map editor still
preview, but online saving and the friends directory are unavailable. Drafts
can still be kept in that browser.

For a portable PHP installation, set `PHP_BIN` to its executable path before
starting the preview. If it needs extra flags, set `PHP_ARGS` to a JSON array of
strings, for example `["-d","extension=pdo_sqlite"]`. These settings also apply to
`npm run check:maps`, which checks saving, ownership, validation, and persistence
using a separate temporary database. Run it after changing the saving service,
along with the usual `npm run check` and `npm run build`.

### Where friends' maps are stored

The server needs PHP 8+, PDO SQLite, and permission to write in its private home
directory. With the current DreamHost website folder, the service automatically
creates `/home/rustin007/.rustin-travel-maps/maps.sqlite`. This is outside the
public website, and normal deployments do not delete or replace it. Back it up
separately; Git and the site files do not contain friends' saved maps.

Local PHP previews normally store their database in `.rustin-travel-maps/` at
the repository root, which is excluded from Git. A helper can set the server's
`RUSTIN_MAPS_DATA_DIR` environment variable to use another private folder. The
service rejects storage inside the public website. Keep databases, private edit
links, and backups out of `site/` and out of Git.

## Important safety notes

- Never paste passwords, private keys, or account recovery codes into the website files.
- Assume everything in the `site` folder is public.
- Ask for a preview before publishing a large change.
- If something goes wrong, say: **“Show me the recent Git history and help me restore the last good version. Do not delete anything.”**

