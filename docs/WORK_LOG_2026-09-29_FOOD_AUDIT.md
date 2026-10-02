# Food continuation and original-functionality audit

## Plan and safeguards

1. Compare the continuation against original main; rerun web regression gates.
2. Add offline native meal-consumption editing and shared leftover balances using the existing web semantics.
3. Validate Swift source on Mac CI before declaring the increment verified. Preserve incomplete feature and device acceptance gates.

Use synthetic fixtures only. Do not infer live sync success from mocked provider tests or database health. Keep backend-specific private metadata out of repository logs. Read current CI results before reusing historical test totals. Do not repeat blocked full-file documentation uploads containing old private details; maintain this safe continuation log instead.

## Original web functionality

Compared original main `3472b55` with dashboard source `6e66334`: no web feature pages, routes, assets, AppContext, sync/encryption source, broker or migrations were removed or modified. The only production web change is nested backup validation after migration. Added legacy/v2 fixtures cover valid imports and history; malformed imports are intentionally rejected. Two browser tests received fixed clocks. This supports preservation of original web functionality, not a claim that the unfinished native app already has every web feature.

Current prior head `9186661` passed full web workflow `36629034013` and native workflow `36629034038`. Local recheck passed all 124 tests in 24 files and formatting, schema drift, lint, types and production build. Live backend metadata/access checks resumed after the prior approval-review usage limit cleared; no backend writes or deployments were performed. These checks are not a fresh-browser restore or live write-conflict test. Original linked-session settled status and fresh-browser acceptance remain open.

## Native food increment

Added Meals and consumption from Food, an explicit total-consumed editor, and shared leftover balances. Saving replaces only this meal's generated nutrition log, based on its immutable source snapshot; zero clears that log. Planned/prepared amounts, recipe records, other consumption history and completed-trip history stay intact. Commands reject negative/nonfinite amounts and stale meal drafts; atomic persistence precedes UI publication.

Core tests cover the golden shared balance, nutrition snapshot independence, replacement/clear/stale edits, full consumption and undo, history preservation and backup round trip. Mac CI results pending. This is not full food parity: recipe/package editing, meal creation/planning, pantry/grocery workflows, direct leftover consumption and legacy repair remain open. Integration/access decisions and on-device acceptance remain separate.

## Reproduced depletion/correction defect

The synthetic web regression failed before the fix: depleting a custom-ID batch removed its identity; correcting consumption recreated a different ID and missed consumption by a linked meal. Preserve existing depleted batch records at zero so undo keeps the original identity. Available-leftover lists/defaults filter depleted batches. Explicit removal remains unchanged. The native port follows the corrected rule. Focused regression plus 11 existing meal lifecycle tests passed; full gates are required before release. This is an additional narrow web correction after the original-functionality comparison above, not a removed workflow.

## Verified native checkpoint and broker review

`5214070`: native workflow `36657003252` passed **24 Swift tests** and the iPhone/iPad simulator build. Local full web gate passed **125 tests**, static checks and build. Full browser workflow `36657003116` was still running at this checkpoint.

Live read-only checks confirmed the broker is active, the table has RLS with no direct client grants and a deny policy, and the security advisor returned no findings. Preflight returned 204; an invalid synthetic resolve ID returned 400. Reviewed deployed conditional revision/write-token/revocation checks. No live credentials or user document were changed. These observations are not a live fresh-browser restoration or end-to-end write test.

Reproduced a broker ordering defect using the actual source handler with mocked Supabase/GitHub dependencies: an authenticated malformed create request revoked existing access before returning 400. The regression failed (one mutation instead of zero), then passed after moving create-payload validation before revocation. This fix is source-only and awaits deployment review; the deployed function has not changed. Link replacement remains non-atomic if the subsequent insert fails; that is a separate unresolved recovery risk. Checked current Supabase changelog; this correction changes request validation ordering without changing SDK/API usage.

## Remaining checklist

- [x] Audit original web feature/source preservation and rerun baseline gates.
- [x] Native meal-consumption editor and golden batch/history tests, Mac build verified.
- [x] Reproduce and correct custom batch depletion/undo; full browser gate still pending.
- [x] Reproduce malformed broker creation revocation and add source fix/regression.
- [x] Validate full food browser gate and final local source gates; see final checkpoint.
- [ ] Review/deploy broker fix and address atomic link replacement separately.
- [ ] Observe original linked-session settled state and fresh-browser restore.
- [ ] Complete native recipes/packages, meal planning, pantry/groceries, direct leftover consumption and history workflows.
- [ ] Finish dashboard/calendar parity, direct legacy migration, device/accessibility acceptance, integration models and approved native sync/access model.

## Preservation matrix and final local gate

| Original area                                       | Change scope                                                                | Evidence/limit                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Web dashboard, Calendar, School, study planner      | No feature source changes                                                   | Existing unit/browser regression gates retained                                                |
| Recipes, packages, meal planning, pantry, groceries | Existing workflows retained; depleted leftover choices filtered             | Narrow batch undo regression and existing lifecycle tests pass                                 |
| Historical meal/nutrition/trip snapshots            | Preserved; a consumption correction only replaces that meal's generated log | Native snapshot/history and full backup round-trip tests pass                                  |
| IndexedDB and backups                               | Nested import validation added after migration                              | Valid v1/v2 import fixtures pass; malformed records rejected                                   |
| Encryption, revision sync and access client         | Unchanged                                                                   | Existing mocked phone/focus/reload/conflict tests retained; live browser acceptance still open |
| Broker and database                                 | Source request-validation order corrected; deployment/schema unchanged      | Actual handler regression uses synthetic credentials and mocked dependencies                   |

Final local `npm run check` passed **126 tests in 26 files**, contract drift, formatting, lint, strict TypeScript and production build. The full food browser CI must finish before its result is claimed. Main TODO/FIXME remain historical checkpoints; the current remaining checklist in this document supersedes their pending status for this bounded increment without retransmitting private historical details.

## Final checkpoint

Food commit `5214070` passed the complete web workflow `36657003116`, including 132/132 full browser cases, nine focused regressions and production build, and native workflow `36657003252`. Broker fix `5566fc2` is separately reviewable in draft PR #19, based on PR #18's continuation branch; separating it avoided cancelling the food run. Its actual-handler regression and final local 126-test/static/build gate pass. It is not deployed. On-device/native UI acceptance, live private-browser sync proof and atomic link-replacement recovery remain open.
