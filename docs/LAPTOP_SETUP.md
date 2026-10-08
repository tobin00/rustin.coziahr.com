# Set up Rustin's Windows laptop

This is a one-time checklist. After it is complete, Rustin can update the site by opening its folder in Codex and describing what he wants in ordinary language.

## Before using the laptop

Tobin needs to:

1. Add Rustin's GitHub username as a collaborator on `tobin00/rustin.coziahr.com`.
2. Tell Rustin to accept the invitation email from GitHub.

Rustin should use his own GitHub and ChatGPT accounts. Do not share account passwords or deployment keys.

## 1. Install the four tools

Install these from their official websites:

1. **[ChatGPT desktop app for Windows](https://openai.com/chatgpt/download/)** — this provides Codex for working with the local project.
2. **[Git for Windows](https://git-scm.com/download/win)** — saves and transfers changes.
3. **[Node.js LTS](https://nodejs.org/en/download)** — runs the website's local preview and safety check.
4. **[GitHub CLI](https://cli.github.com/)** — provides a browser-based GitHub sign-in and securely connects Git commands.

Restart the computer after installation so every tool is available to Codex.

## 2. Sign in to GitHub

Open PowerShell and run:

```powershell
gh auth login
```

Choose:

- `GitHub.com`
- `HTTPS`
- Authenticate through the web browser
- Allow GitHub CLI to authenticate Git when asked

Do not create or paste a personal access token for this setup.

## 3. Download the website project

In PowerShell, move to the folder where Rustin keeps projects, then run:

```powershell
gh repo clone tobin00/rustin.coziahr.com
```

This creates a folder named `rustin.coziahr.com`.

## 4. Open it in Codex

Open the ChatGPT desktop app, choose Codex, and open the newly cloned `rustin.coziahr.com` folder as the local project. Codex will automatically read `AGENTS.md`, which explains how this particular website should be changed and published safely.

In the first chat, say:

> Run CHECK_SETUP.cmd and help me fix every ACTION item. Do not change the website yet.

Codex should run the checker, configure Rustin's Git name and email if needed, and explain any missing prerequisite in plain language.

## 5. Confirm everything works

Rustin can double-click `CHECK_SETUP.cmd` at any time. A fully configured laptop ends with:

```text
READY: This laptop is prepared to edit and publish Rustin's website.
```

The checker does not install software, change files, commit, or publish. It only reports what is ready and what needs attention.

## Normal use after setup

1. Open the project folder in Codex.
2. Say: **“Get the latest website changes before we start.”**
3. Describe the desired change and ask for a preview.
4. When it looks right, say: **“Check everything and publish it.”**

GitHub stores the history and automatically publishes approved pushes to DreamHost. Rustin never needs the DreamHost password or deployment key.

## Useful recovery prompts

> Check whether my local copy is behind GitHub. Do not discard any of my work.

> Show me what changed since the last published version in plain language.

> Help me restore the last good version without deleting any uncommitted work.

