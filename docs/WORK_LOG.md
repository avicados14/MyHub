# MyHub continuation work log

This is the running implementation record for Phase 2. Dates use America/Denver unless explicitly marked UTC. Evidence is limited to source, synthetic tests, and privacy-safe aggregate metadata. No private links, credentials, feed URLs, calendar contents, personal records or backup payloads belong here.

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
- The native acceptance gate in `MYHUB_IOS_PLAN.md` still requires a choice: port existing web behavior as the baseline, or revise specified workflows first. The schema/fixtures and working native foundation are available for that review.
- Full native editing and calculation parity, integrations, selected sync/access model, device accessibility and distribution are not complete. See `NATIVE_DECISIONS.md` and TODO for their dependency order.
- A task stalled for 30 minutes must be stopped, documented and narrowed before resuming. No blind workflow reruns; inspect the exact failure first.

Append each implementation checkpoint with changed files/behavior, commit, commands/run IDs, outcomes and remaining blockers. A passing design review or build does not complete an implementation or device acceptance task.

### September 29 — validation approach corrected

A narrower local headless Chromium download also failed with an invalid ZIP. Further local browser-download retries were stopped. The existing PR workflow now runs the two date regressions and the Canvas path across all three viewports with zero retries before its full browser matrix. This gives focused evidence and prevents masking a repeated failure with retries. Native source is unchanged from its successful build.

### September 29 — native calculations added for verification

After publishing the clock/log checkpoint as `8e5e910`, continued independent native work against the synthetic contract: ingredient scaling and cooking fractions, eight-field consumption-only nutrition totals, source visibility, homework ranking, and deterministic study-plan previews. Added Swift golden tests plus invalid-duration, locked-block and disabled-feed cases. The native recipe view now offers non-destructive serving previews, and School offers a study-plan preview; neither writes a schedule or changes historical data. This is a partial workflow port, not completed feature parity. Native CI must validate this new source before it is reported as working.

### September 29 — focused clock/Canvas gate passed

At `8e5e910`, web workflow `36580422648`, job `109446821494`, completed the focused meal-date/Canvas regression step successfully across desktop, tablet and mobile with retries disabled (nine selected cases). The full matrix was still running at this observation; no full-suite pass is claimed yet. Native workflow `36580422782` also passed for the earlier foundation source. The next commit contains additional native calculations and therefore needs a new native validation result.
