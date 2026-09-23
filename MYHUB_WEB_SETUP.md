# MyHub Web Setup

## 1. Install the Required Software

Install **Git** and **Node.js 22 or newer**. Node includes npm, which installs the project dependencies.

Confirm both tools are available:

```bash
git --version
node --version
npm --version
```

## 2. Clone the Repository

```bash
git clone https://github.com/avicados14/MyHub.git
cd MyHub
```

## 3. Install Dependencies

```bash
npm install
```

This creates `node_modules/` and uses the dependency versions recorded in `package-lock.json`.

## 4. Start MyHub

```bash
npm run dev
```

Vite prints a local address, normally `http://localhost:5173`. Open that address in a modern browser.

Data is stored under that exact browser origin. `http://localhost:5173` and the GitHub Pages address have separate local databases.

## 5. Build MyHub

```bash
npm run build
```

A successful build creates `dist/`. Preview it locally with:

```bash
npm run preview
```

Vite Preview is only for testing the production build locally; it is not a production web server.[1]

## 6. Run Tests

Format the maintained source, documentation, configuration, and browser-test files before validating the repository:

```bash
npm run format
npm run format:check
```

Run formatting verification, linting, strict TypeScript, unit tests, and a production build:

```bash
npm run check
```

Install the Chromium browser used by Playwright once:

```bash
npx playwright install chromium
```

Then run the browser acceptance tests:

```bash
npm run test:e2e
```

The Playwright launcher allocates an available loopback port for local runs, starts an isolated Vite server with `--strictPort`, and does not reuse an existing server. CI deterministically uses port `4287`. Set `PLAYWRIGHT_PORT` explicitly when a fixed local port is useful. The unfiltered command runs the same serial desktop, tablet, and mobile Chromium matrix used by CI.

The suite resets MyHub’s application and credential IndexedDB stores before stateful scenarios. It includes route-level axe checks, dark-mode checks, universal-search keyboard behavior, the connected empty-to-history journey, populated dashboard ordering, plaintext backup recovery, and mocked provider-level GitHub Sync. The sync tests use synthetic route responses and encrypted fixtures; they never require a live token, private repository, private URL, uploaded calendar, cookbook data, or passphrase. Run only the cross-cutting suites with:

```bash
npm run test:e2e -- tests/crosscut.spec.ts tests/github-sync.spec.ts
```

## 7. Deploy with GitHub Pages

The repository includes `.github/workflows/pages.yml`. On a push to `main`, the workflow validates the project and deploys the `dist/` artifact through GitHub Pages.

In GitHub:

1. Open the repository.
2. Choose **Settings**.
3. Choose **Pages**.
4. Under **Build and deployment**, select **GitHub Actions**.
5. Push a commit to `main`, or run the workflow manually from **Actions**.

The production address is expected to be:

```text
https://avicados14.github.io/MyHub/
```

The Vite base path is set to `/MyHub/` in GitHub Actions, as required for repository-subpath sites.[1] The workflow uses GitHub’s Pages configuration, artifact, and deployment actions with the required permissions.[2]

## 8. Back Up and Restore Local Data

Open **Settings → Data & privacy**.

Choose **Export data** to download a JSON backup. To restore it, choose **Import data**, select the file, review the timestamp, and confirm replacement. JSON exports are plaintext; keep them out of repositories and untrusted cloud folders.

The deployed site and local development site do not share IndexedDB. Export/import or optional encrypted GitHub Sync can transfer data between them.

## 9. Configure Optional Encrypted GitHub Sync

Create or use a dedicated data repository and confirm it is **private**. Create a **fine-grained personal access token** restricted to only that repository with **Contents: read and write**. Do not create a classic PAT and do not grant Actions/workflow, administration, organization, or unrelated repository access.

In **Settings → GitHub Sync**, keep or update the defaults:

```text
Owner: avicados14
Repository: MyHub-Data
Path: myhub-data/v1/snapshot.enc
```

Enter the fine-grained token and an encryption passphrase of at least 12 characters. MyHub encrypts the token into a separate IndexedDB credential record and encrypts `AppData` before upload. The passphrase is never saved and must be entered again after a page/browser restart. Losing it makes the remote snapshot and stored token unrecoverable through MyHub.

The existing private snapshot is already populated. On a new browser, choose **Connect and sync** and wait for the status to become **current**. MyHub pulls the encrypted snapshot before treating an empty device as authoritative. The verified snapshot contains 27 cookbook recipes and both calendar feeds. Open **Calendar** after unlock to import the encrypted companion snapshot; the current source files produce 3,365 calendar events.

Use **Sync now** for an immediate check, **Pause** to stop remote writes while preserving local operation, and **Unlink** to remove this browser's encrypted credential record without deleting the remote snapshot. If both copies changed, choose **Use this device** or **Use GitHub**; MyHub does not silently discard either side.

**Delete remote snapshot** removes the latest file and pauses sync. GitHub history, forks, caches, and retention can still preserve earlier encrypted versions, so historical erasure cannot be guaranteed.

## Troubleshooting

### `npm install` fails

Confirm Node.js is version 22 or newer. Delete only generated dependencies and reinstall:

```bash
rm -rf node_modules
npm install
```

Do not delete `package-lock.json` unless you intentionally want to update dependencies.

### The page is blank after deployment

Confirm the GitHub Pages source is **GitHub Actions**, the repository name is exactly `MyHub`, and the latest workflow completed. Inspect the browser console for a missing `/MyHub/` asset path.

### A direct application URL does not load

MyHub uses hash routes. Valid deployed routes look like:

```text
https://avicados14.github.io/MyHub/#/food
```

The portion after `#` is handled inside the browser, so GitHub Pages does not need a server rewrite.

### Canvas refresh fails

Many Canvas ICS servers block browser-origin requests. Download the `.ics` file and use **Calendar → Import .ics files**, or unlock GitHub Sync and choose **Check private snapshot**. MyHub does not bypass Canvas restrictions or proxy private feed URLs through an unknown service.

### The encrypted calendar snapshot will not load

Confirm GitHub Sync is unlocked, active, and connected to the private `MyHub-Data` repository. Calendar files larger than 1 MB require GitHub's authenticated raw Contents representation; current MyHub requests that representation automatically and disables browser caching for the second request.[3] If the error persists, choose **Check private snapshot** again and read the inline status before changing any data.

### Data disappeared

Confirm you are using the same browser profile and the same address. Browser storage can be cleared by the user, private-browsing rules, or device storage management. Restore the latest JSON export and make regular backups. Feed URLs are stored only in that browser’s local MyHub data; do not paste a private feed URL into source, test fixtures, screenshots, issue reports, or a repository.

### GitHub Sync is locked

The passphrase is intentionally memory-only. Enter it again after restarting or reloading the app. If it no longer works, verify that you are using the original passphrase; authenticated decryption rejects wrong passphrases and modified ciphertext.

### GitHub Sync reports a conflict

Both local and remote data changed after the last acknowledged digest, or GitHub changed during a conditional write. Review the two explicit actions. **Use this device** refetches the latest SHA and overwrites the remote snapshot; **Use GitHub** replaces local AppData with the decrypted remote snapshot.

### Browser tests cannot launch

Install the Playwright browser and its Linux dependencies:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

The local runner normally avoids occupied ports automatically. If `PLAYWRIGHT_PORT` is set, make sure that exact port is available; `--strictPort` intentionally fails instead of attaching to another process.

## References

[1]: https://vite.dev/guide/static-deploy.html 'Vite: Deploying a Static Site'
[2]: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages 'GitHub Docs: Using custom workflows with GitHub Pages'
[3]: https://docs.github.com/en/rest/repos/contents 'GitHub REST API endpoints for repository contents'
