# One-time owner setup

The website is served by DreamHost. GitHub stores its history, supports collaboration, checks every change, and automatically uploads the public `site` folder after a push to `main`.

## Current setup

- GitHub repository: `tobin00/rustin.coziahr.com`
- DreamHost website user: `rustin007`
- Public website: `https://rustin.coziahr.com`
- Expected DreamHost website directory: `/home/rustin007/rustin.coziahr.com`

The existing DreamHost DNS record stays in place. Do not point the subdomain at GitHub Pages.

## 1. Enable secure shell access

In the DreamHost panel, open **SFTP Users & Files** and make sure `rustin007` is a **Shell user**, not an SFTP-only user. The automated upload uses SSH and `rsync`.

## 2. Create a deployment key

Create a dedicated Ed25519 SSH key pair for GitHub deployment. Do not reuse a personal key. Add only the public key to `/home/rustin007/.ssh/authorized_keys` on DreamHost. Keep the private key out of this repository.

The key should not use a passphrase because GitHub's unattended deployment cannot answer a passphrase prompt. Its access is limited by the `rustin007` DreamHost account.

## 3. Add GitHub deployment secrets

In the repository, open **Settings → Secrets and variables → Actions** and create these repository secrets:

| Secret | Value |
| --- | --- |
| `DREAMHOST_HOST` | The server hostname shown by DreamHost, such as `iad1-shared.example.com` |
| `DREAMHOST_USER` | `rustin007` |
| `DREAMHOST_PATH` | `/home/rustin007/rustin.coziahr.com` |
| `DREAMHOST_PORT` | `22` (optional; the workflow defaults to 22) |
| `DREAMHOST_SSH_KEY` | The complete dedicated private key, including its BEGIN and END lines |
| `DREAMHOST_KNOWN_HOSTS` | The verified SSH host-key line for the DreamHost server |

The known-host entry prevents the automation from connecting to an impersonated server. Obtain it from a trusted first SSH connection or from a host key whose fingerprint has been verified with DreamHost.

## 4. Run the first deployment

Open **Actions → Check and publish website → Run workflow**. A successful run must show all of these steps:

1. Check website
2. Check DreamHost connection settings
3. Prepare secure DreamHost connection
4. Publish site folder to DreamHost

If the last two steps are skipped, one or more secrets are missing. A green check by itself only proves that the website files passed validation.

The upload synchronizes the contents of `site/` into the DreamHost website directory. Files removed from `site/` are also removed from the public directory, except DreamHost's `.well-known` directory used by hosting infrastructure.

## 5. Enable HTTPS and collaboration

In DreamHost, enable a free Let's Encrypt certificate for `rustin.coziahr.com` and turn on HTTPS redirection after the certificate is active.

In GitHub, add Rustin as a repository collaborator with write access. For the simplest workflow, allow direct pushes to `main`; for review before publishing, protect `main` and require a pull request.

## Recovery

If a deployment produces an unwanted result, revert the relevant Git commit and push the revert to `main`. The automation will restore the prior site files on DreamHost.

