# Changelog

All notable changes to MyHub are documented here.

## Unreleased

### Added

Added explicit `AppData` schema version 2 with loss-preserving migration from version 1 local state and backups. The durable domain foundation now includes packaged foods, leftovers, nutrition provenance, immutable meal-source snapshots, study avoid-time ranges, meal-planning modes/preferences, editable grocery category/staple models, and multiple calendar feeds.

Added optional encrypted GitHub-backed synchronization for the dedicated private `avicados14/MyHub-Data` repository. IndexedDB remains the immediate offline store. Versioned Web Crypto envelopes use PBKDF2-SHA-256 with 310,000 iterations and AES-256-GCM; tampering and wrong passphrases are rejected. The GitHub Contents client enforces a private repository, conditionally writes with blob SHA values, serializes writes, and surfaces conflicts for explicit resolution.

Added a GitHub Sync provider and accessible Settings controls for connect/unlock, manual sync, status, pause/resume, unlink, conflict choice, and latest-snapshot deletion. The fine-grained token is encrypted in a separate IndexedDB credential record, is excluded from AppData and backups, and requires only repository-scoped Contents read/write access.

### Changed

Fresh installations and **Clear all data** now produce empty personal collections rather than demo records. Sample records are isolated to test fixtures. Data/privacy copy now distinguishes local IndexedDB, optional encrypted sync, and plaintext JSON exports.

### Security

Documented that encryption passphrases remain memory-only, classic or broadly scoped PATs must not be used, and GitHub history or retention means deleting the latest encrypted snapshot cannot guarantee historical erasure.

## 0.1.0 — 2026-09-22

### Added

MyHub’s first web prototype introduces a responsive personal college command center with a persistent desktop sidebar, tablet drawer, and mobile bottom navigation. The connected dashboard shows today’s events, due homework, study blocks, meals, nutrition progress, and grocery readiness.

The school workflow includes day, week, and month calendars; manual events; Canvas-compatible ICS file import; homework creation and progress; and deterministic study scheduling around existing calendar conflicts. Generated study blocks can be locked, completed, removed, and edited through accessible controls.

The food workflow includes an original recipe library, recipe creation, cooking-friendly yield scaling, weekly meal planning, prepared and consumed servings, leftovers, food logging, and daily nutrition targets. Five original recipe photographs are stored with the project.

The inventory workflow includes pantry, refrigerator, and freezer records; conservative grocery aggregation; Pantry Check; a mobile-friendly shopping list; completed-trip snapshots; and an explicit purchased-item handoff back to the pantry.

The data layer introduces versioned IndexedDB persistence, removable demo data, JSON export and import, local-only privacy behavior, and immutable food-log and grocery-history snapshots. The repository includes unit tests, browser acceptance tests, strict TypeScript, linting, documentation, and a current GitHub Pages Actions workflow.

## References

[1]: https://keepachangelog.com/en/1.1.0/ "Keep a Changelog"
