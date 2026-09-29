# MyHub Phase 2 TODO

Phase 1 is the deployed React/Vite web prototype (`0.1.0`). Phase 2 is the native iPhone and iPad application described in `MYHUB_IOS_PLAN.md`, with any web refinements needed to establish a reliable shared contract. This is a working checklist. The native foundation is now implemented on the continuation branch; full feature parity and acceptance remain open.

## 0. Close the Phase 1 handoff gate

- [ ] Verify that the September 28 encrypted calendar import reached Supabase: the linked browser should settle at a current sync state, and a separate fresh private-link browser should show the same aggregate assignment count in School. The connected browser showed 3,332 events and 168 assignments; fresh-device propagation was not independently checked. Use counts and revision metadata only, without exposing private content or capabilities. See `FIXME.md`.
- [ ] If the counts disagree, trace the Supabase document revision, local hydration, and serialized push/refresh path before changing the deployed Canvas UID parser. Add a focused regression only for the reproduced failure.
- [ ] Record the verified baseline (source commit, data-repository commit, counts, timezone, test results) and reconcile the older counts in `README.md` and `REQUIREMENTS_AUDIT.md`.
- [ ] Review the Phase 1 dashboard, calendar/homework, study planner, food, nutrition, pantry/grocery, and backup workflows with the owner. Record approved behavior and requested changes before freezing the native contract.

## 1. Freeze the portable data and behavior contract

- [x] Document `AppData` schema version 2, its IDs, source/provenance fields, local dates, timestamps, immutable snapshots, and migration rules. Identify which fields transfer to native storage and which browser-only credentials must never enter a portable backup.
- [x] Save representative, non-personal JSON fixtures and golden expected results for recipe scaling/fractions, unit-compatible grocery aggregation, eight-field nutrition totals, prepared/consumed/leftover balances, homework priority, study scheduling, and completed-trip history.
- [ ] Decide how native import/export will validate and migrate MyHub backups, reject unknown future versions, and preserve user records. Test a web-export-to-native-import round trip with non-personal fixtures.
- [x] Define the native storage model (for example SwiftData after review), explicit local-date/time-zone behavior, offline writes, and migration strategy. Preserve web history and current source provenance.

## 2. Build the native foundation

- [x] Create a standalone Swift/SwiftUI iPhone and iPad project; do not wrap the website in a WebView.
- [ ] Implement native navigation and accessible layouts: iPhone `TabView`/`NavigationStack`, iPad `NavigationSplitView`, sheets, confirmation dialogs, Dynamic Type, VoiceOver labels, and non-gesture alternatives.
- [ ] Implement the local persistence and backup-import foundation with versioned `Codable` models, stable IDs, explicit local dates, and tests against the frozen fixtures.
- [ ] Rebuild and validate Dashboard, Calendar, School/homework, and deterministic study planning against the approved web behavior.
- [ ] Rebuild and validate recipes, packaged foods, meal planning, nutrition logs, leftovers, pantry, grocery planning/check, and completed-trip history. Keep planning, preparation, and consumption separate; preserve immutable historical snapshots.

## 3. Add native integrations through reviewable adapters

- [ ] Add EventKit calendar permission, import, and update behavior after choosing its relationship to MyHub-owned events and avoiding duplicate records.
- [ ] Add camera/barcode and Nutrition Facts capture with AVFoundation/Vision/VisionKit, and photo selection with PhotosPicker. Keep OCR/import values reviewable before saving.
- [ ] Add a Share Extension and App Group handoff queue for content explicitly shared from supported apps; present a draft for user review rather than filling unknown recipe fields.
- [ ] Evaluate secure recipe/nutrition import adapters for browser CORS-limited sources. Define credentials, privacy, provenance, failure handling, and manual fallbacks before building a hosted integration.

## 4. Decide and implement native synchronization

- [ ] Compare CloudKit with a private shared backend against web interoperability, privacy, account/device setup, offline behavior, conflict resolution, maintenance, cost, and recovery. Do not assume the web bearer link is an Apple account session.
- [ ] Define how native devices obtain and protect encryption and access material (Keychain where applicable), and whether the existing encrypted Supabase document can be safely shared across web and native clients.
- [ ] Implement the selected revision/conflict model and encrypted backup path only after the data contract and access model are approved. Test fresh-device restore, offline edits, simultaneous edits, revocation, and recovery without real personal fixtures.

## 5. Validate and distribute

- [ ] Recheck current Apple provisioning/distribution options before native-device testing, including cost, signing/re-signing, iPhone/iPad support, extensions, App Groups, background work, and required entitlements.
- [ ] Run unit, migration, accessibility, and device acceptance checks on iPhone and iPad. Compare results with the approved web fixtures and workflows.
- [ ] Document the release, private-data recovery procedure, known limitations, and migration path. Keep credentials, feed URLs, bearer links, raw ICS, decrypted records, and personal backups out of source and test output.

## Source of this plan

`README.md` roadmap; `MYHUB_IOS_PLAN.md` acceptance gate and native adapters; `ARCHITECTURE.md` data contract; `REQUIREMENTS_AUDIT.md` Phase 1 coverage; and `HANDOFF_CONTINUATION_GUIDE.md` from the private September 28 handoff. Update this checklist as decisions and evidence change.

## September 28 continuation checkpoint

- Contract/schema documentation and seven executable golden behavior fixtures: `contracts/v2/README.md`, `src/domain/portableContract.test.ts`. Owner acceptance is still pending; this is a compatibility candidate, not a declaration that all workflows are frozen.
- Native storage decision implemented for the foundation: atomic versioned Codable JSON in Application Support, preserving IDs/local dates/snapshots; iOS file protection. SwiftData deferred. See `native/README.md`.
- Native foundation source exists: standalone SwiftUI Xcode project, iPhone tabs/iPad split view, offline backup import/export with replacement confirmation, and read-only Home/Calendar/School/recipe viewing. Navigation accessibility/device validation, complete editing and calculation parity remain unchecked.
- Native v2 import validation and round-trip tests are implemented. Direct v1 migration is not: use the web migrator then export v2. Do not check the combined import/migration task until the agreed migration scope and native tests are verified.
- Live Phase 1 gate remains blocked: no original linked browser or usable private-link session is available. Supabase revision 60 is metadata evidence only, not proof of 168 assignments. Exact observation and baseline: `docs/CONTINUATION_2026-09-28.md`.
- Owner decisions are prepared in `docs/NATIVE_DECISIONS.md`: approve existing web behavior or identify workflow changes; choose a sync direction/access model before native synchronization. Integrations and full workflow ports retain these dependencies.

- Native validation at `ce707bf`: macOS workflow `36507350376`, job `109211657010`, passed all 3 Swift tests and the standalone iPhone/iPad simulator build. This checks project creation, not accessibility/device acceptance or full feature parity.

- Running progress document: `docs/WORK_LOG.md` (requested September 29). Includes the exact failed CI cases and subsequent corrections/evidence.
