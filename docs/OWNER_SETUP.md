# One-time owner setup

The repository is prepared for GitHub Pages. These account-level steps are intentionally not automated until the repository owner and GitHub account are known.

## 1. Create the GitHub repository

Create a repository named `rustin.coziahr.com` in the account or organization that should own it. A public repository works with GitHub Free. Do not initialize it with another README because this folder already contains one.

Push this local repository to GitHub, then add Rustin as a collaborator with write access.

## 2. Turn on GitHub Pages

In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **GitHub Actions**. The included workflow publishes the `site` folder after every push to `main`.

## 3. Connect the subdomain

In the same Pages settings, set the custom domain to `rustin.coziahr.com`.

At DreamHost DNS, replace any conflicting web-hosting record for `rustin` with a CNAME record that points to the repository owner's GitHub Pages hostname, such as `YOUR-GITHUB-NAME.github.io`. The exact target depends on which GitHub account owns the repository.

DNS changes can take time to spread. Once GitHub confirms the domain, enable **Enforce HTTPS** in the Pages settings.

## 4. Protect the live site

Recommended after the first successful deployment:

- Require a pull request before merging to `main` if Rustin wants a review step.
- Otherwise, keep direct pushes to `main` for the simplest “publish” workflow.
- Add a branch protection rule that prevents force pushes and deletion of `main`.

## 5. Set up Rustin's laptop

Install Git and the Codex/ChatGPT desktop app, sign in to GitHub, clone the repository, and open the cloned folder in the app. The `AGENTS.md` file supplies the project-specific editing and safety instructions automatically.

