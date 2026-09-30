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
