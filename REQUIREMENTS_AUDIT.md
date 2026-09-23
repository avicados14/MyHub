# MyHub Requirements Audit

**Audit date:** 22 September 2026

**Scope:** the completed web application, encrypted GitHub persistence, uploaded calendars and cookbook, automated verification, and deliberate native-only boundaries

## Conclusion

The requested **web deliverables are complete and usable**. MyHub now starts without inaccurate demo records, lets the user create and edit records in every major workflow, persists them immediately in IndexedDB, and synchronizes the full `AppData` aggregate as authenticated ciphertext in the private `avicados14/MyHub-Data` repository.

A real-browser test against that repository decrypted **27 cookbook recipes**, imported **3,365 calendar events** from **2 encrypted feeds**, and wrote the combined state back to `myhub-data/v1/snapshot.enc`. A second verification fetched the remote file, confirmed that collection names were not present in plaintext, decrypted it in Chromium, and recovered the same counts.

The web release passed **84 unit tests** in 18 files and **117 Playwright tests** across desktop, tablet, and mobile Chromium. A separate exploratory walkthrough recorded **42 hands-on interactions** across every primary route, including creation, editing, planning, search, export, settings, navigation, persistence, and mobile layout checks. It reported no console errors, page exceptions, failed HTTP responses, or page-level horizontal overflow.

> **Meaning of complete:** A requirement is complete when the static web application can provide it safely and it has direct automated or hands-on evidence. Platform capabilities that require EventKit, native cameras, Photos, or Share Extensions remain intentionally assigned to the documented iPhone/iPad phase. Third-party browser requests remain subject to provider CORS and availability; MyHub provides a reviewed local or encrypted-repository path instead of claiming that a static page can bypass those restrictions.

## Product and Persistence

| Requirement                       | Status       | Evidence                                                                                                                                                                                                               |
| --------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional responsive web app     | **Complete** | React routes, lazy loading, semantic controls, desktop sidebar, tablet drawer, mobile bottom navigation, empty states, dark mode, and responsive screenshots.                                                          |
| No inaccurate preloaded data      | **Complete** | Production defaults contain empty personal collections. Test samples remain under `src/test` only.                                                                                                                     |
| Durable local data                | **Complete** | IndexedDB persists the versioned `AppData` aggregate across navigation and reload. Version 1 data migrates to schema version 2.                                                                                        |
| Save all user data in GitHub      | **Complete** | Optional sync encrypts the full aggregate before conditional GitHub Contents API writes. The live remote snapshot contains the cookbook and imported calendars after decryption.                                       |
| Cross-device continuation         | **Complete** | A fresh browser can connect, unlock, pull, decrypt, migrate, and persist the remote snapshot locally. Conflicts require an explicit **Use this device** or **Use GitHub** decision.                                    |
| Large encrypted snapshots         | **Complete** | Files up to GitHub’s 100 MB Contents API limit use the authenticated raw media representation when metadata returns `encoding: "none"`; a no-store request prevents the browser from reusing the metadata response.[2] |
| Backup and reset                  | **Complete** | Plaintext JSON export is clearly warned, imports are validated before confirmed replacement, and clear-all requires confirmation.                                                                                      |
| Privacy and credential separation | **Complete** | The token is encrypted in a separate IndexedDB credential record. The passphrase remains memory-only. Tokens, passphrases, feed URLs, plaintext calendar exports, and personal backups are absent from source.         |

## School and Calendar

| Requirement                    | Status                                                     | Evidence                                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day, week, and month calendar  | **Complete**                                               | All views render current records with previous, next, and Today navigation. Recurring events and multi-day spans render without duplicate visible instances.                                                                                                    |
| Manual event lifecycle         | **Complete**                                               | Events support create, edit, resize, and delete flows.                                                                                                                                                                                                          |
| Canvas and Google Calendar     | **Complete through reviewed import and encrypted refresh** | Multi-file ICS import provides source type, date window, preview, confirmation, stable IDs, and safe re-import. The private repository holds an encrypted two-feed calendar snapshot that the page checks on open, on request, and every 15 minutes while open. |
| Feed visibility and provenance | **Complete**                                               | Feed enable/disable controls hide records without deleting them. Imported records retain feed ID, external UID, source label, URL, and import time.                                                                                                             |
| Homework management            | **Complete**                                               | Homework supports full editing, progress, status, priority, estimated time, notes, safe source links, provenance, and subtask CRUD.                                                                                                                             |
| Deterministic study planning   | **Complete**                                               | Scheduling accounts for deadlines, progress, priorities, calendar conflicts, preferred hours, avoid-times, breaks, and preserved completed, locked, or manually adjusted blocks.                                                                                |
| Study-block editing            | **Complete**                                               | Form movement, direct pointer movement, pointer edge resizing, and labeled 15-minute keyboard controls are available.                                                                                                                                           |
| Direct public feed refresh     | **Browser-limited with complete fallback**                 | Direct URL refresh reports CORS or network failure. Reviewed local ICS import and the encrypted private-repository snapshot are the reliable supported paths.                                                                                                   |
| Apple Calendar and EventKit    | **Native-only**                                            | Assigned to the future SwiftUI application rather than misrepresented as a browser capability.                                                                                                                                                                  |

The supplied Canvas feed currently imports as calendar events because its ICS fields do not expose assignment-specific metadata in the shape used by the homework mapper. No events are discarded, and they still block study scheduling. Homework can be added manually or imported when a Canvas record contains the recognized due-assignment fields.

## Food, Pantry, and Grocery

| Requirement                                 | Status                              | Evidence                                                                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starter cookbook                            | **Complete**                        | All 27 uploaded cookbook recipes were converted into reviewed schema-version-2 recipe records and stored only inside the encrypted private snapshot.                                                                                   |
| Recipe authoring and editing                | **Complete**                        | Metadata, source, notes, images, tags, yield, ingredient quantities, cooking steps, favorites, nutrition, provenance, and review state are editable.                                                                                   |
| Scaling and measurement display             | **Complete**                        | Scaling derives from the immutable original yield, supports cooking fractions, keeps unknown quantities unknown, and converts compatible US/metric units without mutating source values.                                               |
| Recipe import                               | **Complete with browser fallbacks** | Public Recipe JSON-LD, pasted content, user-selected image OCR, social caption/screenshot, and local video-frame workflows produce reviewable drafts. Manual/paste fallback remains available when CORS blocks a URL.                  |
| Packaged foods                              | **Complete**                        | Manual entry, barcode lookup, text search, local label OCR, explicit source confirmation, and immutable nutrition snapshots are implemented.                                                                                           |
| Ingredient-based nutrition estimate         | **Complete**                        | Users explicitly map saved package sources. Unresolved ingredients remain visible and contribute no invented values. Estimates remain flagged until corrected and reviewed.                                                            |
| Meal planning and leftovers                 | **Complete**                        | Recipes, packages, custom foods, and leftovers can be planned. Prepared and consumed amounts stay separate; planned meals do not count toward daily nutrition until consumed.                                                          |
| Meal suggestions                            | **Complete**                        | Deterministic suggestions use saved recipes, pantry coverage, leftovers, favorites, yields, planning mode, and schedule load. Users can regenerate a slot, day, or week and temporarily lock a suggestion.                             |
| Pantry                                      | **Complete**                        | Full-field CRUD, pantry/refrigerator/freezer locations, quantity adjustment, expiration, notes, and non-negative controls persist.                                                                                                     |
| Grocery planning                            | **Complete**                        | Compatible units aggregate safely. Pantry Check requires a decision for every ingredient and selected staple. Shopping items are editable, completion is explicit, history is immutable, and only selected purchases return to pantry. |
| Native camera, scanner, and share extension | **Native-only**                     | Assigned to the documented SwiftUI phase. The web client supports file selection and typed barcodes without claiming native capture integration.                                                                                       |

## Interaction, Accessibility, and Release Quality

The current Web Interface Guidelines were fetched and applied during the final audit.[1] Every primary route passes automated WCAG A/AA checks in light mode across all three viewports, and dark mode has dedicated coverage. The application includes labeled controls, semantic buttons and links, visible focus treatment, skip navigation, dialog focus behavior, live announcements, reduced-motion support, safe-area padding, and non-gesture alternatives.

The final visual review found and fixed an image-less dashboard recipe card that was requesting the application shell as an image. The corrected card now uses the intended placeholder. Imported recipe previews and packaged-food images also reserve dimensions to prevent layout shift.

| Gate                                                                | Final result                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Formatting, ESLint, strict TypeScript, unit tests, production build | **Passed**                                                                  |
| Vitest                                                              | **18 files, 84 tests passed**                                               |
| Full Playwright matrix                                              | **117 tests passed** across desktop, tablet, and mobile                     |
| Focused food workflows                                              | **21 tests passed** across 3 viewports                                      |
| Focused calendar workflows                                          | **21 tests passed** across 3 viewports                                      |
| Focused sync/search/backup/dashboard workflows                      | **39 tests passed** across 3 viewports                                      |
| Exploratory browser walkthrough                                     | **42 recorded interactions passed** with no runtime or HTTP errors          |
| Dependency audit                                                    | **0 production vulnerabilities**                                            |
| GitHub Pages production build                                       | **Passed** with `/MyHub/` asset paths                                       |
| Real private GitHub sync                                            | **Passed** with 27 recipes, 3,365 events, 2 feeds, and encrypted write-back |

## Remaining Boundaries

No unmet browser deliverable remains. The remaining items are product boundaries rather than defects: native Apple integrations belong to the iPhone/iPad implementation, public web APIs can be unavailable or blocked by CORS, browser storage can be cleared by the platform, and deleting the current GitHub file cannot erase Git history or provider retention.

GitHub Sync uses a repository-scoped fine-grained token because a static GitHub Pages application cannot safely hold an OAuth client secret. The unlocked browser runtime necessarily holds the token and passphrase in memory. Users should keep the data repository private, retain the recovery passphrase, and periodically export a backup.

## References

[1]: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md 'Vercel Web Interface Guidelines'
[2]: https://docs.github.com/en/rest/repos/contents 'GitHub REST API endpoints for repository contents'
[3]: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages 'GitHub Docs: Using custom workflows with GitHub Pages'
