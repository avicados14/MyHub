# Private clothing profile and active wardrobe

Settings → Clothing profile keeps written inventory/layering notes and editable **active temperature bands** in encrypted AppData. The same editor is available in Closet Planner. Structured bands, rather than free-form notes, drive suggestions. The portable JSON contract and generated Swift models preserve them. Older backups remain valid; exports contain plaintext personal data.

Closet Planner supports real wardrobe rows without photos. Add a garment without a photo, edit its clothing type, color and preference, and correct its initial clean/dirty state. Photo-free garments have the same stable IDs, ownership/session RLS, laundry behavior, and immutable outfit snapshots as photographed garments. Personal inventories are never embedded in public source or frontend assets.

Suggestions use clean garments and the **selected date's daily minimum apparent (feels-like) temperature in Fahrenheit** from Open-Meteo. Golden, Colorado remains the default; device location is optional. Missing or out-of-range forecasts require a manual feels-like low for active personal rules. Unrounded values determine the band, whose minimum is inclusive. Duplicate/invalid bands stop personal suggestions. No configured bands retains the existing generic planner.

Types distinguish short sleeves, long sleeves, sweatshirts, tanks, shorts, pants, jackets, shoes and accessories. Type inference for older/imported rows is only a filename heuristic and is editable. Color coordination is a deterministic heuristic favoring neutral combinations, shared colors, and blue combinations; it is not an AI classifier. Unknown colors do not receive a match bonus. Less-preferred garments are excluded unless explicitly enabled. A warmer-band option moves one band colder in temperature; a separate jacket option adds an available jacket, favoring preferred ones. Missing shoes/jackets are reported rather than invented. Tank requirements use a clean tracked tank when available; otherwise saving requires confirmation of an untracked clean tank. Quantities are not invented.

To add photos later, edit a garment and choose **Attach or replace garment photo**, or match each ZIP image to an existing garment in import review. Confirm before importing replacements. IDs, clothing type, preferences and laundry status are retained, while old outfit snapshots retain their original photo or no-photo state. Unmatched ZIP images create new garments. Only one incoming image can target each garment in a batch. Photo/hash pairs must both be present or both absent; no placeholder storage objects are created.

Migration: `20261015014559_closet_text_garments.sql`. Existing RLS and storage policies are unchanged. Run `supabase/tests/closet_text_garments.sql` to verify null-photo constraints, numbering, plan retry, immutable snapshots, laundry, photo attachment and cross-user denial in a rolled-back transaction.

Verification includes boundary/warmer-band tests, missing-weather/date matching, color selection, clean-only recommendations, preference exclusions, a browser text-item → temperature rule → plan → dirty → attach photo → laundry workflow, and the existing ZIP regression workflow. No OpenAI key or model call is added.

Security advisor after migration: no new database/storage findings. The existing Auth leaked-password-protection warning remains a Dashboard setting; see [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Current MyHub access is passwordless.

## Build your own outfit

In Closet Planner, choose **Build my own outfit**, select up to 20 clean garments, and optionally enter an outfit name. Category filtering keeps selections from other categories. The selected garments appear in the preview. Set the date, occasion and note, then choose **Save outfit & mark dirty**. The existing atomic save creates an immutable historical snapshot and marks only those garments dirty. Manual outfits do not require a weather forecast or follow automatic temperature restrictions. Dirty garments cannot be selected; run laundry to make them available again. Switch to **Get suggestions** to return to temperature-aware recommendations.

## Keep items while regenerating

Check **Keep this item** on suggested garments, then choose **Regenerate around kept items**.
Kept garments anchor the remaining color choices. Unkept slots favor alternatives to the
previous suggestion and garments shown less often during this visit, including shoes and jackets.
All choices still respect clean status, temperature bands, and the less-preferred setting.
Limited alternatives are explained. **Release kept items** clears the locks.
Changing the date, weather, wardrobe, or planning settings clears keeps.
This planner uses local rules; it is not an AI service.
