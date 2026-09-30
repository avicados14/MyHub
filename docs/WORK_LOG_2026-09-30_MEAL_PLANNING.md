# Native meal planning — September 30, 2026

Continued the pending recipe/package meal-planning increment on PR #18's branch. PR #19 retains the separate source-only broker fix; it remains undeployed. No private archive, credentials or personal fixtures were accessed.

## Implemented

- Create a recipe or packaged-food meal plan with a local date, meal slot and positive servings.
- Capture the source nutrition/provenance snapshot. Planning creates no prepared servings, consumption log or leftovers.
- Move/resize untouched plans without changing their original snapshot or identity; confirm before deleting them.
- Reject stale food/meal drafts and occupied slots. Existing plans are never silently displaced. Plans with preparation, consumption, leftovers, automatic allocations or linked logs are protected.
- Save atomically before publishing UI changes. Keep all prior consumption controls.

This is a bounded increment, not full parity with web meal editing. Prepared/batched plan editing, custom food, leftover planning, auto-allocation, pantry/grocery flows and native source editing remain open. The existing web functionality and broker are unchanged by this increment.

## Verification and remaining checklist

- [x] Trace the web meal editor's recipe/package snapshots and explicit meal quantities.
- [x] Implement commands and native forms with focused synthetic tests.
- [ ] Verify new Swift tests and simulator build on Mac CI.
- [x] Local `npm run check` passed 125 tests in 25 files, contract drift, formatting, lint, strict TypeScript and production build.
- [ ] Complete the remaining food workflow ports and direct native legacy migration.
- [ ] Complete device/accessibility acceptance, integration models and selected native synchronization.

Tests cover source snapshots, planning versus consumption, local dates, packaged sources, stale/occupied/invalid drafts, protected history, deletion scope and backup round-trip. No full native UI/device acceptance is claimed from core tests or a simulator build.

## Publication blocker

Automatic approval review rejected the GitHub create-tree upload, saying the repository was not established as trusted or explicitly authorized for disclosure of this code/documentation. No new remote commit or PR update was made for this increment. The implementation is retained in a local reviewable commit; renewed explicit user approval for publishing this increment is required before retrying. No alternate upload route was attempted.

This workspace has no Swift/Xcode toolchain. The four new Swift test cases and native UI therefore remain unverified until publishing is allowed and Mac CI runs. The passing 125-test web gate does not compile Swift. Prior source remains in PR #18 and the separate broker fix remains in PR #19.
