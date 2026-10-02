# Web release readiness — 2026-09-30

## Scope

Prepare the web app from current main. Native work remains separate. Existing
routes, feature pages, storage, and sync entry points are retained.

## Candidate changes

- Validate nested portable backup data before importing it.
- Retain depleted shared batches so undo restores their original identity;
  hide depleted batches from available-food choices.
- Validate private-link creation inputs before revoking existing links.
- Keep portable schema generation checked in CI and stabilize date-sensitive
  browser cases with explicit clocks.

## Evidence

- Local web gate passed: contract drift, formatting, lint, TypeScript,
  126 unit tests across 26 files, and production build.
- Earlier broader branch passed 132 browser cases. This is prior evidence,
  not a passing browser gate for this exact web-only candidate.
- Local Chromium installation failed because the download was incomplete.
- Live browser navigation was interrupted before returning a result.
- No production deployment or Supabase data mutation was performed in this pass.

## Remaining release gates

- Run the full browser suite on this exact candidate in GitHub Actions.
- Verify the deployed web app, fresh-session behavior, and persistence.
- Verify linked-session sync without logging secrets or personal records.
- Review private-link replacement: an insert failure after revocation is still
  a non-atomic failure path. The validation fix does not resolve that path.
- Deploy only after release gates pass; verify the resulting deployment.

## Mistakes to avoid

- Do not count mocked broker tests as live sync verification.
- Do not count earlier branch results as exact-candidate results.
- Do not interrupt a running browser gate with documentation-only pushes.
- Never log credentials, private links, encrypted recovery material, or records.
- Preserve original functionality and add regression tests for reproduced bugs.
