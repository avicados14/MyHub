# Continuation evidence — September 28, 2026 (America/Denver)

## Current baseline, not the archive's HEAD

- Public MyHub main at investigation: `3472b5513012ddb0481550334d40d58e1fba1953`, including TODO and FIXME.
- Current private-repository workflow and producer were read through the GitHub connector. Latest commit returned: `fee85564064e159127ad0f23e40b6a1bccf05a09`, timestamp September 28 23:54:13 UTC. This is newer than the archive's `4a0b91d`. No ciphertext or feed contents were retrieved. A successful run at this newer commit has not been independently established.
- Connected MyHub Supabase project: ACTIVE_HEALTHY; broker ACTIVE, deployed version 3. Five migrations were listed. Remote migration timestamps differ from the source filenames; names correspond. A read-only check also confirmed RLS enabled and no direct SELECT/INSERT/UPDATE/DELETE privilege for anon or authenticated. No schema/deployment changes were made.
- Aggregate-only SQL: four broker records, one active; active revision **60**, data updated **2026-09-28 22:53:52.106 UTC**, last resolved **23:07:54.411 UTC**. The query selected no row IDs, capabilities, hashes or encrypted payloads.

## Phase 1: remote counts verified; browser acceptance remains open

Correction on September 29: the additional private-handoff README identified protected recovery material in the full archive. The initial statement that the handoff supplied no usable link was incorrect. The available browser inventory still contained only one blank tab.

A fresh stateless client used the current application's `resolvePrivateAccess` implementation to retrieve and decrypt the live Supabase document, retaining contents only in memory and emitting counts/revision metadata only. Result: revision **60**, updated **September 28 at 22:53:52.106 UTC**, contained **3,361 events and 168 assignments**. Temporary recovery material was removed. No replacement capability or document write was made; resolving access may update access-status metadata.

This establishes that 168 assignments reached Supabase and are independently retrievable with the existing capability. It does not establish record-by-record identity with the September 28 import, why the event count differs from the handoff's 3,332, or successful hydration/rendering in a fresh browser. The handoff's **3,332 events / 168 assignments** remains its historical connected-browser observation. No sync defect was reproduced and the Canvas UID parser was not changed.

To close the remaining UI gate: observe the original linked browser's settled Supabase status, then restore the existing private link in a separate clean browser profile and compare School's aggregate count and revision/status. The original linked session is unavailable, and the available browser has no private session. Never paste the capability into a PR, issue, log or chat or replace it merely for verification.

## Implementation trace

1. `MyHub-Data/.github/workflows/sync-calendars.yml` schedules every 30 minutes and allows manual dispatch. `scripts/sync-calendars.mjs` fetches secret-configured feeds concurrently with bounded timeouts, keeps prior successful source data on failures and commits changed encrypted `calendars.enc` only.
2. `GitHubSyncContext.calendarAccess` fetches the private encrypted file and decrypts in provider memory. `calendarSnapshot.ts` validates the snapshot and invokes `ics.ts`. Canvas canonical assignment UIDs are recognized only for Canvas feeds.
3. `CalendarPage.importPrivateSnapshot` merges events and assignments, updates feed counts/provenance through `AppContext.updateData`, and runs on Calendar open, explicit check and 15-minute intervals while open. These counts are import results, not necessarily total surviving AppData counts. `SchoolPage` uses `visibleAssignments`, then status/filter/ranking logic; disabled feeds can hide retained assignments.
4. `AppContext` reconciles meal-batch links and updates React state. Its persistence effect replaces the IndexedDB `application/state` aggregate. Credentials remain in a separate store.
5. `GitHubSyncContext` observes data changes. After 650 ms, its serialized Supabase push queue compares a digest, encrypts AppData through `privateAccess.ts`/`crypto.ts`, and pushes with the expected revision and write capability. The broker checks the capability hash and conditionally advances the revision; a stale revision returns 409. Focus/online/visibility events check for a newer remote copy.
6. A separate 1,800 ms debounce/serialized queue maintains the GitHub backup with conditional SHA writes. Supabase and GitHub state are distinct; a GitHub “current” badge alone does not prove the Supabase write. Startup sets the private session metadata before replacing data, with a hydration readiness boundary. Current code still verifies GitHub repository privacy before hydration; the archived handoff's blanket statement that all GitHub verification is asynchronous is broader than this implementation (snapshot synchronization itself is queued).
7. Food routes call meal-workflow functions; nutrition selectors sum foodLog snapshots. Grocery completion copies the active list into history and performs pantry handoff separately. Feature pages use `AppContext`, not direct IndexedDB writes.

## Confirmed correction and bounded work

A synthetic v2 backup with `recipes: [{}]` passed the old shallow importer. A focused failing test reproduced this, and nested contract validation now rejects it before replacement. This is independent of the live sync uncertainty.

The native contract/foundation is a compatibility candidate. Full editing, business-calculation parity, EventKit, capture, sharing and synchronization are not claimed complete. See `NATIVE_DECISIONS.md` for the choices needed before those dependencies proceed. No stalled operation was allowed to run for 30 minutes; failed private git access was replaced by authorized connector source reads.

Test results for this branch are recorded in FIXME and the draft PR. Historical test totals elsewhere remain historical evidence, not results of this continuation.

Native validation at `ce707bf`: macOS workflow `36507350376` passed 3 Swift tests and the standalone simulator build. Local web `npm run check` passed 121 tests in 23 files plus all static/build gates. Local Chromium download was an invalid ZIP; the remote browser gate is the authoritative browser result.
