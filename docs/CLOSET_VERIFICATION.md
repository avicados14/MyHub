# Closet Planner verification — 2026-10-05

Base: MyHub `0efd3de98e1054bf7e5ac72f2339c7399c591565`.

## Verified

- `npm run check`: passed (portable contract, formatting, ESLint, full project type checking, 135 unit tests, production build).
- `supabase/tests/closet_rls.sql`: passed against the MyHub database inside a transaction that rolled back all fixtures. Ownership insert/update/read denial, immutable garment numbering, snapshot immutability, plan persistence, repeat-plan idempotency, dirty exclusion, laundry reset, storage folder ownership and revoked-link denial.
- Both additive closet migrations applied to MyHub. Private `wardrobe` bucket created with MIME/size restrictions.
- `myhub-closet-session` deployed with capability authentication; existing encrypted-data broker unchanged.
- `closet-recommend` deployed with JWT authentication and explicit disabled response; no OpenAI call made or key added by this change.
- Supabase security advisor: zero findings after explicit deny policies were added to service-only tables (including an existing pairing-table informational notice).

## Browser/live verification status

The desktop/tablet/mobile contract test is `tests/closet.spec.ts`. It covers the MyHub authentication bridge contract, ZIP import, outfit save, dirty exclusion, laundry, restored recommendations and exact duplicate review. It uses a simulated backend; live RLS testing is separate.

Passed on desktop, tablet and mobile (3 tests), including a failed database insert followed by retry, actual image decoding through the Storage API mock, confirmed replacement with historical snapshot preservation, invalid/oversized ZIP entries, and WCAG A/AA automated checks. The normal Playwright Chromium download returned a truncated archive; verification used Chromium 138 supplied through an isolated npm browser package, without changing the project browser configuration. The usual CI browser still needs its own run before merging.

The full browser regression run passed 134 of 135 tests. The one failure was reproduced on unchanged main: the existing mobile calendar drag test targeted a day outside the viewport. The test now scrolls the source day into view before calculating pointer coordinates, without weakening move/resize assertions; the focused test passed on desktop, tablet and mobile. A second full-suite run was unnecessary because only that test setup changed.

Automatic approval review rejected creating a persistent production test access credential. No such fixture was created. A real sign-in/private image upload round trip requires an already linked device or explicit approval for isolated test access. The SQL checks above rolled back all data and did not need persistent credentials.

Automatic approval review also rejected pushing to `avicados14/MyHub` because it requires explicit publishing authorization. Frontend changes are prepared locally, not merged or published; backend migrations/functions described above are already applied.

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
