# Starter wardrobe action list

- [x] Inspect current planner, encrypted profile, and database ownership model.
- [x] Add nullable photos and explicit garment types/preferences using an additive migration.
- [x] Add editable active temperature bands to encrypted profile settings and portable contracts.
- [x] Select clean garments by the planned date's minimum feels-like temperature and color compatibility.
- [x] Support text-only garments and attaching photos without changing IDs or history.
- [x] Test numbering, snapshots, laundry, ownership, rules, weather dates, and photo attachment.
- [x] Apply migration and run security advisors.
- [ ] Deploy and seed the private wardrobe/profile idempotently.

Migration plan: relax only photo/hash nullability, require both together, and add bounded type/preference columns. Existing RLS, private bucket policies, immutable numbering, and atomic outfit snapshot/laundry transaction stay in place. No new auth or public personal data. User inventory is seeded separately via authenticated requests; never embed it in source. Unknown quantities (undershirts) are reminders, not invented items. Missing photos have a text placeholder. Historical snapshots remain immutable when photos are attached later.

Migration applied as 20261015014559. New live rollback test passed. Existing full RLS script rerun was rejected twice by the connector with `Invalid or expired requestState`; no repeated retries. Its session-binding policies are unchanged, and the new live test independently exercised active sessions, ownership, numbering, photo constraints, snapshots, retry and laundry. Focused recommendation unit tests and the full local check passed. Browser checks and deployment remain in progress.

Final local check after incorporating upstream PR #27: 156 unit tests, contract checks, formatting, lint, typecheck and production build passed. Closet workflow and profile persistence passed on desktop, tablet and mobile. Upstream ZIP dependency patch and shared date helper retained. Deployment and private seeding are still pending.
