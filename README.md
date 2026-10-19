# Rustin's website

This repository powers **https://rustin.coziahr.com**. It is a simple website designed to be edited safely with ChatGPT or Codex, stored in GitHub, and published automatically to DreamHost. Most pages are static files; friends' travel maps use a small PHP service to save changes.

## Start here

Rustin: open this folder in Codex/ChatGPT and describe what you want in everyday language. Examples:

- “Change my intro to say …”
- “Add my Instagram link …”
- “Make testing option 2 more outdoorsy.”
- “Show me the testing designs.”
- “Make testing option 4 the main site.”
- “Check everything and publish it.”

The detailed beginner guide is in [docs/HOW_TO_EDIT.md](docs/HOW_TO_EDIT.md).

Setting up a new Windows laptop? Start with [docs/LAPTOP_SETUP.md](docs/LAPTOP_SETUP.md), then double-click `CHECK_SETUP.cmd` after cloning the repository.

## How the site is organized

- `site/index.html` — the live homepage
- `site/testing/index.html` — the design chooser
- `site/testing/options/` — the four full-page testing designs
- `site/assets/content.js` — Rustin's words, hobbies, and social links
- `site/assets/travel-countries.js` — visited country codes and upcoming map outlines
- `site/assets/travel-states.js` — the separate list of all 50 visited U.S. states
- `site/assets/travel-map.js` and `travel-map.css` — the interactive Around the world map
- `site/maps/index.html` — create, view, and update a friend's travel map
- `site/assets/friends-map.js` and `friends-directory.js` — the map editor and friends list
- `site/api/maps.php` — saves friends' maps outside the public website folder
- `site/assets/styles.css` — all visual designs
- `AGENTS.md` — safety instructions that coding assistants automatically read
- `CHECK_SETUP.cmd` — a read-only laptop prerequisite check
- `.github/workflows/deploy-dreamhost.yml` — checks the site and securely publishes it to DreamHost

## Preview and check

If you want to use the terminal:

```powershell
npm run preview
```

Then open `http://localhost:4173`. Stop it with `Ctrl+C`.

The preview automatically enables online map saving when PHP 8+ with PDO SQLite
is available. Otherwise, maps can still be previewed and selected places kept
as browser drafts, but online saving is unavailable. Portable PHP can be selected
with `PHP_BIN`; optional `PHP_ARGS` must be a JSON array of command arguments.
See [the editing guide](docs/HOW_TO_EDIT.md#friends-travel-maps) for details.

Before publishing:

```powershell
npm run check
```

For changes to friends' map saving, also run `npm run check:maps`. These integration
tests require PHP with PDO SQLite and use an isolated temporary database.

## Friends' travel maps

At `/maps/`, friends choose countries, territories, and any of the 50 U.S. states,
then save their own map online. A public link lets others view it; a private edit
link lets its owner return and update it. Appearing in Rustin's friends list is
optional. Keep the private link safe: there are no accounts or recovery service.
Rustin's own 39 destinations remain managed in `site/assets/travel-countries.js`.

The service needs PHP 8+, PDO SQLite, and a writable private home directory.
On the current DreamHost setup, friends' maps are stored in
`/home/rustin007/.rustin-travel-maps/maps.sqlite`, outside the public website.
The database survives site deployments and must be backed up separately from Git.

## One-time owner setup

See [docs/OWNER_SETUP.md](docs/OWNER_SETUP.md) for the one-time DreamHost connection, HTTPS, and collaborator access.

