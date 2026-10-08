# Rustin's website

This repository powers **https://rustin.coziahr.com**. It is a simple static website designed to be edited safely with ChatGPT or Codex, stored in GitHub, and published automatically to DreamHost.

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

Before publishing:

```powershell
npm run check
```

## One-time owner setup

See [docs/OWNER_SETUP.md](docs/OWNER_SETUP.md) for the one-time DreamHost connection, HTTPS, and collaborator access.

