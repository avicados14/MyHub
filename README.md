# MyHub

MyHub is a private, web-first college command center. It connects class schedules, homework, automatic study planning, recipes, meal planning, nutrition, pantry inventory, and grocery shopping in one locally persistent application.

The web application is the product-validation phase for a future native SwiftUI application for iPhone and iPad. It is a normal standalone React project that can be cloned, run, tested, modified, and deployed without Manus.

## What MyHub Does

**School planning** combines editable calendar events, multiple local iCalendar (`.ics`) sources, homework with subtasks and provenance, estimated work, preferred study hours, and configured avoid-time ranges. The deterministic planner works through each deadline and preserves blocks that the user locks, completes, moves, or resizes.

**Food planning** combines structured recipes and reviewable imports, cooking-friendly serving scaling and conversions, a weekly meal planner, prepared-versus-consumed servings, reusable leftovers, packaged foods, Open Food Facts barcode/text search, immutable food-log snapshots, and daily nutrition progress.

**Pantry and groceries** aggregate compatible recipe ingredients for the remaining current planner week, use prepared quantities and saved yield overrides, compare those requirements with saved inventory, and persist the generation window and source meals. Pantry Check requires an explicit decision for every requirement and added staple. Completed trips become immutable history, and only confirmed purchases return to the pantry.

## Project Status

Version **0.1.0** is a complete Phase 1 web prototype. The school, calendar, food, pantry, grocery, search, backup, and encrypted-sync workflows are integrated and verified together. `REQUIREMENTS_AUDIT.md` records the final evidence and the boundaries reserved for native iPhone and iPad work.

Working now:

- Responsive dashboard with connected school and food summaries, including a compact previous/current/next schedule centered on the live current time
- Day, week, and month calendar views
- Full manual-event creation, editing, and deletion with source-aware display
- Previewed, confirmed multi-file `.ics` imports for Canvas, Google Calendar, and other exports
- RFC line unfolding, UTC/TZID conversion into a persisted IANA display time zone, all-day handling, rich event metadata, DST-aware recurrence, stable deduplication, and Canvas assignment mapping
- Full homework editing, progress/status, subtasks, source links, and imported provenance
- Deterministic conflict-aware study scheduling through deadlines, including configured avoid-time ranges
- Study-block locking, completion, removal, accessible form editing, direct week-column drag, and 15-minute resize buttons
- Structured recipe creation/editing, source metadata, notes, ingredient overrides, persistent current yield, and US/metric display conversion; the personal cookbook uses 8 oz for every former 6–8 oz chicken ingredient and includes ingredient-based nutrition for every recipe
- Reviewable recipe drafts from permitted URL JSON-LD, pasted content, local image OCR, or user-supplied social caption/screenshot/video frame
- Weekly meal planning for recipes, packaged foods, custom foods, and leftovers, with explicit planned, prepared, consumed, and leftover balances; extra prepared portions can automatically fill later open days, every linked day shows the same decreasing batch balance, and planning never records consumption automatically
- Packaged-food entry and food-log search by barcode or text through read-only Open Food Facts, local Nutrition Facts OCR with confirmation, and immutable eight-metric nutrition snapshots
- Daily calories, protein, carbohydrates, fat, sugar, saturated fat, fiber, and sodium progress; editable targets/limits; and totals that exclude planned meals until consumption is recorded
- Pantry inventory across pantry, refrigerator, and freezer
- Current-week grocery aggregation across compatible mass, volume, and count units using prepared servings and recipe overrides; explicit Pantry Check and staple review; editable shopping; confirmed-purchase pantry handoff; and immutable history with source-window provenance
- Universal search across recipes, homework, pantry items, packaged foods, grocery history, and meal plans
- Empty first run, IndexedDB persistence, versioned migration, JSON export/import, and confirmed clear-all
- End-to-end encrypted Supabase cross-device data, encrypted GitHub backup, a revocable private access link, and shareable query-backed Settings sections
- Light, dark, desktop, tablet, and mobile layouts
- GitHub Pages deployment workflow

In development or intentionally limited:

- Local `.ics` file import is the reliable browser path. Encrypted private-repository calendar snapshots can be checked after GitHub Sync is unlocked; no private feed URL or calendar file is bundled with MyHub.
- Recipe URL and Open Food Facts requests are direct browser requests and can fail because of CORS, network access, or incomplete public records. The interface preserves provenance, requires review for imported/OCR values, and offers pasted/manual entry fallbacks; CI uses mocked lookup/parser tests and does not require remote data.
- Image/video OCR runs locally in the browser after the user selects a file. Social intake accepts only user-supplied captions, screenshots, or local video frames; MyHub does not log in, scrape, or bypass platform restrictions.
- Study blocks can be dragged between week columns, but drag-and-drop is never required: the edit form and labeled keyboard-operable resize buttons remain available.
- Supabase uses optimistic document revisions. If two devices change the same stale revision before either refreshes, MyHub stops the stale write instead of silently overwriting the newer encrypted copy.

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

Domain tests cover recipe scaling, fraction formatting, safe unit normalization/conversion, meal consumption and leftovers, nutrition-label parsing, mocked Open Food Facts lookup/failure fallback, deterministic recipe imports and suggestions, grocery aggregation and pantry decisions, long-horizon and avoid-time scheduling, ICS recurrence/classification/deduplication, encrypted calendar snapshots, large GitHub Contents files, Supabase private-link encryption and revisions, IndexedDB persistence, and backup validation. Browser tests cover food authoring/review/planning/consumption, pantry and grocery lifecycle, homework/subtasks/provenance, event CRUD, confirmed multi-file imports, study-block pointer and keyboard editing, populated dashboard ordering, all 6 universal-search collections, plaintext backup recovery, and provider-level cross-device sync from a private link through Supabase to GitHub backup. Final release counts are recorded in `REQUIREMENTS_AUDIT.md` after the complete matrix runs.

## GitHub Pages Deployment

The workflow at `.github/workflows/pages.yml` runs on pushes to `main` and can also be started manually. It installs dependencies, checks formatting, runs linting, strict type checking, unit tests, the complete Playwright Chromium matrix, and a production build. That matrix contains desktop, tablet, and mobile projects. The workflow then uses the current GitHub Pages artifact workflow with least-privilege `pages: write` and `id-token: write` permissions.[2]

In the repository, choose **Settings → Pages → Build and deployment → GitHub Actions** if it is not already selected.

## Data Storage

Structured data is stored immediately in IndexedDB under the current browser profile and origin. When the private access link is used, the browser also pushes a client-encrypted AppData document to Supabase and keeps the encrypted GitHub snapshot as backup history. A fresh installation starts with empty personal collections until it opens the private link.

Use **Settings → Data & privacy → Export data** to download a portable JSON backup. Import validates and migrates the MyHub backup envelope before replacing local data. **JSON exports are plaintext** and may contain private academic and food records.

## Encrypted Supabase Sync and GitHub Backup

IndexedDB remains the immediate offline cache. Supabase stores the live cross-device AppData document as AES-256-GCM ciphertext produced in the browser with PBKDF2-SHA-256 at 310,000 iterations. The database has Row Level Security enabled and grants no direct anonymous table access; a narrow Edge Function resolves an unguessable active record, checks a hashed write capability, and enforces monotonic optimistic revisions.[4][5] Supabase never receives readable recipes, academic records, calendar details, the private-link key, or the recovery passphrase.

GitHub remains the encrypted backup and calendar-ingestion source. MyHub uploads a versioned encrypted snapshot to the private `avicados14/MyHub-Data` repository at `myhub-data/v1/snapshot.enc`, using conditional blob-SHA writes and explicit conflict handling. The scheduled private-repository workflow continues to refresh the separately encrypted calendar snapshot.

When GitHub Sync is unlocked, Calendar can also consume an encrypted `myhub-data/v1/calendars.enc` snapshot through a narrow provider API. The calendar page never receives the token or passphrase: the provider fetches with the authenticated client and decrypts in memory. The page checks on open, offers an explicit refresh, and rechecks every 15 minutes while it remains open. Files larger than 1 MB use GitHub's authenticated raw media representation, as required by the Contents API.[3] A separate producer for that encrypted snapshot is not bundled with this static client.

The configured private repository and Supabase project have been verified end to end. The current encrypted data contains the 27 uploaded cookbook recipes as the only recipe records, 3,328 events reparsed from the 2 encrypted calendar feeds in `America/Denver`, zero homework assignments, eight normalized 8 oz chicken ingredients, and researched nutrition estimates for the four recipes that previously lacked values. The personalized settings and calendar workflow remain encrypted throughout.

The approved private access link is a revocable bearer capability. It contains only a random Supabase row ID and a high-entropy browser decryption/write key in the URL fragment—not readable user data or the GitHub token. URI fragments stay client-side rather than being sent with the page request.[6] Opening the link loads and decrypts the latest Supabase AppData automatically, configures the encrypted GitHub backup, removes the capability from the active address, and opens Home without a form, QR, code, or sign-in. Creating a replacement link revokes previous broker rows. Manual GitHub token and passphrase entry remains a recovery fallback.

Create a **fine-grained personal access token** limited to the single `MyHub-Data` repository with **Contents: read and write**. Do not use a classic PAT and do not grant workflow or administration permissions. The token is encrypted at rest in a separate IndexedDB credential record; it is never part of `AppData`, JSON backups, source code, logs, or remote plaintext.

The GitHub target must be private. Browser integration tests verify private-repository enforcement, encrypted Supabase payloads, cross-device revision propagation, and ciphertext-only GitHub writes. Deleting the latest GitHub snapshot cannot guarantee erasure from Git history, forks, caches, or GitHub retention.

## Clearing Data

Open **Settings → Data & privacy**, export anything you want to keep, and choose **Clear all data**. MyHub asks for explicit confirmation and restores empty personal collections while retaining reasonable non-personal defaults. The GitHub connection is not deleted; pause/unlink it separately, and use the explicit remote-delete control if needed.

## Repository Structure

```text
src/app/           Application shell, routes, and persistent state provider
src/components/    Reusable accessible UI primitives
src/domain/        Portable models and deterministic business logic
src/features/      Dashboard, calendar, school, food, pantry, grocery, settings
src/storage/       IndexedDB and backup boundary
src/styles/        Semantic tokens and responsive layouts
src/utilities/     Date, identity, and asset helpers
supabase/          Versioned RLS migrations and the narrow encrypted-document Edge Function
tests/             Playwright browser acceptance tests
public/recipes/    Original local recipe photography
.github/workflows/ Validation and GitHub Pages deployment
```

## Future iOS App

The future Apple application will reimplement the proven workflows using SwiftUI instead of wrapping this website in a WebView. The TypeScript domain models, invariants, calculation fixtures, and JSON backup format are the initial interoperability contract. See `MYHUB_IOS_PLAN.md`.

## Privacy

MyHub has no advertising, behavioral analytics, trackers, accounts, or marketing software. Core calculations stay in the browser. Supabase and GitHub receive client-encrypted records only. A user-initiated Canvas feed request goes directly from the browser to the provided URL; if the request is blocked, MyHub uses the encrypted private-repository calendar path rather than an unknown proxy.

Exported JSON backups can contain private academic and food records. Store them accordingly. Do not commit personal backup files or private feed URLs.

## Known Limitations

GitHub Pages is static hosting, so the private access link is a bearer capability rather than an account session. Anyone who obtains that link can open MyHub until it is replaced; keep it in a password manager or private bookmark. The browser necessarily holds decrypted AppData and backup credentials while active, so a compromised browser runtime can access them. Optimistic Supabase revisions prevent stale silent overwrites but may require reopening the private link if two devices edit concurrently. IndexedDB can be cleared by browser or device storage management, but the encrypted Supabase document and GitHub backup remain recoverable through the private link.

## Roadmap

1. Validate and refine the complete web workflow.
2. Improve imports through explicit secure adapter boundaries.
3. Freeze approved data contracts and interaction behavior.
4. Build native iPhone and iPad interfaces in SwiftUI.
5. Add EventKit, camera, Vision, share-extension, and synchronization adapters only after the native foundation is approved.

## References

[1]: https://vite.dev/guide/static-deploy.html 'Vite: Deploying a Static Site'
[2]: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages 'GitHub Docs: Using custom workflows with GitHub Pages'
[3]: https://docs.github.com/en/rest/repos/contents 'GitHub REST API endpoints for repository contents'
[4]: https://supabase.com/docs/guides/database/postgres/row-level-security 'Supabase: Row Level Security'
[5]: https://supabase.com/docs/guides/functions 'Supabase: Edge Functions'
[6]: https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment 'MDN: URI fragment'
