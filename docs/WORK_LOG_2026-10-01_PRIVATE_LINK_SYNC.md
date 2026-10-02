# Private-link replacement and live sync verification

Date: October 1 UTC / September 30, 2026 in America/Denver.

## Fix deployed

Replaced the broker's separate revoke and insert requests with one service-role-only,
security-invoker Postgres function. Revocation and insertion now commit together or
roll back together. A table writer lock serializes replacements even when no active
row exists, and coordinates with revoke and push operations. Existing capability
checks, encrypted payload format, response shape, and optimistic version checks remain.

Migration: `20261001004009_atomic_private_link_replacement.sql`.
Broker: deployed active version 4, preserving custom authentication configuration.

## Verification

- Full local gate: portable contract, formatting, lint, typecheck, 128 unit tests
  across 26 files, production build passed.
- Handler regressions cover malformed input before mutations, successful atomic
  RPC dispatch, and insertion failure returning a safe error without standalone writes.
- Live SQL regression ran as service_role: a forced insertion constraint failure
  preserved active links; successful replacement left exactly one active link.
  The entire test transaction rolled back, including the successful replacement.
- Function execution denied to anon/authenticated and allowed to service_role.
- Supabase security advisor: no findings.
- Live deployed HTTP broker with an isolated synthetic encrypted fixture: resolve
  and decrypt with the application's actual crypto module; reject wrong write
  capability (403); accept encrypted push and increment revision; reject stale
  revision (409); independently resolve and decrypt the updated payload.
- Revoked synthetic fixture returned 404; the exact temporary row was then deleted.

## Scope and limits

Live HTTP verification uses synthetic data in a dedicated temporary row. It does not
claim verification of the user's personal linked browser, GitHub backup, or browser
IndexedDB persistence. Personal records and existing access links were not replaced.
The UI code is unchanged from PR #20's previously passing 132-browser-test candidate.
No frontend deployment or merge is included in this backend fix.

## Lessons retained

Use a database transaction for multi-step access changes. Do not substitute two
successful mocked calls for rollback verification. Keep production test fixtures
isolated, clean up only their exact IDs, and never log credentials or personal data.
