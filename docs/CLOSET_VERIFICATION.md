# Closet Planner verification — 2026-10-06

Base: MyHub `0efd3de98e1054bf7e5ac72f2339c7399c591565`.

## Verified

- `npm run check`: passed (portable contract, formatting, ESLint, full project type checking, 135 unit tests, production build).
- `supabase/tests/closet_rls.sql`: passed against the MyHub database inside a transaction that rolled back all fixtures. Ownership insert/update/read denial, immutable garment numbering, snapshot immutability, plan persistence, repeat-plan idempotency, dirty exclusion, laundry reset, storage folder ownership and revoked-link denial.
- All three additive closet migrations applied to MyHub. Private `wardrobe` bucket created with MIME/size restrictions.
- `myhub-closet-session` deployed with capability authentication; existing encrypted-data broker unchanged.
- `closet-recommend` deployed with JWT authentication and explicit disabled response; no OpenAI call made or key added by this change.
- Supabase security advisor: table/storage policy findings resolved. Final advisor reports one Auth warning: leaked-password protection disabled. This passwordless bridge does not accept passwords. Enabling the project setting requires Dashboard access and a Pro-or-higher plan; the connector does not expose Auth configuration. See [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Browser/live verification status

The desktop/tablet/mobile contract test is `tests/closet.spec.ts`. It covers the MyHub authentication bridge contract, ZIP import, outfit save, dirty exclusion, laundry, restored recommendations and exact duplicate review. It uses a simulated backend; live RLS testing is separate.

Passed on desktop, tablet and mobile (3 tests), including a failed database insert followed by retry, actual image decoding through the Storage API mock, confirmed replacement with historical snapshot preservation, invalid/oversized ZIP entries, and WCAG A/AA automated checks. The normal Playwright Chromium download returned a truncated archive; verification used Chromium 138 supplied through an isolated npm browser package, without changing the project browser configuration. The usual CI browser still needs its own run before merging.

The full local desktop/tablet/mobile regression rerun passed **135/135 tests**. An earlier mobile calendar pointer failure was reproduced on unchanged main: the test targeted a day outside the viewport. Its setup now scrolls the source day into view without weakening assertions.

GitHub CI passed all 132 pre-existing browser cases but exposed a base-path assumption in the new closet fixture. Navigating from `/MyHub/` to `/#/closet` reloaded the app and caused its deliberately incomplete mock capability to be cleared. The test now preserves the current base path for hash navigation. Reproduced the failure with `GITHUB_ACTIONS=true`, then verified the corrected closet test on desktop/tablet/mobile under that configuration. No application behavior or validation gate changed. Full standard-browser CI remains the release gate in [PR #25](https://github.com/avicados14/MyHub/pull/25).

After explicit user authorization, a temporary production capability verified real session issuance, private Storage upload, signed image access, sequential garment numbers, anonymous denial, atomic plan persistence, immutable snapshots, same-plan retry and laundry reset. Synthetic garments, plans and images were removed. Revoking the temporary capability denied both new sessions and existing-JWT row/upload access. No user data was modified.

The live test caught OTP invalidation when account metadata was updated after link generation. The bridge now updates metadata first, generates a fresh token, and uses its actual verification type. Existing identities no longer repeat the provisioning/mapping operation on every login. Function version 2 is deployed.

Cleanup review found no identical source files, copied standalone app, public garment photos, or unused-import lint findings. Existing shared components, native contracts and historical migrations were retained. Publishing is authorized; PR #25 carries the release through the unchanged validation/deployment workflow.

## Changed files and rationale

- `src/features/closet/{ClosetPage.tsx,closet.css,types.ts}`: responsive integrated gallery, metadata editing, filters, rule-based planner, weather, laundry, immutable history, JSON export and confirmation flows.
- `src/features/closet/{import.ts,api.ts,closet.test.ts}`: bounded local ZIP validation, SHA-256/dHash review, private uploads, stable retry IDs and service tests.
- `src/app/{App.tsx,AppShell.tsx}`: lazy `/closet` route and sidebar/mobile-menu entry. Existing routes remain intact.
- `supabase/migrations/*closet*.sql`: schema, counter trigger, transactional planning, live capability authorization, RLS and private storage policies.
- `supabase/functions/myhub-closet-session/index.ts`: existing-capability bridge to a stable service-owned Auth identity.
- `supabase/functions/closet-recommend/index.ts`: authenticated disabled future-AI scaffold.
- `tests/school-calendar-v2.spec.ts`: repair an existing mobile drag-test viewport assumption, confirmed against unchanged main; application calendar behavior is unchanged.
- `supabase/tests/closet_rls.sql`, `tests/closet.spec.ts`: live rollback security tests and browser contract flow.
- `package.json`, `package-lock.json`: pinned Supabase/fflate dependencies; typecheck now actually checks referenced projects.
- `tsconfig.app.json`, `vite.config.ts`: correct ES2023/Vite/Vitest types, exposing and repairing the existing ineffective typecheck gate.
- Three small existing typing fixes: nutrition label detected-field union; valid private-access badge tone; optional calendar-feed URL guard. No feature removal.
- `.gitignore`: exclude Supabase CLI cache.
- `README.md`, `docs/CLOSET_{PLAN,SETUP,VERIFICATION}.md`: architecture, operational setup, privacy distinctions, limitations and verification.

## Remaining operational points

Existing ClothesPlanner account data/photos have not been moved; its Wearwise project is inactive. Import your private ZIP through the new UI. Do not copy its public starter images into MyHub. Closet photos are private access-controlled Supabase objects, not end-to-end encrypted AppData. Historical images are retained when needed by plans. A review discarded during an uncertain failure can leave a private staged object for later reconciliation. JSON exports contain paths/metadata, not image bytes.

## Session revocation hardening

Final review identified that account-wide metadata can change when another device signs in, and a refreshed old session could inherit it. Migration `closet_session_binding` replaces that authorization lookup with a service-only immutable mapping from the JWT session ID to its originating MyHub capability. The lookup also requires the Auth session to exist. Function v4 registers the binding before returning tokens and removes the now-redundant account-metadata update. Expanded rollback tests cover unbound Auth sessions, client binding denial and refresh carrying another active link's metadata. The initial frontend release remains unchanged by this server-side correction.

Live verification passed bound-session issuance/private upload, then real Auth token refresh after capability revocation: refreshed JWTs retained the original session ID and were denied reads/uploads. The test image was removed, the Auth session signed out and the temporary capability deleted. Advisors found no database/storage findings; the documented leaked-password setting warning remains.
