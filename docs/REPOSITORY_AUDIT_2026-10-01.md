# Repository and feature audit — October 1, 2026

## Scope and evidence

Inventoried all 124 tracked files on current main `3472b5513012ddb0481550334d40d58e1fba1953`.
The accompanying TSV records every file, byte size, role, and cleanup decision.
Traced the documented web requirements to routes, implementations, and regression
coverage. This is a repository audit, not a claim that every real-device interaction
or external provider has been manually retested.

## Requested feature coverage

| Requirement                                                      | Implementation and coverage                                                  | Status                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Dashboard schedule, study, food, nutrition                       | DashboardPage; dashboardSchedule; crosscut browser tests                     | Present                                                         |
| Calendar day/week/month, manual events, ICS and Canvas homework  | CalendarPage; ics; school-calendar-v2 tests                                  | Present; direct provider fetch subject to CORS                  |
| Homework/subtasks and study planning with locks, moves, resizing | SchoolPage; study; school-calendar-v2 tests                                  | Present                                                         |
| Recipes, scaling, reviewable imports, OCR and manual fallbacks   | RecipeEditor, RecipeImporter, RecipePage; recipeImport, nutritionLabel tests | Present; remote lookups may fail                                |
| Meal prep, shared leftovers, consumption undo                    | FoodPage; mealWorkflow; food-v2 tests                                        | Present; depleted-batch undo correction in unmerged PR #20      |
| Eight nutrition metrics, packaged foods, logs, goals             | FoodLogEditor, PackagedFoodEditor; nutrition; food-v2 tests                  | Present                                                         |
| Pantry, grocery aggregation/check, purchase handoff and history  | PantryPage, GroceryPage; grocery; grocery-workflows tests                    | Present                                                         |
| Search, settings, dark mode, responsive and keyboard access      | AppShell, SettingsPage; accessibility and crosscut tests                     | Present                                                         |
| Offline storage, migrations, portable backup import/export       | AppContext, database, migrations; database/crosscut tests                    | Present; deeper nested validation in PR #20                     |
| Private-link restore, encrypted Supabase sync and GitHub backup  | PrivateAccessPage, GitHubSyncContext, privateAccess; github-sync tests       | Present; personal browser reload still unverified               |
| Atomic private-link replacement                                  | Service-role-only SQL transaction and broker v4                              | Deployed backend; matching source/migration in PR #20, not main |
| Scheduled encrypted calendars                                    | Separate private MyHub-Data repository                                       | Previously verified; retained outside this cleanup              |
| Native SwiftUI, EventKit, camera/scanner, Share Extension        | Native plan; separate draft development branch                               | Not complete web features; intentionally separate               |

PR #20 head `0cb9a4f11ca80bf7d71bd00f6eee7e61df347f10` passed 128 unit
and 132 browser tests plus build in Actions run `36797774195`. Those results
belong to that candidate, not to this cleanup branch or current deployed main.
The September requirements audit remains historical evidence rather than a current
blanket completion claim. Personal cookbook contents remain encrypted data, not
bundled defaults; an empty first run is intentional.

## Cleanup decisions

Five referenced recipe photos were PNG-encoded despite `.jpg` filenames. Converted
them to progressive JPEG at the same dimensions and paths (quality 88, no chroma
subsampling). This is lossy encoding; it preserves the pictures and compatibility
with existing saved paths while reducing their combined size from 25,803,636 to
3,382,019 bytes (86.9%, about 22.4 MB saved). Original versions remain in Git history.

Removed `tests/visual_review.py`: an unreferenced one-off Python script tied to
`/home/ubuntu/MyHub`, a manually started server, and obsolete grocery buttons.
It was not part of npm scripts or CI. Maintained Playwright acceptance and
accessibility suites remain. Historical screenshots used by README remain.

Kept migrations, lockfile, license, architecture/setup/native plans, TODO/FIXME,
fixtures, tests, and runtime source. No tracked dependency cache, build output,
private handoff ZIP, or personal snapshot was found in the main tree. No branches,
Git history, private data repository files, or hosted records were deleted.
Changing current files reduces checkout/deployment size; it does not shrink old Git
history. No history rewrite is proposed.

## Remaining work

- Merge/release PR #20 separately so main matches the deployed backend fix.
- Verify the actual personal browser restores and persists after reload.
- Keep calendar/import provider limits distinct from missing product features.
- Continue native integrations only in their separate workstream.

## Cleanup verification

Production TypeScript check and Vite build passed. All five converted images decode
as JPEG, retain their original dimensions and paths, and uploaded Git blob hashes
match the local files. No application runtime source was changed. Reviewed a
converted image visually; no layout or content change was intended. Full browser
CI is left to the cleanup PR's normal required workflow.
