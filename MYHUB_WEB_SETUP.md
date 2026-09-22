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

Run linting, strict TypeScript, unit tests, and a production build:

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

Choose **Export data** to download a JSON backup. To restore it, choose **Import data**, select the file, review the timestamp, and confirm replacement.

The deployed site and local development site do not share IndexedDB. Export and import are the Phase 1 transfer method.

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

Many Canvas ICS servers block browser-origin requests. Download the `.ics` file from Canvas and use **Settings → Canvas calendar → Import ICS file**. MyHub does not bypass Canvas restrictions or proxy private feed URLs through an unknown service.

### Data disappeared

Confirm you are using the same browser profile and the same address. Browser storage can be cleared by the user, private-browsing rules, or device storage management. Restore the latest JSON export and make regular backups.

### Browser tests cannot launch

Install the Playwright browser and its Linux dependencies:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

## References

[1]: https://vite.dev/guide/static-deploy.html "Vite — Deploying a Static Site"
[2]: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages "GitHub Docs — Using Custom Workflows with GitHub Pages"
