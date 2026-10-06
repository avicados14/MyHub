# Closet Planner setup and operation

## Open the feature

Use your usual MyHub private link or already linked device, then choose **Closet Planner** in the sidebar (on a phone, open the navigation menu). Production route: https://avicados14.github.io/MyHub/#/closet. Existing Home, School, Calendar, Food, Grocery, Pantry, Settings, encrypted sync, native contracts and GitHub Pages workflow remain in place.

MyHub uses a repository-wide bearer capability rather than email authentication. The `myhub-closet-session` function validates that capability and associates it with a service-owned Supabase Auth identity. There is no second login or password. Replacing the private link preserves the same wardrobe owner; revocation blocks old JWTs through a live database check. The bridge verifies the SHA-256 write-token hash and never returns a service-role key. Sessions are held in memory; refresh obtains another session through the existing MyHub capability. The service-only synthetic email is not a real mailbox and is never used to send mail. Existing ClothesPlanner email identities/data are not automatically merged: that requires explicit ownership verification and data transfer.

## Supabase

Project: MyHub (`vlsxvwqmzcriarcctubr`). Apply the two closet migrations in `supabase/migrations` in order through the project's standard migration process. For a new environment, apply existing MyHub migrations and device-pairing setup first. Never run these against the Wearwise project by mistake. The committed migration filenames match the versions applied through the management connector; do not apply the same DDL twice.

Deploy:

- `myhub-closet-session`, including its relative `myhub-private-access/http.ts` dependency. Gateway JWT verification is disabled only because the handler authenticates the existing capability itself.
- `closet-recommend`, with JWT verification enabled. It is intentionally disabled scaffolding and returns `AI_NOT_CONFIGURED`.

The existing encrypted-data broker is unchanged. Its identity and encryption keys are not moved into wardrobe rows.

### Configuration

| Variable                        | Location                                     | Purpose                                                                                                 |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Frontend build, optional for this deployment | Defaults to the existing MyHub Supabase project.                                                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend build, optional for this deployment | Public publishable key; defaults to the existing MyHub key. Safe only with the included RLS.            |
| `SUPABASE_URL`                  | Edge Function runtime                        | Supabase-provided project URL.                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Edge Function runtime only                   | Supabase-provided admin key for capability validation and session bridging. Never use a `VITE_` prefix. |
| `SUPABASE_ANON_KEY`             | Edge Function runtime only                   | Supabase-provided key for the future recommendation endpoint's user-scoped client.                      |
| `OPENAI_API_KEY`                | Future server-side secret only               | Not read or used by the current disabled placeholder.                                                   |

For any future email-based account-linking callback, set Supabase Auth Site URL to `https://avicados14.github.io/MyHub/` and add that exact URL to redirect allowlists (plus explicit localhost development URLs as needed). The capability bridge uses no email redirect. Never put private-link fragment values in redirect settings. Do not enable a second email login without implementing verified account linking and a callback compatible with MyHub's hash router.

### Privacy and storage

`wardrobe_items` and `outfit_plans` enforce owner UUID and active MyHub capability through RLS. Database-generated garment numbers are immutable, monotonic and never reused after deletion. Planning locks selected rows, checks cleanliness, constructs immutable snapshots and marks garments dirty within one transaction; retrying the same plan UUID returns the previous plan.

The `wardrobe` bucket is private, allows JPEG/PNG/WEBP/GIF and limits objects to 8 MB. Object paths start with the authenticated user UUID. Image URLs expire after five minutes and are renewed while the page is open. Already-issued signed URLs can remain usable until expiry after link revocation. Wardrobe metadata/photos are protected by Supabase access controls, **not end-to-end encrypted like MyHub AppData**. No photos are copied into public assets or Git. The JSON export includes metadata, image paths and historical snapshots; it does not embed image bytes or credentials.

Deleting a garment asks for confirmation. Replacing a duplicate asks for confirmation and retains its stable number. Old photo objects referenced by immutable outfit history remain private so history still displays its original photos. Unreferenced old photos are removed where possible. Do not bulk-delete objects merely because their garment row has been removed.

## ZIP import

Choose **Import closet ZIP**, or **Add garment photo** for one image. ZIPs are decoded locally. Hidden/system paths, traversal paths and unsupported files are ignored. Limits: 250 images; 8 MB per image; 100 MB ZIP and expanded supported-image total; 2,000 archive entries; 40 megapixels per decoded image. Streaming output limits reject expansion beyond bounds. Invalid signatures and undecodable/corrupt images are listed with filename and reason.

Every accepted image gets SHA-256 and, when canvas is available, a 64-bit dHash. Exact matches and dHash distance ≤5 are review suggestions, not proof that two garments are identical. Review offers skip, keep both, or replace an existing photo. Within-batch duplicates can be skipped or kept; replacing refers only to an already saved garment. Filename-derived names/categories/colors are editable and are not AI classifications. Animated images use the decoded frame for visual comparison.

Upload starts only after review. Per-entry operation UUIDs stay stable in the review list. A record is inserted only after upload; a retry verifies an existing object by SHA-256. If database commit status is uncertain, the staged object is retained until retry rather than deleting a possibly committed photo. Keep the review list open to retry failures safely. Closing/reloading an unresolved review can leave an unreferenced staged object; this is not exposed publicly and must be reconciled before manual cleanup. Successful entries are not re-uploaded during batch retry.

## Planner and future AI

Default weather is Golden, Colorado in Fahrenheit via Open-Meteo. Device location is optional. Weather failure is shown, and no temperature is fabricated. The local rule-based planner chooses clean tops/bottoms or a one-piece garment, optional shoes, and an available outer layer below 62°F. It uses simple filename-based occasion preferences. Notes are saved for history, not interpreted as AI instructions. Saving immediately marks selected garments dirty; **Run laundry** restores them to clean.

To implement AI later, extend `closet-recommend` after server-side `getUser()` verification. Keep its user-scoped RLS query; validate weather, occasion and note lengths, send only necessary garment metadata, request structured JSON, and reject every returned garment ID not in that user's current clean set. Add rate limits, cost controls, model-output tests, a server-side `OPENAI_API_KEY` secret and an explicit feature flag. Do not claim AI is active merely because a key is set: the present endpoint intentionally remains disabled. Planning must still use the transactional RPC and revalidate cleanliness.

## Verification

- `npm run check`: portable contracts, formatting, lint, full TypeScript project checking, unit tests, build.
- `npm run test:e2e -- tests/closet.spec.ts`: deterministic browser contract flow on desktop/tablet/mobile with a simulated Supabase backend.
- `supabase/tests/closet_rls.sql`: rollback-only live database checks using isolated fixtures. Verifies ownership, immutable numbers/snapshots, atomic planning, retry, laundry, private folders and revoked-link denial.
- Run Supabase security advisors after migrations.

An explicitly authorized live production round trip passed session issuance, private uploads, numbering, outfit persistence/retry, laundry and anonymous/revoked-access denial. Synthetic rows/images were removed and the temporary credential revoked. Browser ZIP/review coverage uses a simulated backend; it is not described as a production UI test.

The final security advisor reports only leaked-password protection disabled. The current capability bridge is passwordless. Enable this project-wide setting in Supabase Dashboard Auth settings if the project plan supports it (Pro or higher); the available connector cannot change it. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
