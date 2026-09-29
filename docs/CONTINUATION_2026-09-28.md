# Continuation evidence — September 28, 2026 (America/Denver)

## Current baseline, not the archive's HEAD

- Public MyHub main at investigation: `3472b5513012ddb0481550334d40d58e1fba1953`, including TODO and FIXME.
- Current private-repository workflow and producer were read through the GitHub connector. Latest commit returned: `fee85564064e159127ad0f23e40b6a1bccf05a09`, timestamp September 28 23:54:13 UTC. This is newer than the archive's `4a0b91d`. No ciphertext or feed contents were retrieved. A successful run at this newer commit has not been independently established.
- Connected MyHub Supabase project: ACTIVE_HEALTHY; broker ACTIVE, deployed version 3. Five migrations were listed. Remote migration timestamps differ from the source filenames; names correspond. No schema/deployment changes were made.
- Aggregate-only SQL: four broker records, one active; active revision **60**, data updated **2026-09-28 22:53:52.106 UTC**, last resolved **23:07:54.411 UTC**. The query selected no row IDs, capabilities, hashes or encrypted payloads.

## Phase 1 verification remains blocked, not failed

The available browser inventory contained only one blank tab. The handoff does not supply a usable live private-link session. Therefore neither the original browser's settled Supabase sync status nor an independent fresh-profile assignment count could be observed.

Revision 60 confirms that Supabase accepted a write. It cannot establish the encrypted document's assignment count, which import produced it, or whether a fresh browser restored it. The handoff's **3,332 events / 168 assignments** remains a September 28 connected-browser observation. No sync defect was reproduced and the Canvas UID parser was not changed.

To close the gate: make the original linked browser available; record only its latest Supabase sync time/status and aggregate counts; open the existing private link in a separate clean browser profile, record counts and matching revision/status, and compare. Do not paste the private link into a PR, issue, log or chat. Do not generate a replacement capability just for verification.

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
