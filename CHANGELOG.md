# Changelog

All notable changes to MyHub are documented here.

## Unreleased

### Added

Added cross-cutting Playwright coverage for populated dashboard ordering, universal search across homework, recipes, pantry, packaged foods, grocery history, and meal plans, no-result and keyboard behavior, plaintext backup export warnings, downloaded backup structure, rejected invalid imports, and confirmed replacement with reload persistence.

Added provider-level GitHub Sync browser tests with Playwright route interception and synthetic encrypted data. The suite covers private-repository verification, connect/unlock, encrypted push, pull/reload, pause/resume, deterministic conflict presentation and both choices, unlink, and latest-snapshot deletion without live credentials. Request assertions verify that committed payloads do not expose recipe names or profile plaintext.

Added a complete explicit grocery workflow: compatible mass, volume, and count aggregation; per-item Pantry Check decisions including selected staples; editable shopping-list items; immutable completed-trip history; and a confirmed-purchase pantry handoff with optional per-item quantity and location review.

Added explicit `AppData` schema version 2 with loss-preserving migration from version 1 local state and backups. The durable domain foundation now includes packaged foods, leftovers, nutrition provenance, immutable meal-source snapshots, study avoid-time ranges, meal-planning modes/preferences, editable grocery category/staple models, and multiple calendar feeds.

Completed the food-planning workflow with structured recipe creation and editing, source metadata, notes, image input, tags, current yield, per-ingredient overrides, measurement-system conversion, nutrition provenance, and a visible **Needs Review** state. Recipe imports accept public Recipe JSON-LD, pasted JSON-LD/HTML/text, local image OCR, and user-supplied social captions, screenshots, or video frames; imports retain provenance, require review, and expose manual fallbacks when browser access or OCR fails.

Added packaged-food entry and editing with UPC/EAN fields, serving details, images, notes, six nutrition metrics, read-only Open Food Facts lookup, and browser-local Nutrition Facts OCR. Imported or OCR values remain estimated and cannot be saved until the user confirms review. Packaged foods can be planned or logged through immutable source and nutrition snapshots.

Completed meal and nutrition lifecycle controls: recipe, packaged, custom, and leftover meal sources; prepared versus consumed serving entry; non-negative reusable leftovers; accessible move/copy controls; multi-source food logging; and six-metric daily totals, targets, and remaining values. Planned meals stay out of daily nutrition until consumption is recorded. Deterministic local Smart suggestions can be accepted, replaced, or locked and use saved recipes, pantry coverage, leftovers, favorites, yields, and the persisted planning mode without claiming generative AI.

Added unit and browser coverage for recipe imports, label parsing, Open Food Facts fallback, measurement conversion, meal consumption/leftovers, and deterministic suggestions. Added the focused cross-viewport `tests/food-v2.spec.ts` workflow, which validates recipe authoring/review/import and the planned-versus-consumed nutrition rule.

Added optional encrypted GitHub-backed synchronization for the dedicated private `avicados14/MyHub-Data` repository. IndexedDB remains the immediate offline store. Versioned Web Crypto envelopes use PBKDF2-SHA-256 with 310,000 iterations and AES-256-GCM; tampering and wrong passphrases are rejected. The GitHub Contents client enforces a private repository, conditionally writes with blob SHA values, serializes writes, and surfaces conflicts for explicit resolution.

Added a GitHub Sync provider and accessible Settings controls for connect/unlock, manual sync, status, pause/resume, unlink, conflict choice, and latest-snapshot deletion. The fine-grained token is encrypted in a separate IndexedDB credential record, is excluded from AppData and backups, and requires only repository-scoped Contents read/write access.

Added a reviewed multi-file local calendar import workflow for Canvas, Google Calendar, and standard ICS exports. Users select a source type and date window, inspect an event/homework preview, and explicitly confirm before anything is persisted. The parser retains rich event provenance, handles folded lines, all-day values, common timezone cases, stable re-import IDs, and maps Canvas-style assignment URLs to editable homework while preserving user progress and subtasks on re-import.

Added complete school-workflow controls for homework progress, status, priority, source links, and subtask CRUD; editable/deletable calendar events; and direct study-block movement with keyboard-operable 15-minute resize controls. Planning now supports persisted avoid-time ranges and deadlines beyond the prior short horizon while preserving completed, locked, and manually adjusted blocks.

Added a narrow read-only encrypted private-calendar snapshot adapter at `myhub-data/v1/calendars.enc`. The calendar screen consumes provider capabilities rather than credentials, can check after Sync is unlocked, and reports unavailable, missing, or invalid snapshots without bundling a feed URL or calendar export.

### Changed

Made Playwright web-server startup collision-safe by allocating an available local loopback port while retaining deterministic port `4287` in CI. The Pages validation command runs the configured desktop, tablet, and mobile Chromium projects.

Rewrote the requirements audit around the `0e094f3` combined baseline and this cross-cutting branch. The matrix now separates verified web work, companion food/calendar hardening that must not be credited before merge, static-browser public API and CORS limits, and deliberate native-only boundaries. README, architecture, and setup claims now describe the same release and privacy model.

Applied the current Web Interface Guidelines to the cross-cutting surface, including explicit Escape handling for universal search. No secrets, live private repository requests, private calendar URLs or contents, cookbook data, passphrases, or personal access tokens were added.

Fresh installations and **Clear all data** now produce empty personal collections rather than demo records. Sample records are isolated to test fixtures. Data/privacy copy now distinguishes local IndexedDB, optional encrypted sync, and plaintext JSON exports.

The food documentation and requirements audit now describe the completed web workflow and its explicit boundaries: all imports require review, external requests are direct browser requests with manual fallbacks, OCR stays in the browser for user-selected files, and the focused food acceptance suite passed on fresh desktop, tablet, and mobile execution. The broader all-domain responsive CI matrix remains a separate release-practice gap.

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
