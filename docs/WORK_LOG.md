# MyHub continuation work log

This is the running implementation record for Phase 2. Dates use America/Denver unless explicitly marked UTC. Recorded evidence is limited to source, synthetic tests, and privacy-safe counts/revision/status. No private links, credentials, feed URLs, calendar contents, personal records or backup payloads belong here.

## September 28, 2026 — contract and native foundation

**Starting point:** current main `3472b55`, not the archive's older source revision. Read the requested repository documents and private handoff guidance, then traced domain models/migrations, AppContext, IndexedDB, encrypted sync, feature commands, broker/migrations and the private calendar producer.

**Live investigation:** the connected Supabase project was healthy, its broker was active at version 3, and one active document was at revision 60 (updated 22:53:52.106 UTC). RLS was enabled and direct anon/authenticated table privileges were absent. The available browser had only a blank tab. This proves neither the 168-assignment remote count nor fresh-device restoration. The exact remaining observation is documented in `CONTINUATION_2026-09-28.md`.

**Implemented in `ce707bf`, draft PR [#18](https://github.com/avicados14/MyHub/pull/18):**

- Generated a versioned AppData JSON schema from the TypeScript model and added drift checks.
- Added wholly synthetic backup/golden fixtures and seven tests for existing domain behavior.
- Reproduced an invalid import (`recipes: [{}]` was accepted), then added nested shape validation before backup replacement and regression tests.
- Built a standalone SwiftUI iPhone/iPad project, generated Codable transport models, atomic offline persistence, confirmed import/export and read-only calendar/homework/recipe views. No WebView or native sync was introduced.
- Corrected dated count/test claims and documented the three different calendar refresh paths. Updated TODO/FIXME and prepared concrete native workflow/sync decisions.

**Verified:** `npm run check` passed 121 tests in 23 files, formatting, lint, strict types, contract drift and production build. The seven golden tests also passed under `TZ=America/Denver`. Production dependency audit: zero vulnerabilities. Native macOS workflow `36507350376` passed three Swift tests and the iPhone/iPad simulator build. These are foundation checks, not complete feature/device acceptance.

**Environment limit:** the initial local Chromium download was an invalid ZIP, so browser validation used the existing GitHub Actions matrix. No production data, broker or Canvas parser was modified.

## September 29, 2026 — resume, document and resolve exact CI failures

**Request:** continue implementation and maintain this running document as work proceeds.

**Baseline rechecked:** public main remains `3472b55`; continuation branch remains `codex/phase2-contract-foundation`. Preserved the uncommitted evidence/documentation updates from the previous checkpoint.

**CI evidence inspected before changing tests:** web run `36507350281`, job `109211656808`, completed with 125 passes, six failures and one flaky test (14.4 minutes). The six failures are two food tests across desktop/tablet/mobile:

1. `prepared batches populate future days and decrease together as servings are eaten` seeds September 22 but opens the current planner week; its expected batch cards are outside that week.
2. `planner meal editor schedules extra prepared portions by default` chooses the current week's Tuesday but asserts generated dates September 23/24. CI instead observed September 29.

**Correction in progress:** pin each affected test's browser clock to September 22, noon, before seeding/navigation. This follows the clock setup already used by neighboring tests and changes no meal calculation or production date behavior. Run these two cases across all three viewports before the full gate.

**Separate flaky observation:** the direct Canvas refresh test failed once at the School heading assertion and passed on retry. No parser defect is established. Retest its exact path and record the result without speculative parser changes.

## Open dependencies and decisions

- Live Phase 1 proof still needs the original linked browser and a fresh private-link session. Do not replace/revoke a capability merely to test it.
- Workflow choice resolved September 29: the owner approved existing web behavior. Feature implementation, shared-fixture parity and device acceptance remain separate gates.
- Full native editing and calculation parity, integrations, selected sync/access model, device accessibility and distribution are not complete. See `NATIVE_DECISIONS.md` and TODO for their dependency order.
- A task stalled for 30 minutes must be stopped, documented and narrowed before resuming. No blind workflow reruns; inspect the exact failure first.

Append each implementation checkpoint with changed files/behavior, commit, commands/run IDs, outcomes and remaining blockers. A passing design review or build does not complete an implementation or device acceptance task.

### September 29 — validation approach corrected

A narrower local headless Chromium download also failed with an invalid ZIP. Further local browser-download retries were stopped. The existing PR workflow now runs the two date regressions and the Canvas path across all three viewports with zero retries before its full browser matrix. This gives focused evidence and prevents masking a repeated failure with retries. Native source is unchanged from its successful build.

### September 29 — native calculations added for verification

After publishing the clock/log checkpoint as `8e5e910`, continued independent native work against the synthetic contract: ingredient scaling and cooking fractions, eight-field consumption-only nutrition totals, source visibility, homework ranking, and deterministic study-plan previews. Added Swift golden tests plus invalid-duration, locked-block and disabled-feed cases. The native recipe view now offers non-destructive serving previews, and School offers a study-plan preview; neither writes a schedule or changes historical data. This is a partial workflow port, not completed feature parity. Native CI must validate this new source before it is reported as working.

### September 29 — focused clock/Canvas gate passed

At `8e5e910`, web workflow `36580422648`, job `109446821494`, completed the focused meal-date/Canvas regression step successfully across desktop, tablet and mobile with retries disabled (nine selected cases). The full matrix was still running at this observation; no full-suite pass is claimed yet. Native workflow `36580422782` also passed for the earlier foundation source. The next commit contains additional native calculations and therefore needs a new native validation result.

### September 29 — remote counts verified and native checks passed

**Correction to the initial blocker:** the additional private-handoff README clarified that protected recovery material existed in the full archive. Used it without displaying or committing it. A fresh stateless client ran the current application's resolve/decrypt path against Supabase and emitted only revision/status/counts: revision 60, updated September 28 22:53:52.106 UTC, 3,361 events and 168 assignments. Contents stayed in memory; temporary recovery material was removed. No replacement link or document write was made. Access resolution can update access-status metadata.

This proves independently retrievable remote assignments, but not record identity with the earlier import or fresh-browser UI hydration. The original linked browser is unavailable and the available browser is blank. The remaining gate is its settled status plus a fresh browser's School count/revision. Updated TODO/FIXME and the continuation report; retained the dated 3,332-event historical observation without inventing a reason for the difference.

**Native source `97e484f`:** workflow `36581037456`, job `109448967623`, passed the portable Swift tests and standalone iPhone/iPad simulator build, including the new recipe/study preview calculations. This does not complete editing parity or device acceptance. Full web workflow `36581037358` is still running at this checkpoint.

### September 29 — baseline approved and full gate green

The owner explicitly selected **Keep web behavior** as the native implementation baseline. This closes the workflow-choice dependency; it does not select a sync backend or approve integration permissions. Native features will preserve existing semantics and shared fixtures.

At `97e484f`, web workflow `36581037358` passed formatting, schema drift, lint, types, 121 unit tests, nine focused browser cases with retries disabled, all 132 full browser cases, and production build. Native workflow `36581037456` passed nine Swift tests and the simulator build. Earlier web run `36580422648` was superseded/cancelled after its focused step passed; it is not a full-suite pass.

Next increment: native homework create/edit/delete and study-plan application with atomic persistence, stale-draft rejection and preservation of imported provenance/history. Full feature checkboxes remain open until their complete scope is implemented and validated.

### September 29 — native School editing implementation

After the evidence/decision checkpoint `25bad0e`, traced `SchoolPage` save/status/subtask/delete/generate behavior and implemented native draft commands plus SwiftUI forms. Homework can be created, edited, completed, reopened, and deleted with confirmation; subtasks can be added/edited/toggled/removed. Imported identity, timestamps and provenance survive edits. Study previews can be applied with confirmation, preserving locked/completed/adjusted study blocks and other events. Stale drafts/previews are rejected. The local document is saved atomically before UI state changes.

Added core tests for create/edit/reload, imported provenance, malformed/stale drafts, protected block regeneration and deletion scope, retaining immutable food/trip history. Mac CI must validate this increment before it is reported as passed. Full School/calendar/dashboard acceptance remains open (study block editing, settings, device interaction and accessibility are still incomplete).

**Published School increment:** `ec4f664`, draft PR #18. Local `npm run check` passed contract drift, formatting, lint, types, all 121 unit tests and production build. Native workflow `36596491185` is validating the new Swift commands/forms. No web production source changed in this increment; the previous full 132-case browser pass remains dated to `97e484f`.

### September 29 — School increment validated

At `ec4f664`, native workflow `36596491185`, job `109502621590`, passed **13 Swift tests** (3 contract/storage, 6 domain, 4 School command tests) and the standalone iPhone/iPad simulator build. Local full web checks also passed. The earlier full browser result remains 132/132 at `97e484f`; automatic browser reruns on subsequent native/documentation commits do not change that evidence scope.

Corrected current native descriptions to include working homework editing and confirmed study application. Remaining work: study block editing/settings, full dashboard/calendar and food workflow parity, native legacy migration, native device/accessibility checks, integration models, selected enrollment/sync model and distribution. The original linked-browser status and a fresh private-link browser's School count remain the exact Phase 1 acceptance observations still unavailable. No secrets or personal fixtures were committed.

## September 29 — next implementation plan and calendar/study increment

Rechecked public main (`3472b55`) and continuation head (`0c312bd`); both remote workflows at that head passed. Working tree was clean. Read the current checklists, legacy migration implementation, Calendar/School commands and study settings before editing.

Plan in dependency order:

1. Complete the next offline calendar/study controls with source-compatible commands and focused synthetic tests.
2. Establish dedicated legacy migration fixtures before implementing direct native v1 repair/cleanup. Keep the existing web-migrate-to-v2 route explicit meanwhile.
3. Continue dashboard/calendar presentation and native food calculation/editing parity, preserving meal states and historical snapshots.
4. Define integration privacy/access contracts, then implement adapters. Select native enrollment/sync behavior before implementing synchronization.
5. Run relevant gates and record precise device/browser blockers; do not equate simulator builds with device acceptance.

Implemented native event creation/editing/deletion, study locking/completion/reopening, and study settings with weekday avoid ranges. Edits preserve provenance; changed study blocks become protected on regeneration. Overlaps require explicit review; stale drafts and invalid ranges fail before persistence. Imported multi-day bounds are preserved; moving their range remains unsupported and is disabled in the editor. Manual single-day and all-day events are supported. Added five focused test cases for regeneration protection, completion semantics, overlap validation, imported bounds and settings.

The new source requires Mac CI before a passing implementation checkpoint can be claimed. No private archive contents, production calendar parser or backend were changed. Full native calendar/dashboard/device acceptance remains open.

### Calendar validation recovery and legacy bridge fixtures

GitHub's branch ref advanced to `338a02c`, but PR #18 retained `0c312bd` and no new checks were created. Verified both refs before changing anything. Closing/reopening the same draft refreshed its head and triggered web run `36622161689` and native run `36622161736`; the PR remains draft. Native core tests passed, simulator build pending at this observation.

Added a dedicated synthetic v1 backup and reviewed migrated-v2 golden in `contracts/v1`. The actual web parser matches the complete golden; explicit assertions cover demo/dependent cleanup, stable IDs/dates, planned/prepared/consumed amounts, missing provenance, nutrition, and completed-trip history. A Swift test imports/re-encodes the same migrated file. This proves the supported bridge when both suites pass; it is not direct Swift migration or exhaustive legacy cleanup coverage. Fourteen focused web contract/import tests passed locally.

**Calendar increment verified:** native workflow `36622161736`, job `109589992915`, passed 18 Swift tests and the iPhone/iPad simulator build at `338a02c`. The checklist now checks this bounded implementation increment and the previously verified v2 local persistence foundation; full calendar/dashboard/accessibility tasks remain open.

**Legacy bridge web gates:** `npm run check` passed all 124 tests in 24 files, formatting, lint, types, contract drift and production build. The additional Swift bridge test still requires the next commit's Mac run. No web production behavior changed.

### Verified checkpoint — legacy bridge and calendar controls

At `56ec15d`, native workflow `36622604118`, job `109591508483`, passed **19 Swift tests** and the standalone iPhone/iPad simulator build. This includes the full migrated-v2 native JSON round trip. Local `npm run check` passed 124 tests in 24 files plus all static/build gates; the three legacy bridge tests also passed with `TZ=America/Denver`. New automated browser runs are separate from the previously recorded full browser pass; no new browser UI acceptance is claimed for native work.

Current implementation commits: `338a02c` (calendar/study controls) and `56ec15d` (legacy fixtures/bridge tests). PR #18 remains draft. The ref/head lag recurred on the second push; reopening the same draft again brought it to the actual branch head and triggered the expected checks. No test failure was hidden by this refresh.

Next work is direct legacy migration coverage/implementation, native dashboard/calendar presentation and food workflow parity. Full native device/accessibility acceptance, integration models and synchronization remain separate open gates. Existing Phase 1 fresh-browser observations remain unavailable. No new owner decision was needed for these offline increments.
