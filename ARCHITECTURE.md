# MyHub Architecture

## Architectural Summary

MyHub 0.1.0 is a static React and TypeScript application with local IndexedDB persistence. The architecture separates the interface, business rules, persistence, and external integration boundaries so that a future backend or native client does not require the core product behavior to be reinvented.

```text
React feature screens
        ↓
Application data provider and commands
        ↓
Pure TypeScript domain functions
        ↓
Typed IndexedDB, migration, and backup boundary

        ↓ optional
GitHubSyncProvider → Web Crypto → private GitHub Contents API

External sources → adapter boundary → reviewed local records
```

The Vite production base is `/MyHub/` in GitHub Actions and `/` in local development. `HashRouter` makes deep application routes safe on static GitHub Pages without rewrite rules.[1]

## Frontend Architecture

`AppShell` owns the responsive navigation, universal search, local-storage status, route viewport, and keyboard skip link. Desktop uses a persistent sidebar. Tablet uses an accessible off-canvas sidebar. Mobile uses a labeled bottom navigation and intentionally changes dense weekly layouts into vertical task flows.

Feature routes are lazy-loaded. Each route composes shared primitives from `src/components/ui.tsx` and reads or updates application state through `AppContext`. Feature screens do not open IndexedDB directly.

The design system uses semantic CSS variables. Raw colors are mapped to roles such as canvas, surface, ink, line, study, meal, attention, success, and danger. The visual direction combines a deep navy frame, mineral blue, pale mint, butter yellow, soft lilac, and restrained pink. Cards use different radii and elevation by hierarchy rather than applying one generic card style everywhere.

The Home schedule is intentionally a compact context window rather than a full-day agenda. A pure selector identifies the most recent completed commitment, every currently active commitment, and the next upcoming commitment. The card gives its current-time rule the middle grid row and limits surrounding items so its height matches the adjacent priority card on desktop. The complete schedule remains available through Calendar.

## Domain Modules

### School

The school domain contains `CalendarEvent`, `HomeworkAssignment`, `HomeworkSubtask`, and `StudySettings`.

Calendar imports are a local adapter boundary. A user may select one or more local `.ics` exports, choose a source type and date window, inspect a per-feed preview, and explicitly confirm before events, Canvas-style assignments, and feed status are written to `AppData`. UTC values and source `TZID` wall times are converted through the saved `calendarTimeZone` IANA zone before local date/time fields are persisted; recurrence instances retain their source wall time so conversion remains DST-aware. Import identifiers are stable for a source feed and event UID, so re-importing updates imported records without duplicating them. Canvas assignment URLs are mapped to homework with source label, URL, feed ID, external UID, and import time; subsequent imports retain user-managed progress, status, and subtasks. The browser test suite creates its minimal calendar upload in memory rather than keeping a real export in the repository.

Homework is an editable, persisted record with status, progress, priority, estimated time, source metadata, and subtask CRUD. Event and homework links are accepted for display only when they are `http` or `https`, and external links use `noopener noreferrer`. Events can be edited or deleted through forms. Generated study blocks also have direct week-column drag movement, form editing, and labeled keyboard-operable 15-minute resize controls; these are alternatives, not prerequisites, for modifying the schedule.

The deterministic study planner performs these steps:

1. Rank incomplete assignments by due date, then priority, then stable identifier.
2. Calculate remaining work from the estimate and progress.
3. Subtract existing study time for the assignment.
4. Search each available day between the configured earliest and latest study times.
5. Reject intervals that overlap calendar events or preserved study blocks.
6. Allocate chunks no longer than the configured default or maximum duration.
7. Preserve the configured break after each planned block.
8. Return both blocks and any minutes that could not fit.

Completed, locked, or manually adjusted study blocks are preserved when the user regenerates a plan. The planner considers configured avoid-time ranges as synthetic conflicts and searches from today through an assignment deadline, subject to a five-year safety bound. The current web interface exposes explicit buttons and forms instead of making drag-and-drop the only input method.

### Food

A recipe stores its original yield and ingredients. Scaling is always derived as:

```text
scale factor = requested servings / original yield
```

The base recipe is never repeatedly multiplied, which avoids accumulated rounding drift. Unquantified ingredients such as “salt to taste” stay unquantified. Common cooking fractions are formatted at the display edge.

Recipes have structured metadata, source/provenance, notes, review state, a persistent current yield, and per-ingredient overrides that apply at an explicit yield. The measurement catalog normalizes compatible US/metric volume, mass, count, and temperature units; display conversion occurs at the recipe detail edge and never mutates source quantities.

Food-log entries and meal entries store immutable source and nutrition snapshots. Later recipe or packaged-food edits therefore do not rewrite historical nutrition or planned-meal facts. Planned, prepared, and consumed servings remain separate. Adding a recipe to the plan initializes consumption at zero; only an explicit consumed-serving edit updates daily nutrition. Remaining servings cannot become negative, and remaining prepared recipe servings create or update reusable leftover records. Packaged-food records can be entered manually or seeded from a reviewed read-only lookup or label draft.

### Pantry and Grocery

Grocery generation first selects persisted meals in the remaining Sunday-to-Saturday planner week. Historical and later-week meals are excluded. Recipe requirements use the greater of planned and prepared servings, then apply the same explicit yield-specific ingredient override shown on the recipe page. Each active list and completed history record persists its start date, end date, and source meal IDs. Aggregation remains conservative: it combines only matching canonical ingredient names with compatible units. The conversion table normalizes supported mass, volume, and count aliases within their respective families; cooked-versus-dry, custom-unit, and ambiguous cross-family quantities remain separate until the user resolves them.

Pantry Check records the user’s decision for every requirement, including each staple the user explicitly adds. Generating a list does not silently subtract inventory. A completed trip is copied into an immutable history record. Purchased items enter the pantry only through an explicit post-trip action; the default adds checked purchases, while the detailed handoff requires an explicit selection for any unchecked item.

## Data Model

All persistent records use stable string identifiers, ISO timestamps, and explicit source labels. Local calendar dates and meal dates use `YYYY-MM-DD` so they do not shift across midnight because of UTC conversion.

The main aggregate is `AppData`:

| Area        | Records                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| School      | Calendar events, multiple calendar feeds, homework assignments, subtasks, study settings, avoid-time ranges                                   |
| Food        | Recipes, packaged foods, ingredients, steps, immutable meal-source snapshots, leftovers, food-log snapshots, eight-field nutrition provenance |
| Inventory   | Pantry items, active grocery list, immutable grocery history                                                                                  |
| Preferences | Appearance, measurement system, IANA calendar display zone, nutrition targets, meal-planning mode/preferences, grocery categories/staples     |

`AppData.schemaVersion` is currently `2`. `migrateAppData` explicitly transforms schema version 1 state and backup data into version 2, adding durable defaults and immutable snapshots without removing legacy records. Unknown future schema versions are rejected. The backup envelope adds its own `formatVersion`, application version, and export timestamp.

## Persistence

`src/storage/database.ts` owns IndexedDB access. Feature modules cannot depend on the browser database API. The current implementation persists one transactionally replaced application aggregate in the `application` object store. This keeps connected state coherent during Phase 1 and leaves a clear migration path to indexed aggregate stores if data volume or query complexity grows.

Missing state produces an empty version 2 aggregate with non-personal defaults; production code contains no demo seed path. Test samples live only in `src/test/fixtures.ts`. Persistence errors are announced in an accessible live region. JSON imports validate and migrate the backup before replacement. The exported backup is explicitly plaintext.

The `credentials` object store is separate from the `application` store. Its GitHub record contains repository coordinates, sync metadata, and a Web Crypto encrypted token envelope. A second record holds the private Supabase row ID and high-entropy client capability for automatic reconnect on later visits from that browser. Neither record is nested in `AppData`; both are excluded from plaintext JSON backups and encrypted AppData documents.

IndexedDB is origin-and-browser-profile scoped, so a new device begins without credentials. The approved transfer boundary is a revocable private URL containing a random Supabase row ID and client key in the fragment. The receiving route resolves encrypted credentials and encrypted AppData from the Edge Function, decrypts them locally, removes the capability from the active address, persists the browser capability, verifies the private GitHub backup repository, and opens Home. Later ordinary visits on that browser resolve the latest Supabase revision automatically.

## Encrypted Supabase Primary Sync and GitHub Backup

`GitHubSyncProvider` is nested inside `AppProvider`, so IndexedDB remains authoritative for immediate/offline interactions. The provider uses PBKDF2-SHA-256 with 310,000 iterations and a random 16-byte salt to derive AES-256-GCM keys. Every envelope receives a random 12-byte IV, versioned algorithm metadata is authenticated as additional data, and authentication failure rejects a wrong key or any tampering.

Supabase stores the live encrypted AppData document. Row Level Security denies direct anonymous table access. The `myhub-private-access` Edge Function is the only browser-facing broker: creation verifies that the supplied GitHub token can access the expected private repository, revokes earlier active rows, hashes the write capability, and stores encrypted credentials plus encrypted AppData. Resolve returns ciphertext for an unguessable active ID. Push requires the hashed capability and the expected revision, then increments the version atomically so stale devices cannot overwrite newer data silently. The browser checks for a newer revision on focus and pushes local changes after a short debounce.

`GitHubContentsClient` uses GitHub's REST Contents API against the default private target `avicados14/MyHub-Data` and `myhub-data/v1/snapshot.enc`. It checks repository privacy, conditionally creates or updates using the blob SHA, serializes writes, and surfaces 409/422 write races as conflicts. Files up to 1 MB use the normal base64 response. Files between 1 MB and GitHub's 100 MB Contents limit use a second authenticated raw-media request with browser caching disabled, because the object representation returns `encoding: "none"` for that range.[3] The sync state machine is `disconnected`, `locked`, `connecting`, `syncing`, `current`, `offline`, `conflict`, or `error`. A SHA plus last-synced plaintext digest identifies one-sided changes; divergent changes require an explicit **Use this device** or **Use GitHub** action.

This static Pages architecture uses a repository-limited fine-grained token for the backup. It never requests workflow or administration scopes and does not recommend classic PATs. The private link is a bearer capability: possession grants browser-side decrypt and write authority until a replacement link revokes earlier Supabase rows. Remote GitHub deletion removes the latest path but cannot guarantee removal from Git history, forks, caches, or provider retention.

The calendar feature has a deliberately narrow, read-only companion adapter for `myhub-data/v1/calendars.enc`. When Sync is unlocked and active, `GitHubSyncProvider` fetches that encrypted object and decrypts it in provider memory; the calendar screen receives only capability methods and parsed results, never the token or passphrase. It can check at open, on explicit request, and every 15 minutes while open. The companion private repository refreshes this ciphertext from its encrypted GitHub Actions secrets. The public static client does not embed feed URLs or calendar data and reports a locked, paused, missing, or malformed snapshot explicitly.

## Integration Boundaries

GitHub Pages cannot hold secrets or provide a private proxy. External features therefore follow four rules:

1. Core behavior must still work manually.
2. User input and provenance must be preserved.
3. Failure must be explicit and actionable.
4. Missing values must never be fabricated.

Canvas supports a direct best-effort ICS URL request and a reliable local `.ics` file import. The multi-file Calendar importer is the preferred reviewed path for Canvas, Google Calendar, and standard ICS exports; feed URLs, private exports, and user calendar content are never bundled as fixtures.

Recipe URL extraction requests only public Schema.org Recipe JSON-LD directly from the browser and exposes a pasted-content fallback when CORS or network access fails. Schema.org sugar and saturated-fat values are retained with the other six nutrients. Image and local video-frame OCR use a lazily loaded browser worker, then pass text to the deterministic parser; imported recipes remain **Needs Review** until a user confirms them. If every saved recipe is review-marked, deterministic meal suggestions use those records with an explicit warning rather than making the planner unusable. The personalized late-day preference assigns 13% of target calories/protein to breakfast and lunch and 87% to dinner and snack when scoring suggestions. Social intake accepts user-supplied captions, screenshots, or local video frames and does not scrape or bypass platform restrictions.

Nutrition carries calories, protein, carbohydrates, fat, sugar, saturated fat, fiber, and sodium through package/database import, label OCR, recipe estimates, meal-source snapshots, food logs, settings, and progress views. Historical records without sugar or saturated fat safely contribute zero rather than inventing values. The encrypted personal snapshot may carry documented ingredient estimates; provenance identifies those values as estimates and preserves material ingredient/brand assumptions instead of presenting them as laboratory results.

The read-only Open Food Facts adapter requests a limited product field set from the browser. Packaged-food authoring and food logging both support submit-triggered text search as well as UPC/EAN lookup. Search results are marked estimated and require confirmation before use. Nutrition-label OCR likewise runs locally, warns on missing fields, and requires review. All of these adapters have manual entry paths and mocked/parser tests, so the automated suite does not depend on live remote data.

## Historical Snapshots

Meal entries, food logs, and grocery history store copies of the relevant facts at the time of the action. Editing a recipe or packaged food later does not alter a planned/logged meal or completed grocery trip. This rule must remain true in future web migrations, backend APIs, and SwiftData models.

## Testing Strategy

Vitest validates pure domain functions and IndexedDB behavior. The suite covers recipe scaling, fraction formatting, nutrition sums, prepared/consumed meal and leftover updates, unit normalization/conversion, deterministic recipe and label parsing, mocked Open Food Facts lookup/failure handling, grocery aggregation and pantry decisions, due ordering, long-horizon conflict-aware study planning with avoid-time ranges, ICS parsing/classification/provenance/deduplication, encrypted calendar snapshots, persistence, and backup validation.

Playwright runs critical workflows in Chromium at desktop, tablet, and mobile sizes with semantic role and label locators. Focused suites cover structured recipe review/editing, planned-versus-consumed nutrition, pantry and grocery lifecycle, homework/subtasks/provenance, event CRUD, reviewed multi-file ICS imports, keyboard-operable study resizing, populated dashboard ordering, universal-search navigation, and backup recovery. Provider-level sync tests intercept GitHub and Supabase requests; they verify private-repository enforcement, direct one-link phone access, ciphertext-only broker records, optimistic Supabase writes, cross-device focus refresh, ordinary-URL revisit restoration, encrypted GitHub backup, conflict choices, unlink, and remote deletion without live credentials.

The Playwright launcher selects an available loopback port for local runs so concurrent worktrees do not collide. CI uses deterministic port `4287`. The workflow invokes the unfiltered `npm run test:e2e` command, which executes all 3 viewport projects before deployment. The final integrated branch passed 100 Vitest tests in 20 files and 126 Playwright tests. A separate 42-action exploratory run exercised every primary route and found no console errors, page exceptions, failed HTTP responses, or page-level overflow. A real Chromium session also connected to the private repository, decrypted 27 recipes and 2 calendar feeds, imported 3,328 corrected events, and verified encrypted write-back.

## Backend Boundary

Supabase is intentionally narrow: it stores opaque encrypted documents and enforces access/revision rules. It does not parse or inspect MyHub data. Future account-backed sign-in, secure recipe extraction, or credentialed nutrition adapters should use separate documented endpoints without coupling transport details into the domain layer.

## Future iOS Architecture

The native app will be a SwiftUI implementation, not a WebView. The web shell maps conceptually to `NavigationSplitView` on iPad and `TabView` plus `NavigationStack` on iPhone. Focused edits map to sheets and confirmation dialogs. The business rules should be reimplemented against golden fixtures using `UUID`, `Decimal`, explicit local-date types, and versioned `Codable` payloads.

EventKit, SwiftData, Vision, PhotosPicker, AVFoundation, Share Extensions, App Groups, CloudKit, and any private backend are native or server adapters. They must not leak into shared domain semantics.

## References

[1]: https://vite.dev/guide/static-deploy.html 'Vite: Deploying a Static Site'
[2]: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages 'GitHub Docs: Using custom workflows with GitHub Pages'
[3]: https://docs.github.com/en/rest/repos/contents 'GitHub REST API endpoints for repository contents'
