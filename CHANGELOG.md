# Changelog

All notable changes to MyHub are documented here.

## Unreleased

### Added

Added cross-cutting Playwright coverage for populated dashboard ordering, universal search across homework, recipes, pantry, packaged foods, grocery history, and meal plans, no-result and keyboard behavior, plaintext backup export warnings, downloaded backup structure, rejected invalid imports, and confirmed replacement with reload persistence.

Added provider-level GitHub Sync browser tests with Playwright route interception and synthetic encrypted data. The suite covers private-repository verification, connect/unlock, encrypted push, pull/reload, pause/resume, deterministic conflict presentation and both choices, unlink, and latest-snapshot deletion without live credentials. Request assertions verify that committed payloads do not expose recipe names or profile plaintext.

Added a complete explicit grocery workflow: compatible mass, volume, and count aggregation; per-item Pantry Check decisions including selected staples; editable shopping-list items; immutable completed-trip history; and a confirmed-purchase pantry handoff with optional per-item quantity and location review.

Added explicit `AppData` schema version 2 with loss-preserving migration from version 1 local state and backups. The durable domain foundation now includes packaged foods, leftovers, nutrition provenance, immutable meal-source snapshots, study avoid-time ranges, meal-planning modes/preferences, editable grocery category/staple models, and multiple calendar feeds.

Completed the food-planning workflow with structured recipe creation and editing, source metadata, notes, image input, tags, current yield, per-ingredient overrides, measurement-system conversion, nutrition provenance, and a visible **Needs Review** state. Recipe imports accept public Recipe JSON-LD, pasted JSON-LD/HTML/text, local image OCR, and user-supplied social captions, screenshots, or video frames; imports retain provenance, require review, and expose manual fallbacks when browser access or OCR fails.

Added packaged-food entry and editing with UPC/EAN fields, serving details, images, notes, eight nutrition metrics, read-only Open Food Facts lookup, and browser-local Nutrition Facts OCR. Imported or OCR values remain estimated and cannot be saved until the user confirms review. Packaged foods can be planned or logged through immutable source and nutrition snapshots.

Completed meal and nutrition lifecycle controls: recipe, packaged, custom, and leftover meal sources; prepared versus consumed serving entry; non-negative reusable leftovers; accessible move/copy controls; multi-source food logging; and daily totals, targets/limits, and remaining values for calories, protein, carbohydrates, fat, sugar, saturated fat, fiber, and sodium. Planned meals stay out of daily nutrition until consumption is recorded. Deterministic local Smart suggestions can be accepted, replaced, or locked and use saved recipes, pantry coverage, leftovers, favorites, yields, and the persisted planning mode without claiming generative AI.

Added unit and browser coverage for recipe imports, label parsing, Open Food Facts fallback, measurement conversion, meal consumption/leftovers, and deterministic suggestions. Added the focused cross-viewport `tests/food-v2.spec.ts` workflow, which validates recipe authoring/review/import and the planned-versus-consumed nutrition rule.

Added optional encrypted GitHub-backed synchronization for the dedicated private `avicados14/MyHub-Data` repository. IndexedDB remains the immediate offline store. Versioned Web Crypto envelopes use PBKDF2-SHA-256 with 310,000 iterations and AES-256-GCM; tampering and wrong passphrases are rejected. The GitHub Contents client enforces a private repository, conditionally writes with blob SHA values, serializes writes, and surfaces conflicts for explicit resolution.

Added a GitHub Sync provider and accessible Settings controls for connect/unlock, manual sync, status, pause/resume, unlink, conflict choice, and latest-snapshot deletion. The fine-grained token is encrypted in a separate IndexedDB credential record, is excluded from AppData and backups, and requires only repository-scoped Contents read/write access.

Added end-to-end encrypted Supabase cross-device persistence using the existing MyHub project. A narrow RLS-protected Edge Function stores only encrypted credentials and encrypted AppData, hashes the write capability, verifies the private GitHub repository at link creation, revokes previous access rows, and enforces optimistic document revisions.

Added a permanent revocable private access link for fresh phones and browsers. Opening the one link resolves and decrypts current Supabase data, configures the encrypted GitHub backup, removes the capability from the active address, persists it separately from AppData, and opens Home without a QR, pairing code, form, or sign-in. Later visits on that linked browser may use the ordinary MyHub URL.

Added a reviewed multi-file local calendar import workflow for Canvas, Google Calendar, and standard ICS exports. Users select a source type and date window, inspect an event/homework preview, and explicitly confirm before anything is persisted. The parser retains rich event provenance, handles folded lines, all-day values, common timezone cases, stable re-import IDs, and maps Canvas-style assignment URLs to editable homework while preserving user progress and subtasks on re-import.

Added complete school-workflow controls for homework progress, status, priority, source links, and subtask CRUD; editable/deletable calendar events; and direct study-block movement with keyboard-operable 15-minute resize controls. Planning now supports persisted avoid-time ranges and deadlines beyond the prior short horizon while preserving completed, locked, and manually adjusted blocks.

Added a narrow read-only encrypted private-calendar snapshot adapter at `myhub-data/v1/calendars.enc`. The calendar screen consumes provider capabilities rather than credentials, can check after Sync is unlocked, and reports unavailable, missing, or invalid snapshots without bundling a feed URL or calendar export.

Added a reusable 42-action exploratory Playwright walkthrough for the rendered desktop and mobile application. It exercises route navigation, dialogs, calendar views, event and homework creation, study planning, recipe and meal creation, nutrition and packaged-food modes, pantry controls, grocery generation, settings, backup export, universal search, reload persistence, and narrow-screen overflow.

### Changed

Corrected calendar date and time handling with a persisted IANA display zone. UTC events and source `TZID` values now convert into `America/Denver` for the personalized snapshot, including DST-aware recurrences and date rollovers. The real encrypted calendar data was reparsed into 3,328 valid events; 3,168 previously stored date/time records changed during the correction.

Condensed the Home schedule to the same desktop height as **Focus next**. It now places the live current time in the middle and shows the most relevant previous, currently active, and next commitments instead of stretching through the full day.

Normalized all eight personal-cookbook chicken ingredients that previously read 6–8 oz to a structured 8 oz quantity. Added researched per-serving calories, protein, carbohydrates, fat, sugar, saturated fat, fiber, and sodium for the four recipes that previously lacked nutrition, with USDA/manufacturer provenance and material assumptions kept in the review notice.

Corrected meal-plan semantics so adding a recipe records planned and prepared servings but never records consumption. Daily nutrition and leftover depletion now change only after an explicit consumed-serving action.

Scoped grocery generation to the remaining current planner week, excluded historical persisted meals, used the greater of planned and prepared servings, applied saved yield-specific ingredient overrides, and stored the source date window and meal IDs on active and historical lists.

Added direct Open Food Facts text search to food logging, retained Schema.org sugar and saturated-fat values during Recipe JSON-LD import, and added regression coverage for both paths. Settings section links now use shareable router query URLs instead of click-only scrolling.

Enabled the encrypted personalized late-day nutrition preference. Meal suggestions favor lighter breakfast and lunch choices and concentrate most target calories and protein in dinner and snack while retaining all four preferred meal slots.

Personalized the encrypted private snapshot with the 27 uploaded cookbook recipes as the only recipes, zero homework assignments, the approved study and meal-planning defaults, and all eight supplied or recommended nutrition targets. The replacement Google feed, Canvas feed, and calendar encryption passphrase are installed as masked Actions secrets; a real scheduled-workflow dispatch completed successfully.

Fixed Settings section navigation so it scrolls within the HashRouter route instead of returning to Home. Smart meal suggestions now fall back to review-marked recipes when an imported cookbook has no reviewed recipes yet, while keeping the review warning visible.

Made Playwright web-server startup collision-safe by allocating an available local loopback port while retaining deterministic port `4287` in CI. The Pages validation command runs the configured desktop, tablet, and mobile Chromium projects.

Rewrote the requirements audit around the completed integrated release. The final evidence records 100 unit tests, 126 responsive browser tests, the 42-action exploratory walkthrough, static-browser public API and CORS limits, and deliberate native-only boundaries. README, architecture, and setup now describe the same release and privacy model.

Applied the current Web Interface Guidelines to the cross-cutting surface, including explicit Escape handling for universal search. No secrets, live private repository requests, private calendar URLs or contents, cookbook data, passphrases, or personal access tokens were added.

Corrected the reproduced empty-phone behavior by making Supabase the live encrypted cross-device document and GitHub the backup. Browser tests now prove phone-to-desktop propagation, focus-time refresh, ciphertext-only broker payloads, and ordinary-URL restoration after local AppData is cleared.

Fresh installations and **Clear all data** now produce empty personal collections rather than demo records. Sample records are isolated to test fixtures. Data/privacy and clear-all copy now distinguishes local IndexedDB, encrypted Supabase propagation, encrypted GitHub backup, and plaintext JSON exports.

Completed and merged the focused food and calendar hardening. Each 7-scenario suite passes across desktop, tablet, and mobile, and the complete integrated browser matrix passes all 126 tests.

Updated GitHub Contents reads for encrypted files larger than 1 MB. The client now follows GitHub's raw-media requirement and bypasses browser cache for the second representation request. This fixed the real 3.7 MB encrypted calendar snapshot, which metadata represents with `encoding: "none"`.[2]

Fixed image-less dashboard recipe cards so they render the intentional placeholder instead of requesting the application document as an image. Imported recipe previews and packaged-food images now reserve explicit dimensions.

Verified the real private repository in a fresh Chromium profile. MyHub recovered 27 cookbook recipes, imported 3,328 corrected events from 2 encrypted calendar feeds, wrote the combined state back as ciphertext, and decrypted the stored remote snapshot to the same counts.

### Security

Documented that encryption passphrases remain memory-only, classic or broadly scoped PATs must not be used, and GitHub history or retention means deleting the latest encrypted snapshot cannot guarantee historical erasure.

Documented that local ICS exports, feed URLs, and private calendar contents must not be committed. The focused calendar browser test uses in-memory minimal upload fixtures only.

## 0.1.0 — 2026-09-22

### Added

MyHub’s first web prototype introduces a responsive personal college command center with a persistent desktop sidebar, tablet drawer, and mobile bottom navigation. The connected dashboard shows today’s events, due homework, study blocks, meals, nutrition progress, and grocery readiness.

The school workflow includes day, week, and month calendars; manual events; Canvas-compatible ICS file import; homework creation and progress; and deterministic study scheduling around existing calendar conflicts. Generated study blocks can be locked, completed, removed, and edited through accessible controls.

The food workflow includes an original recipe library, recipe creation, cooking-friendly yield scaling, weekly meal planning, prepared and consumed servings, leftovers, food logging, and daily nutrition targets. Five original recipe photographs are stored with the project.

The inventory workflow includes pantry, refrigerator, and freezer records; conservative grocery aggregation; Pantry Check; a mobile-friendly shopping list; completed-trip snapshots; and an explicit purchased-item handoff back to the pantry.

The data layer introduces versioned IndexedDB persistence, removable demo data, JSON export and import, local-only privacy behavior, and immutable food-log and grocery-history snapshots. The repository includes unit tests, browser acceptance tests, strict TypeScript, linting, documentation, and a current GitHub Pages Actions workflow.

## References

[1]: https://keepachangelog.com/en/1.1.0/ 'Keep a Changelog'
[2]: https://docs.github.com/en/rest/repos/contents 'GitHub REST API endpoints for repository contents'
