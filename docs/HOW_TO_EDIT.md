# How to update your website

You do not need to understand the code. Your AI helper has instructions built into this repository and should handle the details.

## The normal workflow

1. Open this project folder in Codex or ChatGPT.
2. Say what you want in normal language.
3. Ask it to preview the result.
4. Look at the homepage and the testing page.
5. If you like it, say: **“Check everything and publish it.”**

Publishing means the assistant checks the site, saves a Git commit, and pushes it to GitHub. GitHub then securely copies the public site files to DreamHost automatically.

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

## Important safety notes

- Never paste passwords, private keys, or account recovery codes into the website files.
- Assume everything in the `site` folder is public.
- Ask for a preview before publishing a large change.
- If something goes wrong, say: **“Show me the recent Git history and help me restore the last good version. Do not delete anything.”**

