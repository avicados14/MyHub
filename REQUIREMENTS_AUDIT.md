# MyHub Requirements Completion Audit

**Audit synthesis date:** 22 September 2026  
**Repository baseline reviewed:** `6d56981` on `main`  
**Deployment reviewed:** [GitHub Pages production application][4]  
**Scope:** Web-phase implementation and the deliberately deferred native handoff. This report originally synthesized seven supplied domain audits; the foundation status below was updated after implementation and fresh repository quality-gate execution on the current branch.

> **Foundation update — 22 September 2026:** MyHub now starts with empty personal collections, migrates schema-v1 local data and backups to schema v2, and provides optional client-side encrypted synchronization to the dedicated private `avicados14/MyHub-Data` repository. This establishes durable models and security/sync boundaries without claiming that all packaged-food, leftover, avoid-time, meal-mode, staple, or multiple-feed workflows are complete in the UI.

## Executive assessment

**MyHub is a credible, deployable local-first Phase 1 web application, but it is not complete against the requested web specification.** Its strongest delivered capabilities are the responsive React application shell, IndexedDB persistence and portable backup, calendar and deterministic study scheduling, basic recipe/meal/grocery workflows, pantry inventory, documentation, and Pages deployment. The foundation is materially stronger than a prototype mockup: user actions mutate persisted data, the repository is clean and deployable, and baseline lint/type/unit/build checks passed during the supplied audits.

The main completion blockers are not cosmetic. The application lacks the required packaged-food and nutrition-label workflow; the meal planner cannot record consumption or manage leftovers; recipe importing/editing and measurement conversion are incomplete; configured meal-planning and grocery settings are absent; and several critical browser workflows are untested. The declared all-viewport Playwright command is also not yet a dependable release gate. One supplied audit records 18 tests passing, while other audits record `npm run test:e2e` failures after the shared Vite server became unavailable (8/18 or 15/18 passed, depending on the run); isolated desktop, tablet, and mobile runs passed. This conflict should be resolved in CI rather than treated as proof of a clean responsive acceptance suite.

A new requirement for **GitHub-backed user-data persistence** should not be met by committing plaintext personal data to the existing public source repository. It requires an opt-in, private, encrypted, authenticated data-store design with an appropriate server-side authentication boundary, conflict handling, revocation, and recovery decisions. It is therefore a material architecture increment, not a small storage adapter.

| Readiness dimension | Assessment | Determining evidence |
| --- | --- | --- |
| Functional web baseline | **Delivered** | Routed React screens change and persist state; IndexedDB, export/import/reset, dashboard, calendar, school, food, grocery, and pantry are real interfaces. |
| Deployment and repository hygiene | **Delivered** | GitHub Pages workflow, public HTTP 200 deployment, clean Git baseline, source docs, tests, and `.gitignore` are present. |
| Required web-domain breadth | **Partial** | Core flows work, but recipes, meal consumption/leftovers, packaged foods, settings, staples, and several integrations do not meet the specified scope. |
| Quality gate and responsive evidence | **Partial / release risk** | Lint, strict type checking, 11 Vitest tests, and production build passed; the combined browser matrix is flaky and CI covers desktop only. |
| Accessibility | **Partial** | Strong semantic foundation and axe coverage; the custom search dialog lacks focus trapping, focus restoration, and keyboard regression tests. |
| Privacy and security baseline | **Good local-first baseline** | No tracked secrets, trackers, accounts, ads, or backend were found; backup files are not encrypted and the proposed GitHub synchronization changes the threat model. |
| Native iPhone/iPad work | **Correctly deferred** | The repository documents a real SwiftUI handoff rather than faking a native/WebView deliverable. |

> **Status vocabulary:** **Delivered** means the supplied audit found a real, persisted, testable implementation. **Partial** means material functionality exists but misses required behavior, scope, or dependable proof. **Missing** means no executable user-facing capability was found. **Deferred native** means intentionally postponed by the web-first gate and is not represented as delivered.

## Section-by-section matrix: web-phase requirements

### Foundation, deployment, data, and documentation

| Requirement | Status | Completion assessment and traceable evidence |
| --- | --- | --- |
| §3 Functional web-first deliverable | **Delivered** | Routed React screens perform state changes; `AppContext.tsx` and `storage/database.ts` hydrate and save the aggregate. |
| §4 Architecture | **Delivered** | Static-first React/TypeScript/Vite separation of app/features, domain logic, and storage is documented in `ARCHITECTURE.md`. |
| §5 Repository/source control | **Delivered** | The origin-backed repository contains source, docs, tests, assets, workflow, meaningful history, and an audit-clean baseline. |
| §§6, 57 Phase 1 foundation | **Delivered, later web phases partial** | The stated Phase 1 architecture is in place; deferred integrations and incomplete acceptance evidence prevent a broader “all web phases complete” conclusion. |
| §§7–10 Documentation | **Delivered** | `README.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `MYHUB_WEB_SETUP.md`, and `MYHUB_IOS_PLAN.md` provide setup, architecture, limits, changelog, and native handoff. |
| §§11–12 Pages deployment | **Delivered** | `pages.yml` validates/builds/deploys with official Pages actions; `vite.config.ts` uses `/MyHub/`; the production URL returned HTTP 200 in audit. |
| §13 Local persistence and recovery | **Delivered** | IndexedDB storage, validated JSON export/import, reload persistence, and confirmed reset are implemented and unit-tested. |
| §49 Conceptual data model | **Delivered foundation; workflows partial** | AppData v2 includes `PackagedFood`, `Leftover`, nutrition provenance, immutable meal-source snapshots, avoid-time ranges, meal-planning preferences, grocery categories/staples, and multiple calendar feeds. Several user workflows remain later work. |
| §50 Historical snapshots | **Delivered foundation** | Food logs, meals, and grocery history preserve immutable source/nutrition facts; v1 meal/log data gains snapshots during migration. |
| §53 Scope discipline | **Delivered** | Navigation, dependencies, and features remain within requested planning/food domains; prohibited finance, social, health, advertising, and account features were not found. |
| §§70–71, 73 Security/privacy baseline | **Delivered with gaps below** | No tracked secrets, `.env` files, trackers, accounts, ads, or backend/proxy were found. Canvas and local-only behavior are candidly disclosed. |
| §§75–76 Repository and web handoff | **Delivered, documentation detail partial** | Required source/docs/tests/workflow/data-transfer artifacts are present and clone/run/deploy works. The README should add the production Pages URL and explicit release-state handoff. |
| New: GitHub-backed user persistence | **Delivered foundation** | Optional encrypted GitHub Contents sync retains IndexedDB, enforces private repos, separates encrypted credentials, uses conditional SHA writes, surfaces conflicts, and exposes pause/unlink/delete controls. |

### Dashboard, navigation, responsive design, search, and settings

| Requirement | Status | Completion assessment and traceable evidence |
| --- | --- | --- |
| §14 Original visual design | **Delivered** | The navy sidebar, time-aware heading, card system, restrained accents, responsive layouts, and rendered screenshots evidence a distinct, polished UI. |
| §15 Responsive behavior | **Delivered** | Desktop sidebar, tablet drawer, and labeled five-item mobile bottom navigation are implemented; live checks opened Pantry, Settings, and mobile search. |
| §16 Navigation | **Delivered** | Home, Calendar, School, Food, Grocery, Pantry, and Settings are real routes; School and Food have functional subviews. |
| §17 Dashboard command center | **Partial** | Greeting, sorted schedule/homework, planned meals, five nutrition metrics, and week-ahead links work. A dedicated Today’s Study Plan, explicit empty snack state, and sodium progress are absent. |
| §48 Universal search | **Partial** | The keyboard-accessible search finds recipes, assignments, and pantry items. It does not search meal plans, grocery history, or packaged foods. |
| §51 Empty production data | **Delivered** | Fresh install and confirmed Clear all data produce empty user collections. Samples are isolated to `src/test/fixtures.ts`; reasonable non-personal defaults remain. |
| §52 Settings | **Partial** | General, study, calendar, nutrition, data, and GitHub Sync controls persist. Durable meal-planning, grocery staple/category, and avoid-time models exist but their editors remain future UI work. |
| §54 Failure/recovery behavior | **Partial** | Canvas CORS/file fallback and backup-validation failures are clear. Recipe URL/social import and packaged-food lookup/label paths are not implemented, so their specified fallbacks cannot be used. |
| §56 Accessibility | **Partial** | Semantics, labels, skip link, focus styling, native dialogs, live announcements, reduced motion, and axe A/AA route checks are present. The custom search overlay has no focus trap or focus-return behavior. |
| §58 Acceptance evidence | **Partial** | Many actions work and some smoke workflows are automated. The complete end-to-end chain and a reliable desktop/tablet/mobile matrix are not proven. |
| §77 Reference-image process | **Partial** | The outcome is original and visually appropriate, but the repository does not document that both supplied reference images were inspected before implementation. |
| §78 Web-first delivery | **Delivered** | The responsive, local-first React app is deployed and the native translation remains expressly gated. |

### Calendar, homework, Canvas, and study planning

| Requirement | Status | Completion assessment and traceable evidence |
| --- | --- | --- |
| §18 Calendar | **Delivered** | Day/week/month views, persisted manual events, mixed normal/study display, week default, and the three named demo events are present. |
| §19 Device calendar access | **Deferred native** | Apple Calendar/EventKit and configured device calendar access are correctly planned as native work. |
| §20 Homework management | **Delivered** | Persisted homework supports add/edit/delete, course, due date/time, priority, estimate, notes, status/progress, source label/URL, and subtask add/edit/toggle/delete controls. Imported records display provenance and preserve user progress/subtasks on re-import. |
| §21 Canvas import | **Delivered for local exports; direct-feed refresh remains best effort** | Calendar accepts reviewed multi-file local Canvas, Google Calendar, and standard ICS exports with source type/date-window preview and explicit confirmation. The parser retains event metadata/provenance, maps Canvas-style assignment URLs to homework, and deduplicates by stable source identifiers. Direct Canvas URL refresh remains subject to browser CORS and has a file-import fallback. |
| §22 Study planner | **Partial** | Deterministic scheduling respects incomplete work, priority, due date, conflicts, settings, breaks, locks, duration bounds, and persisted avoid-time ranges. It now searches through deadlines with a five-year safety bound rather than a hidden 14-day horizon. Avoid-time range editing remains absent from Settings. |
| §23 Study settings | **Partial** | Earliest/latest times, default/max durations, and breaks persist. Avoid-time ranges are stored and enforced by the planner, but lack a dedicated configuration editor. |
| §24 Study editing | **Delivered** | Study blocks can be form-edited, locked/unlocked, deleted, completed, regenerated with preservation of manual changes, dragged between week columns, and resized with labeled keyboard-operable 15-minute controls. |

### Recipes, measurements, nutrition, and non-AI behavior

| Requirement | Status | Completion assessment and traceable evidence |
| --- | --- | --- |
| §25 Recipe library and editing | **Partial** | Manual creation, library/search/favorites, ingredients, steps, scaling baseline, and persisted recipes work. Editing, ingredient overrides, notes, current-yield persistence, meaningful source/image/tag/nutrition authoring, and a visible review workflow are absent. |
| §26 Web recipe imports | **Missing** | No URL/JSON-LD, pasted-text parser, image/OCR, or Instagram/caption/screenshot/video/copied-text intake exists. README accurately calls adapters unconnected. |
| §27 Native sharing intake | **Deferred native** | A legitimate reviewable Share Extension direction is documented, with no premature native implementation. |
| §28 Scaling | **Partial** | Pure deterministic scaling and fraction display are correct and tested. Individual ingredient overrides and persisted desired/current yields are absent. |
| §29 Measurements | **Partial** | A persisted US/metric preference exists, but no canonical catalog, compatible US/metric conversion, preference-aware rendering, or temperature conversion exists; only oz/lb is normalized for grocery aggregation. |
| §30 Nutrition | **Partial** | Six metrics, totals/targets, and snapshots work; schema v2 adds explicit provenance and estimated status. Lookup/estimation and full provenance editing remain absent. |
| §45 AI enhancements | **Deferred / not delivered** | Basic arithmetic remains safely deterministic and tested. No AI parsing, extraction, suggestions, observations, or complex scheduling capability is implemented. |

### Meal planning, food logging, packaged foods, pantry, and groceries

| Requirement | Status | Completion assessment and traceable evidence |
| --- | --- | --- |
| §31 Weekly meal planner | **Partial** | Local week grid has breakfast/lunch/dinner/snack slots, saved-recipe selection, servings, replacement, removal, and persistence. Packaged foods, move/copy, and accessible drag-and-drop alternatives are absent. |
| §32 Prepared versus eaten servings | **Partial** | Model stores prepared/consumed counts and shows the non-negative balance. UI hard-codes consumed servings to zero and cannot record consumption. |
| §33 Leftovers | **Partial** | Remaining servings are calculated, but there is no leftover inventory/record, consumption tracking, picker, or later meal/log assignment. |
| §34 Food log | **Partial** | Saved recipes can create persistent nutrition-snapshot log entries and totals. Packaged/search/custom/label/leftover paths are absent. |
| §35 Daily nutrition | **Partial** | Six totals and editable targets are present, but remaining values are explicit only for calories and unimplemented log sources cannot contribute. Planned meals do not update nutrition until separately logged. |
| §36 Packaged foods | **Foundation only** | A durable `PackagedFood` entity with serving, barcode, nutrition, provenance, image, and notes exists. Package entry/search/label workflows remain missing. |
| §37 Nutrition-label OCR | **Deferred adapter / not delivered** | OCR is accurately documented as future; no upload, OCR, confirmation/review, or dependency exists. |
| §38 Pantry | **Partial** | Add/remove and required initial fields/locations work and persist. Existing inventory cannot be edited to correct quantity or metadata. |
| §39 Grocery generation | **Partial** | Planned recipe ingredients are scaled and aggregated; equal names and oz/lb work. Canonicalization and unit compatibility are narrowly limited. |
| §40 Pantry Check | **Partial** | All generated items are assessed with None, saved amount, and “I have enough.” Required Enter Amount is missing despite a dormant custom-decision type. |
| §41 Final grocery list | **Partial** | Categories, checkoff, and mobile controls work. Quantity edit, custom add, delete, and note edit are absent. |
| §42 Grocery history | **Delivered** | Trip completion deep-copies item data and UI shows completed date/name/count/status. |
| §43 Pantry handoff | **Partial** | Completion supports Add all, checked-item proxy, or skip. No real Select Items/quantities chooser exists; Add all includes unchecked items. |
| §44 Grocery staples | **Foundation only** | Version 2 stores structured staples and ordered category settings. Editing, suggestion, confirmation, and workflow tests remain missing. |
| §46 AI meal planning | **Deferred / not delivered** | No proposal engine, accept/regenerate/replace controls, or meal locking exists. |
| §47 Meal-planning modes | **Foundation only** | Version 2 persists Balanced, Variety, Meal Prep, Favor Leftovers, Minimize Waste, and Minimize Unique Ingredients modes plus preferences. Configuration and planning behavior remain future work. |

### Engineering quality, test evidence, and release practice

| Requirement | Status | Completion assessment and traceable evidence |
| --- | --- | --- |
| §55 Test coverage | **Partial** | Domain/storage unit tests and browser/axe tests exist. New focused coverage validates ICS classification/provenance/deduplication, encrypted calendar-snapshot parsing, long-horizon avoid-time planning, homework/subtasks/provenance, event CRUD, reviewed multi-file upload import, and keyboard resizing. Broader food, inventory, backup, and responsive-matrix coverage remains incomplete. |
| §56 Accessible interaction quality | **Partial** | See §56 above; command-palette keyboard containment and return-focus remain blockers. |
| §57 Phase completion record | **Partial** | Foundation/Home artifacts exist. README calls the product a functional Phase 1 web prototype; later web scope should not be implied complete. |
| §58 Full acceptance sequence | **Partial** | Workflows are present in pieces but lack one full, stable cross-viewport acceptance test. |
| §72 Formatting and quality gates | **Partial** | Strict TypeScript, no-unchecked indexed access, ESLint, reusable UI, tests, and build gates exist. No formatter/config/check script exists. |
| §74 Milestone quality gate | **Partial** | Main builds clean and Pages is live. All-browser command unreliability and desktop-only browser CI prevent full milestone certification. |

## Delivered capabilities

| Domain | Complete capability | Implementation significance |
| --- | --- | --- |
| Local-first data | IndexedDB aggregate persistence, reload survival, JSON export/import validation, confirmed replace/reset | User data actually persists without an account or backend. |
| Web delivery | Pages workflow with lint, type check, unit test, desktop browser test, build, artifact upload, and deploy | A standalone clone/run/deploy project exists rather than a mockup. |
| Application shell | Responsive routes, desktop sidebar, tablet drawer, mobile bottom nav, keyboard search, original visual system | The app is usable at the target layouts and contains real destinations. |
| Dashboard | Greeting, sorted schedule/homework, planned meals, nutrition progress, week-ahead links | Core command-center baseline is operational. |
| Calendar and school | Day/week/month views; event CRUD; explicit multi-file ICS preview/confirmation; Canvas-style homework provenance/deduplication; homework subtask CRUD; avoid-time-aware planning; study drag/form movement and keyboard resize | The scoped school workflow is persisted, source-aware, and covered by unit plus focused Chromium acceptance tests. |
| Recipes | Manual entry, library/search/favorite, servings scaling, recipe meal selection, basic nutrition arithmetic | A useful manual recipe baseline exists. |
| Pantry and groceries | Pantry add/remove, generated grocery list, pantry decisions, category/checkoff experience, immutable completed trip history | Grocery planning has a usable local baseline. |
| Privacy baseline | No discovered tracked secret, analytics/tracker package, account, ad, or backend proxy | Current local-only architecture limits collection and third-party disclosure. |
| Documentation | Setup, architecture, limitations, changelog, deployment, and native handoff documents | The project is legible to a new developer and candid about boundaries. |

## Partial features requiring completion

| Priority area | What works now | What prevents completion |
| --- | --- | --- |
| Browser release evidence | Isolated device projects have passed; desktop CI executes browser tests | Full multi-project run has failed in supplied audits because the server disappeared; CI does not protect tablet/mobile. |
| Dialog accessibility | Many semantic controls and axe checks are strong | Search dialog needs focus trap, focus return, Escape/Tab regression tests, and an open-dialog axe run. |
| Settings/configuration | Study, Canvas, nutrition, data controls persist; avoid-time ranges are stored and used by planning | Meal preferences, modes, leftovers/minimize-waste options, editable staples/categories, and an avoid-time editor are missing. |
| School source lifecycle | Manual and imported homework/events retain source links, provenance, stable IDs, and user-managed homework progress/subtasks across re-import | Direct Canvas feed refresh remains CORS-dependent; private snapshot production and live remote calendar acceptance are intentionally outside the static client. |
| Study planning | Conflict-aware, avoid-time-aware scheduling searches through deadlines; generated blocks support form editing, drag movement, and keyboard resize | A user-facing avoid-time editor and broader mutation/responsive coverage remain incomplete. |
| Recipe authoring | Basic manual creation and scaling work | No structured editor, notes, ingredient override, persistent current yield, provenance, review queue, or robust metadata authoring. |
| Measurements/nutrition | US/metric setting and six metrics exist | Preference does not alter output; catalog/conversions/temperatures, source/provenance, estimated states, and lookup are absent. |
| Meal lifecycle | Recipe slots and remaining-serving arithmetic exist | Consumption cannot be entered; leftovers have no inventory or reuse workflow; planned meals do not affect nutrition. |
| Food logging | Saved-recipe logging saves immutable nutrition facts | No custom, packaged, search, label, or leftover entry path. |
| Pantry/grocery management | Generation, Pantry Check, shopping, and history work | Pantry editing, Enter Amount, custom/edit/delete/note list actions, chosen purchase handoff, and broader unit matching are absent. |
| Demo and handoff | Most named samples and docs are present | Protein bar/pretzels are missing; README should state the live deployment URL/release state. |

## Missing features

| Missing requirement | Required implementation outcome |
| --- | --- |
| `PackagedFood` and nutrition-label workflow | Persisted packaged-food record, manual UPC/EAN/text and nutrition entry, optional image/label intake, review before save, logging, planning, and immutable snapshots. |
| Recipe import suite | Deterministic URL JSON-LD and pasted-text import first; then image/OCR and social media intake with provenance, review state, and manual caption/text/image/video fallback. |
| Recipe editor and notes | Full metadata and ingredient CRUD/override editor, notes, tags/image/source fields, desired/current yield, nutrition and provenance editing. |
| Grocery staples | Editable recurring staples/categories, surfaced before finalization, explicit per-item add/confirm, and tests proving staples never silently add. |
| Meal-planning modes | Persisted user configuration for Balanced, More Variety, Meal Prep, Favor Leftovers, Minimize Grocery Waste, and Minimize Unique Ingredients. |
| Avoid-time range editor | User-facing creation, modification, and deletion of the already persisted/enforced avoid-time ranges. |
| Formatting gate | Prettier or equivalent plus repository configuration and a CI-enforced `format:check` script. |
| Stable all-viewport browser gate | Reproducible desktop/tablet/mobile startup/isolation and a complete acceptance suite in CI. |
| GitHub-backed persistence beyond snapshot sync | Record-level merge/tombstones and a server-mediated GitHub App remain future hardening; the approved static Pages encrypted snapshot foundation is implemented. |

## Intentionally future native items

The web-first gate is being respected. These items should remain **deferred** until explicit web approval; they should not be represented as current web features or simulated with misleading controls.

| Requirement(s) | Deferred native capability | Proper future direction |
| --- | --- | --- |
| §19, §62 | Apple Calendar/EventKit access to device-configured calendars | Native EventKit adapter with explicit authorization, source selection, sync/error handling, and tests. |
| §27, §64 | Intake via Safari, Instagram, Photos, and other apps | Legitimate iOS Share Extension/App Group workflow that accepts supplied content and creates reviewable recipe drafts. |
| §37, §63 | Camera, barcode, package, Nutrition Facts, and recipe capture | AVFoundation/Vision/VisionKit/PhotosPicker pipeline with user review before persistence. |
| §§59–61 | Native SwiftUI iPhone/iPad application | Real `TabView`/`NavigationStack` phone UX and `NavigationSplitView`/multicolumn iPad UX, not a WebView wrapper. |
| §65 | Cross-device iPhone/iPad synchronization | Decide CloudKit versus a private shared backend after the web model and sync contract are accepted. |
| §§66–67 | Current private-distribution research | Re-run current Apple documentation research and create the requested comparison immediately before native testing/deployment. |
| §§68–69 | Backend/API for shared web+iOS use | Add only once a useful server-side responsibility is approved; document self-hosted/private ownership and data boundaries. |

## Security and privacy assessment

The present local-only application has a favorable initial privacy posture. Repository-level scans reported no tracked secret, environment file, analytics/tracker dependency, account system, advertising, or backend proxy. `.gitignore` protects environment patterns, GitHub Pages deployment uses least-privilege job permissions, and UI/documentation state that Canvas requests happen directly and may need a file fallback. These observations are meaningful, but they are not a substitute for continuous secret detection, dependency maintenance, or a remote-data threat model.

| Area | Current posture | Gap, risk, or required control |
| --- | --- | --- |
| Secrets | No credential-like assignments found in tracked files/history keyword scan | Add a dedicated secret scanner in pre-commit/CI and protect against accidental tokens in screenshots, fixtures, issues, and exports. A keyword scan cannot prove no secret ever existed outside accessible history or GitHub settings. |
| Data at rest | Browser IndexedDB is local; portable export/import exists | JSON backups likely contain school, food, Canvas-setting, and planning data in plaintext. Label exports sensitive, provide a save-location warning, and consider password-encrypted export before encouraging cloud storage. |
| Browser-local data | No accounts or third-party data processor were found | Document that clearing browser site data destroys local records unless exported. Test corrupt/malformed import, data migration, and recovery paths. |
| Canvas data | Direct request and CORS/file fallback are disclosed | Treat Canvas feed URLs and exported settings as sensitive. Do not log them, include them in public test fixtures, or transmit them through a future relay without explicit consent. |
| Accessibility/security boundary | Native dialogs and most semantic controls exist | Search overlay’s incomplete keyboard containment is an accessibility defect. Future sign-in/consent dialogs must use a tested focus-managed dialog primitive. |
| Dependencies and supply chain | Existing CI runs lint/type/tests/build | Add automated dependency vulnerability monitoring, lockfile review, and a documented update cadence; the supplied audits did not establish these controls. |
| Remote persistence | Opt-in encrypted GitHub snapshot sync and a read-only encrypted private-calendar snapshot adapter are implemented | The browser holds unlocked credentials/passphrase in memory for this advanced static-client design; record-level merge, live remote acceptance, producer tooling for calendar snapshots, and a server-mediated authorization model remain future hardening. |
| Public repository exposure | Existing source repo is public Pages deployment | Never place plaintext user data, backups, token material, or per-user identifiers in this repository, Pages artifacts, workflow logs, screenshots, or test reports. |

## New requirement: safe GitHub-backed user-data persistence

### Decision and boundary

**Recommended policy:** retain IndexedDB as the immediate offline working store and offer GitHub as an **explicitly enabled encrypted remote backup/synchronization target**, not as a replacement for local storage and not as a data folder inside `avicados14/MyHub`. Each user should authorize only a private repository chosen for their data, or a dedicated private repository created/selected during onboarding. The source repository and GitHub Pages artifact must never contain user records.

GitHub’s file-contents API is suitable for a small personal encrypted data artifact but is not a transactional database. Updating a file requires the current blob SHA, writes may return `409 Conflict`, and parallel create/update/delete operations conflict; uploads must therefore be serialized and conflict-aware.[2] GitHub Apps start with no permissions, and GitHub recommends selecting the minimum permissions needed; a selected private data repository with **Contents: read/write** is the narrowly appropriate baseline.[3]

A pure GitHub Pages single-page application cannot safely hold a confidential OAuth client secret. GitHub’s web authorization flow has a server-side token exchange that requires the client secret; it also recommends an unguessable `state`, PKCE using `S256`, and tightly controlled callback URLs.[1] Therefore, do **not** embed an OAuth secret, GitHub App private key, personal access token, refresh token, or write token in bundled JavaScript, IndexedDB, local storage, exports, Pages configuration, or CI logs.

### Viable implementation paths

| Approach | Tradeoffs | Cost/operational burden | Safety assessment |
| --- | --- | --- | --- |
| Continue local-only IndexedDB plus encrypted file export | No cross-device automatic sync; user chooses where to keep backups | Lowest; no service or GitHub authorization | Safest present option if users need portability only. Implement password-encrypted export before calling it cloud-safe. |
| User-managed private-repository backup using a fine-grained token entered for one session | Avoids operating a token-exchange service; poor onboarding and easy to misuse | Low infrastructure cost; high support/usability burden | Acceptable only as an advanced, opt-in bridge: scope to one private repo and Contents write, never persist the token, warn against classic broad tokens. Not recommended as the primary product UX. |
| **GitHub App plus thin server-side authorization/broker service** | Adds a small service, session handling, availability/security operations, and clear privacy notice | Moderate implementation/operations cost | **Recommended primary path.** GitHub App installation is constrained to the user-selected private repo; service keeps app credentials/tokens server-side and sends only encrypted payloads to GitHub. |

### Recommended architecture contract

| Layer | Required design |
| --- | --- |
| Local authority | Continue local IndexedDB as the responsive/offline store. Maintain an outbox and last-confirmed remote revision. A remote outage must not block planning, logging, or export. |
| Consent and repository selection | Make cloud sync off by default. Explain that GitHub will hold encrypted user data and version history. Require selection/creation of a **private** data repo and show the exact permissions before enabling. Reconfirm before changing repositories. |
| Authentication | Use a GitHub App with a short, server-mediated authorization flow. Bind state to a secure session, validate exact callback URL/state, use PKCE, and exchange codes only on the server. Use Secure, HttpOnly, SameSite session cookies; do not expose long-lived credentials to browser JavaScript. |
| Least privilege | Request only the selected repository’s Contents read/write permission. Do not request organization administration, workflows, broad `repo`, webhooks, user profile data, or access to the source repo unless a separate future need justifies it. GitHub documents that permissions determine what an app can access and recommends minimum permissions.[3] |
| Payload confidentiality | Serialize a versioned `AppData` envelope locally and encrypt it **before** upload with modern authenticated encryption. Derive/hold the decryption key so the GitHub repository and broker see ciphertext, not planning/food/school content. Store algorithm/version/salt/nonce metadata outside the ciphertext only as necessary. Do not claim end-to-end encryption until key recovery, device enrollment, and server access are independently reviewed. |
| Key and recovery policy | Require an explicit product decision: a user-held passphrase/recovery key provides stronger confidentiality but lost-key data is unrecoverable; a service-held recovery key improves recovery but weakens zero-knowledge privacy. Never silently choose recoverability. |
| Remote layout | Use a dedicated, private data repository and a versioned encrypted object path such as `myhub-data/v1/snapshot.enc`. Do not use the public app repo. Keep only encrypted payloads and minimal non-sensitive protocol metadata; avoid names/titles/dates in path, commit message, or branch names. |
| Synchronization | On sync, fetch revision/SHA, decrypt locally, merge record-level changes, encrypt, then conditionally write using the retrieved SHA. Serialize writes and handle 409 by refetching, presenting conflicts where automatic merge is unsafe, then retrying. This follows the API’s SHA and conflict contract.[2] |
| Conflict model | Give every entity a stable UUID, schema version, `updatedAt`, and tombstone/deleted timestamp. Merge independent records automatically; never silently discard two edits to the same record. Display a user-resolvable conflict for simultaneous field changes, especially nutrition, source data, and completed history. |
| Versioning/migration | Add explicit data schema migrations, forward-compatibility guardrails, backup-before-migrate behavior, and client/server protocol versions. Reject downgrade/unknown schema uploads without data loss. |
| Deletion and unlinking | Provide “pause sync,” “unlink GitHub,” “download encrypted backup,” and “delete latest remote snapshot” controls. Explain that Git history, forks, caches, and retention may prevent guaranteed historical erasure even for private repositories. |
| Logging and observability | Log only opaque request IDs, error classes, and operation timing. Redact repository names where possible; never log authorization codes, tokens, Canvas URLs, encrypted plaintext, or decoded records. Keep operational logs short-lived and access-controlled. |
| Reliability | Make sync explicitly visible: offline, queued, syncing, current, conflict, and error. Rate-limit retries with backoff; preserve local changes until a remote acknowledgement is recorded. |
| Verification | Add mocked API tests for authorization/session rejection, no-token persistence, encryption round-trip/tamper rejection, SHA conflict merge, offline queue/retry, revocation, migration, private-repo enforcement, and two-device conflicts. Add browser acceptance for consent, connect, backup, restore on another browser, unlink, and recovery failure. |

### GitHub persistence go/no-go criteria

| Gate | Must be true before enabling the feature |
| --- | --- |
| Privacy | Data repository is private, feature is opt-in, consent names GitHub as a processor/store, exports/sync status are understandable, and plaintext never reaches the source repo or logs. |
| Credential safety | OAuth/App secrets stay server-side; browser has no durable GitHub write token; callback/state/PKCE/session controls are tested. |
| Encryption | Encryption threat model, key recovery choice, tamper behavior, algorithm/version migration, and lost-key message are reviewed and tested. |
| Data integrity | Schema version, immutable history snapshot rules, conflict UX, conditional writes, retry queue, and remote rollback/restore work. |
| Access control | User can authorize one chosen private data repository with minimal Contents permission, inspect/revoke access, unlink, and delete current remote data. |
| Quality | Cross-browser/device E2E tests and failure simulations pass; no secret/PII appears in bundle, storage, test output, workflow logs, or repository history. |

## Recommended implementation order

The order below reduces architectural rework and protects the current local-first baseline. Items marked **P0** should be treated as release-gate work before expanding product scope.

| Order | Work package | Why this order and definition of done |
| --- | --- | --- |
| P0 | Stabilize quality gates and browser isolation | Make `npm run test:e2e` deterministic across desktop, tablet, and mobile; run all projects in CI; isolate IndexedDB/stateful tests; add formatter + `format:check`. Do not certify a complete web milestone until green runs are reproducible. |
| P0 | Fix search-dialog accessibility | Replace or enhance the custom overlay with a tested focus-managed modal: initial focus, Tab/Shift+Tab containment, Escape, focus return, accessible label, and open-dialog axe/keyboard tests. |
| P1 | Establish missing core data model and snapshot rules | **Foundation delivered:** AppData v2, packaged food/leftover records, meal/log snapshots, provenance, migration, and stable identifiers. Consumption workflow and its product rule still need completion. |
| P1 | Complete meal consumption, leftovers, packaged food, and logging | Let users edit consumed servings, create/reuse leftovers, log recipe/custom/packaged/label/leftover food, and see all six total/goal/remaining values. Build manual packaged-food first; place lookup/OCR behind reviewable adapters. |
| P1 | Complete user configuration and grocery lifecycle | Add meal modes/preferences, editable staples/categories, an avoid-time editor, Pantry Check Enter Amount, pantry/list edit controls, explicit item/quantity handoff, and robust canonical/unit review. |
| P2 | Complete recipes and imports safely | Build structured editor/notes/overrides/current yield; then JSON-LD URL and pasted-text drafts; then controlled image/OCR/social intake with source provenance, visible Needs Review, and manual fallback. |
| P2 | Complete remaining school integration hardening | Add avoid-time editing, a configurable planning safety bound if product requirements exceed five years, and mocked/live remote calendar-snapshot acceptance. Preserve the delivered local file import, provenance, drag, form, and keyboard alternatives. |
| P2 | Expand dashboard and search | Add distinct Today’s Study Plan, snack state, sodium progress, and navigable search results for meal plans/grocery history/packaged foods only after their models exist. |
| P3 | Deliver GitHub-backed persistence behind the go/no-go gates | **Static Pages foundation delivered:** private-repo enforcement, encrypted snapshots, memory-only passphrase, separate encrypted token record, SHA conflicts, visible states/actions, and tests. Record-level merge and server-mediated authorization remain optional future hardening. |
| P4 | Evaluate AI only after deterministic workflows are trusted | AI must produce reviewable drafts/proposals, not authority over arithmetic, nutrition, history, or scheduling constraints. Do not expose a nonfunctional AI control. |
| P5 | Start native implementation only after web approval | Then complete the current Apple distribution comparison and implement actual SwiftUI/EventKit/Vision/Share Extension work. |

## Acceptance-test checklist

The checklist combines the requested end-to-end web path with the missing regression evidence. Items marked **[x]** were supported by code and/or the supplied audit. **[~]** means partially implemented or only isolated evidence exists. **[ ]** means not satisfied and should be automated before acceptance.

| Status | Acceptance check | Required observable result |
| --- | --- | --- |
| [x] | Open deployed app and dashboard | Home opens with greeting and today’s events; desktop/tablet/mobile navigation reaches all primary areas. |
| [x] | Reload local state | Existing manual events, homework, plans, pantry, and other aggregate records survive a reload. |
| [x] | Add homework | Title, course, due date/time, priority, estimate, and notes create a persisted assignment. |
| [x] | Manage homework subtasks/provenance | Add/edit/toggle/delete subtasks; save/display safe source/source URLs; preserve imported provenance and user progress/subtasks on re-import. |
| [x] | Generate study plan | Incomplete work creates bounded conflict-aware sessions according to configured baseline settings. |
| [x] | Move/edit/lock/delete/complete/regenerate study block | Form edit, direct week-column drag, locking, deletion, completion, regeneration preservation, and labeled keyboard 15-minute resize controls work. |
| [x] | Enforce time-to-avoid and long-horizon deadlines | Generated sessions avoid persisted ranges and support deadlines beyond 14 days, bounded at five years. |
| [x] | Import reviewed local calendars | Multi-file Canvas/Google/ICS upload requires preview and confirmation, creates events plus Canvas-style homework with provenance, and retains user assignment progress/subtasks on re-import. Direct feed refresh remains a CORS-limited convenience path. |
| [x] | Browse and manually add recipe | Recipe appears in library with basic ingredients/steps and persists. |
| [~] | Edit recipe and scale servings | Scaling works; full metadata/ingredient override/current-yield editing does not. |
| [ ] | Import recipe safely | URL/pasted/image/social intake creates a provenance-marked, reviewable draft with a manual failure fallback. |
| [x] | Plan a recipe meal | Add/replace/remove a recipe slot with prepared servings and reload persistence. |
| [ ] | Record consumption and reuse leftovers | Consumed servings change; leftover record can be used in a later meal or food log. |
| [ ] | Assert planned/consumed nutrition rule | Product decision is explicit and test proves correct nutrition update and immutable source facts. |
| [~] | Log food and view nutrition | Saved recipes log snapshots and six totals; custom/packaged/label/leftover inputs and six remaining values are missing. |
| [ ] | Create/log packaged food | Manual package/nutrition entry, reviewed label/lookup path, UPC/text handling, and immutable package snapshot work. |
| [x] | Generate grocery list | Planned ingredients scale, aggregate compatible mass, volume, and count units, compare saved pantry quantities, and enter an explicit Pantry Check. |
| [x] | Complete Pantry Check and edit list | Every generated requirement, including an added staple, requires an explicit pantry decision; saved/custom amounts calculate the purchase quantity; shopping items support checkoff plus add, edit, delete, quantity, category, and note changes. |
| [x] | Confirm grocery staples and pantry handoff | Enabled staples are explicitly selected and then reviewed; trip completion preserves an immutable snapshot; only checked purchases are added by default, while the detailed handoff supports explicit item, quantity, and storage-location choices. |
| [x] | Complete trip and inspect history | Confirmed completion snapshots items and history shows date/name/count/status. |
| [x] | Export/import/clear | Versioned validation/migration and confirmed clear-all exist; browser coverage verifies empty first run and clear-all. |
| [ ] | Keyboard-test all dialogs | Search and all dialogs trap focus, return it correctly, escape safely, and pass open-state axe checks. |
| [ ] | Prove full responsive release matrix | The complete chain passes in a single deterministic desktop/tablet/mobile CI run. |
| [~] | Enable GitHub backup safely | Opt-in private encrypted snapshot sync, scoped-token guidance, tamper tests, SHA writes, conflict choices, pause/unlink/delete, and recovery messaging are implemented. Live GitHub E2E and record-level merging are not automated. |

## Evidence and interpretation notes

The audit evidence identifies `AppContext.tsx`, `storage/database.ts`, domain types/selectors/functions, feature pages, `pages.yml`, `README.md`, `ARCHITECTURE.md`, `MYHUB_WEB_SETUP.md`, and `MYHUB_IOS_PLAN.md` as primary implementation sources. The observed clean baseline was commit `6d56981`; creating this report is a documentation change requested after that observation. The report takes the conservative position where audit runs disagree: a release gate is **partial** unless it is reproducibly demonstrated in the configured command and CI matrix.

The GitHub persistence recommendation describes future hardening beyond the current static-client implementation. The repository does implement encrypted snapshot synchronization and a narrow read-only encrypted calendar-snapshot adapter, but it does not implement a backend, GitHub App, server-side OAuth exchange, record-level merge, or a private-calendar snapshot producer. GitHub documents both the OAuth flow’s server-side secret requirement and its recommended CSRF/PKCE safeguards, and it documents conditional contents updates/conflicts and least-privilege GitHub App permissions.[1] [2] [3]

## References

[1]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps "Authorizing OAuth apps — GitHub Docs"
[2]: https://docs.github.com/en/rest/repos/contents "REST API endpoints for repository contents — GitHub Docs"
[3]: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app "Choosing permissions for a GitHub App — GitHub Docs"
[4]: https://github.com/avicados14/MyHub "avicados14/MyHub repository and GitHub Pages deployment"
