# Closet Planner integration plan — 2026-10-05

Baseline: MyHub main 0efd3de98e1054bf7e5ac72f2339c7399c591565. Reference: ClothesPlanner pages/index.html and server/wardrobe.ts.

MyHub is React/Vite with hash routes, shared Card/Field/Modal components, IndexedDB AppData, encrypted Supabase capability sync, GitHub backup, and a separate native contract. It does not currently use Supabase Auth. Preserve all of these interfaces.

## Identity decision

Add a narrowly scoped server-side capability-to-Supabase Auth bridge, not a second visible login. Validate the active private-access write capability before issuing any session. A service-only repository identity maps successive replacement private links to one auth user. JWT app_metadata binds the session to the verified access record; RLS also checks that record is still active. Browser sessions stay in memory and are renewed through the bridge. Existing MyHub data and native contracts remain unchanged. A future email-account migration must explicitly link ownership; never silently merge accounts by a client-supplied email.

## Additive migration

1. Service-only identity record and private authorization helper; no grants to anonymous clients.
2. wardrobe_items with immutable per-user numbers, UUIDs, import operation IDs, content/dHash fields and constrained metadata. Use a monotonic per-owner counter; never recycle deleted garment numbers.
3. outfit_plans with immutable server-built snapshots. A transactional RPC locks clean owned items, saves the plan, and marks them dirty. Idempotent plan UUID handles uncertain network responses.
4. Private wardrobe bucket with owner-folder and active-session policies. Retain old image objects referenced by historical snapshots; explicit garment deletion removes the current row, and removes photos only if unreferenced.
5. Bounded ZIP inspection/extraction, decoded image validation, SHA-256 and dHash review, explicit replacement confirmation, deterministic per-attempt object/item IDs and safe retries.
6. /closet lazy route and shared navigation/layout; weather defaults to Golden in Fahrenheit; local recommendations are explicitly rule based. Future authenticated server recommendation endpoint returns disabled until configured.

## Verification and release

Run current regression tests plus new import/duplicate tests, real transaction-based RLS/numbering/plan checks, storage policy checks, browser flow tests and a production build. Run Supabase security advisors after migration. Keep private photos, capability values and exports out of Git. Deploy only additive backend components. Document any unverified external dependency honestly.
