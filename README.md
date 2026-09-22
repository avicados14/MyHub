# MyHub

MyHub is a private, web-first college command center. It connects class schedules, homework, automatic study planning, recipes, meal planning, nutrition, pantry inventory, and grocery shopping in one locally persistent application.

The web application is the product-validation phase for a future native SwiftUI application for iPhone and iPad. It is a normal standalone React project that can be cloned, run, tested, modified, and deployed without Manus.

## What MyHub Does

**School planning** combines manual calendar events, imported iCalendar (`.ics`) events, homework deadlines, estimated work, and preferred study hours. The deterministic planner creates conflict-free study blocks and preserves blocks that the user locks, completes, or manually adjusts.

**Food planning** combines a recipe library, cooking-friendly serving scaling, a weekly meal planner, prepared-versus-consumed servings, leftovers, immutable food-log snapshots, and daily nutrition progress.

**Pantry and groceries** aggregate compatible recipe ingredients, compare those requirements with saved inventory, generate a mobile-friendly shopping list, preserve completed trips as historical snapshots, and optionally add purchases back to the pantry.

## Project Status

Version **0.1.0** is a functional Phase 1 web prototype.

Working now:

- Responsive dashboard with connected school and food summaries
- Day, week, and month calendar views
- Manual events and local `.ics` imports
- Homework creation, progress, completion, priority, and deletion
- Deterministic conflict-aware study scheduling
- Study-block locking, completion, removal, and calendar editing
- Recipe library, details, favorites, creation, and yield scaling
- Weekly meal planning with prepared, consumed, and leftover balances
- Daily nutrition snapshots and editable targets
- Pantry inventory across pantry, refrigerator, and freezer
- Grocery aggregation, Pantry Check, shopping, completion, pantry handoff, and immutable history
- Universal search across recipes, homework, and pantry items
- IndexedDB persistence, JSON export/import, and demo reset
- Light, dark, desktop, tablet, and mobile layouts
- GitHub Pages deployment workflow

In development or intentionally limited:

- Canvas URL refresh is best-effort because many feeds block direct browser requests. Local `.ics` import is the reliable fallback.
- Recipe URL, social-media, image, video, OCR, barcode, and public nutrition database adapters are not connected to a server in this static prototype. Manual entry remains functional.
- Drag-and-drop is not required for any task; accessible button and form controls provide the current editing path.
- Local data does not synchronize between devices.

Planned for native iOS and iPadOS after web review:

- A true SwiftUI interface using platform-native navigation
- EventKit calendar access
- Camera, Vision, VisionKit, PhotosPicker, and barcode scanning
- A Share Extension for legitimate intake from Safari, Photos, and supported apps
- A synchronization decision between CloudKit and a private shared backend

## Screenshots

### Desktop Dashboard

![MyHub desktop dashboard](docs/screenshots/dashboard-desktop.png)

### Mobile Meal Planner

![MyHub mobile weekly meal planner](docs/screenshots/meal-planner-mobile.png)

### Mobile Grocery Mode

![MyHub mobile grocery shopping list](docs/screenshots/grocery-mobile.png)

## Technology Stack

MyHub uses **React 19**, **TypeScript**, **Vite**, semantic CSS, **IndexedDB**, **Vitest**, and **Playwright**. Hash routing keeps every application route usable on GitHub Pages without server rewrites. Feature routes are lazy-loaded to keep the initial bundle focused.

## Getting Started

Requirements:

- Node.js 22 or newer
- npm 10 or newer
- Git

```bash
git clone https://github.com/avicados14/MyHub.git
cd MyHub
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

## Building

```bash
npm run build
npm run preview
```

The optimized site is written to `dist/`. The GitHub Actions environment automatically sets the Vite base path to `/MyHub/` for repository-subpath hosting.[1]

## Testing

```bash
npm run lint
npm run typecheck
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

Run the complete non-browser quality gate with:

```bash
npm run check
```

Domain tests cover recipe scaling, fraction formatting, unit normalization, grocery aggregation, nutrition totals, leftover limits, scheduling conflicts, due-date prioritization, ICS parsing, IndexedDB persistence, and backup validation. Browser tests cover the connected acceptance flows.

## GitHub Pages Deployment

The workflow at `.github/workflows/pages.yml` runs on pushes to `main` and can also be started manually. It installs dependencies, runs linting, strict type checking, unit tests, Chromium browser tests, and a production build. It then uses the current GitHub Pages artifact workflow with least-privilege `pages: write` and `id-token: write` permissions.[2]

In the repository, choose **Settings → Pages → Build and deployment → GitHub Actions** if it is not already selected.

## Data Storage

Structured data is stored in IndexedDB under the current browser profile and origin. Data survives ordinary reloads and browser restarts, but it is not a cloud backup and does not automatically appear on another device.

Use **Settings → Data & privacy → Export data** to download a portable JSON backup. Import validates the MyHub backup envelope before replacing local data.

## Resetting Demo Data

Open **Settings → Data & privacy**, export anything you want to keep, and choose **Reset demo data**. MyHub asks for explicit confirmation before replacing current local data.

## Repository Structure

```text
src/app/           Application shell, routes, and persistent state provider
src/components/    Reusable accessible UI primitives
src/domain/        Portable models and deterministic business logic
src/features/      Dashboard, calendar, school, food, pantry, grocery, settings
src/storage/       IndexedDB and backup boundary
src/styles/        Semantic tokens and responsive layouts
src/utilities/     Date, identity, and asset helpers
tests/             Playwright browser acceptance tests
public/recipes/    Original local recipe photography
.github/workflows/ Validation and GitHub Pages deployment
```

## Future iOS App

The future Apple application will reimplement the proven workflows using SwiftUI instead of wrapping this website in a WebView. The TypeScript domain models, invariants, calculation fixtures, and JSON backup format are the initial interoperability contract. See `MYHUB_IOS_PLAN.md`.

## Privacy

MyHub has no advertising, behavioral analytics, trackers, accounts, or marketing software. Core data and calculations stay in the browser. A user-initiated Canvas feed request goes directly from the browser to the provided URL; if the request is blocked, MyHub does not route it through another service.

Exported JSON backups can contain private academic and food records. Store them accordingly. Do not commit personal backup files or private feed URLs.

## Known Limitations

GitHub Pages is static hosting. It cannot safely hold private API keys or act as a cross-origin proxy. Some automatic imports therefore require a future backend or native adapter. IndexedDB can also be cleared by browser or device storage management, so regular exports are recommended.

## Roadmap

1. Validate and refine the complete web workflow.
2. Improve imports through explicit secure adapter boundaries.
3. Freeze approved data contracts and interaction behavior.
4. Build native iPhone and iPad interfaces in SwiftUI.
5. Add EventKit, camera, Vision, share-extension, and synchronization adapters only after the native foundation is approved.

## References

[1]: https://vite.dev/guide/static-deploy.html "Vite — Deploying a Static Site"
[2]: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages "GitHub Docs — Using Custom Workflows with GitHub Pages"
