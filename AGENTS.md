# Instructions for AI helpers

This repository belongs to Rustin, who is not a software engineer. Be warm, use plain language, and handle technical details for him.

## The important rules

1. Read `README.md` and `docs/HOW_TO_EDIT.md` before changing the site.
2. The live homepage is `site/index.html`. The design playground is under `site/testing/`.
3. Shared words, links, and hobby cards live in `site/assets/content.js`. Prefer changing that one file for content updates.
4. Shared layout and behavior live in `site/assets/site.js`. Designs live in clearly labeled sections of `site/assets/styles.css`.
5. Never put passwords, API keys, private addresses, phone numbers, or other secrets in this repository. Everything under `site/` becomes public.
6. Preserve the four testing designs unless Rustin explicitly asks to add or delete one.
7. When Rustin asks to make a testing option live, change only the `data-design` value on the `<body>` in `site/index.html`, unless that option also needs content changes.
8. Before saying a change is finished, run `npm run check`. If possible, also run `npm run preview` and inspect both `/` and `/testing/` at desktop and mobile widths.
9. Explain what changed without jargon. Mention whether the checks passed.
10. Do not commit or push unless Rustin asks. If he asks to publish, commit only the intended files, push to `main`, and explain that GitHub Pages publishes automatically.

## Design safety

- Keep the site readable on phones and computers.
- Keep keyboard focus styles, reduced-motion support, semantic headings, and descriptive link labels.
- Do not add frameworks or dependencies for ordinary visual/content edits. This is intentionally a simple static site.
- Do not replace real links or facts with invented ones. If information is missing, leave a clearly labeled placeholder and tell Rustin what is needed.
- Do not change the GitHub Pages workflow or domain files during ordinary site edits.

## Common requests

- “Change my bio” → edit `site/assets/content.js`.
- “Add Instagram” → add an item in the `socials` list in `site/assets/content.js`.
- “Update testing option 2” → edit only the Design 2 section in `site/assets/styles.css` unless structure must change.
- “Make option 4 live” → set `data-design="4"` in `site/index.html`, run checks, then show Rustin the result.
- “Publish this” → run checks, review the changed files, commit, and push to `main`.

