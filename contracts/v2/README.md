# MyHub portable contract v2

Implementation baseline: `3472b5513012ddb0481550334d40d58e1fba1953`. The owner approved current web behavior as the native baseline on September 29, 2026. Fixtures are entirely invented; none came from the private handoff, calendar feeds, or a personal backup.

## Wire shape and versions

`app-data.schema.json` is JSON Schema 2020-12, generated from every field of `src/domain/types.ts` with the TypeScript compiler. `npm run contract:check` rejects drift in the schema, generated Swift transport structs, and copied Swift fixtures. Change the TypeScript contract deliberately, regenerate, and review all differences together. This schema validates shapes and literal values; it does not claim to validate every domain constraint (date validity, referential integrity, or serving ranges).

The plaintext backup envelope is `{format: "myhub-backup", formatVersion: 2, appVersion: string, exportedAt: ISO timestamp, data: AppData}`. AppData's `schemaVersion: 2` is independent of envelope version and application release version. Encryption is a separate transport envelope (`myhub-encrypted`, version 1); never pass ciphertext directly to the JSON backup importer.

| Collection                         | Portable facts and relationships                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| events                             | Local date/time/endDate, allDay, kind, course, feed/UID provenance, assignmentId, locked/userAdjusted/completed flags             |
| assignments                        | Stable ID, deadline, priority, estimate/progress/status, subtasks, feed/external ID and source provenance                         |
| recipes / packagedFoods            | Original/current yield, ingredients and overrides, steps, nutrition and its provenance, review flags, source metadata             |
| meals / leftovers                  | Planned, prepared and consumed amounts, source snapshot, recipe/package/leftover references, batch source and generated-day links |
| foodLog                            | Consumption date, servings, immutable nutrition/provenance/source snapshots; no automatic nutrition from planning                 |
| pantry                             | Quantity, compatible unit, canonical name, category, storage and expiration                                                       |
| activeGroceryList / groceryHistory | Item decisions, purchase state, source meal IDs and date window; completed trips are independent historical copies                |
| settings                           | Display zone, study rules, nutrition goals, planning preferences, categories/staples and calendar-feed status/provenance          |

The generated schema is the exhaustive field/type inventory. IDs are opaque **strings**, not UUID-only values: imported IDs, generated prefixes, `meal:` references and legacy identifiers must survive unchanged. Native code may generate UUID-based strings for new records but must never rewrite imported IDs. Collection relationships do not imply cascade deletion of historical snapshots.

## Dates, numbers and history

- Local dates are `YYYY-MM-DD`, wall times `HH:mm`; preserve them as calendar components, never parse a meal date as a UTC instant. `calendarTimeZone` is an IANA zone used by ICS conversion. The original ICS source wall time drives recurrence across DST. Timestamps such as createdAt, updatedAt, capturedAt, importedAt and exportedAt describe instants and remain ISO strings in transport.
- Quantities are JSON numbers. Unknown ingredient quantity is explicit `null`, not zero. Native transport uses Decimal; display rounding is separate. Missing legacy sugar/saturatedFat contributes zero to totals, without inventing provenance.
- Scaling starts from original yield; exact-yield recipe display overrides and grocery override calculations currently differ in their applicability. Preserve the implemented rules until reviewed.
- A batch's prepared amount is shared; planning a later day does not create more food or consumption. The web reconciler handles narrowly defined legacy links. Native import and School commands preserve stored meal links; native meal editing/reconciliation parity is not implemented yet.
- Recipe/package edits must not rewrite meal, food-log or completed-trip snapshots. Fixtures mutate a recipe and a copied trip to prove snapshot independence.

## Privacy boundary

All AppData fields transfer, including provenance and optional calendar feed URLs. Therefore **portable backups are private plaintext**, even though browser connection credentials are excluded. Do not describe an AppData backup as sanitized. Synthetic fixtures contain no URLs, credentials or personal records.

The IndexedDB `credentials` store, private-link ID/key, write capability, encrypted token envelope, GitHub token/passphrase, sync digests/revisions and device connection state are not portable AppData. Nested unknown fields are rejected by the backup shape validator rather than silently discarded. Neither native models nor their UI establish any cloud session. Native integration credentials must live behind a future approved Keychain adapter.

## Import and migration policy

Web: parse the supported envelope, migrate schema 1 or 2 using existing migration rules, validate the resulting complete nested shape, then allow replacement. Unknown versions fail before replacement. A reproduced malformed-recipe import is now rejected. Validation messages never interpolate user records. Existing migration still normalizes the calendar zone and removes explicitly marked legacy demo records and linked generated remnants; that exception is not a general permission to remove user history.

Native foundation: validate a v2 envelope and complete nested shape before decoding Codable structs or writing. Unknown fields/versions fail without modifying the current file. Version 1 requires the existing web migrator followed by a v2 export; a direct Swift v1 migration is deferred until a dedicated legacy golden fixture set is approved. Do not silently approximate the web's legacy repair rules. Envelope metadata must be present for native import.

Local storage uses an atomic, versioned JSON document in Application Support with iOS complete file protection. This is a small offline foundation, not SwiftData or a cloud-sync implementation. Import shows counts and asks for replacement confirmation. Failed decoding/saving preserves the prior document. Future indexed storage must first import to a temporary version, validate, atomically switch and retain a recoverable prior version.

## Golden fixtures and test scope

`fixtures/backup.json` contains opaque IDs, local dates, provenance, unknown quantity, a prepared batch shared over two days, a nutrition log, competing homework and a completed trip. `fixtures/expected.json` is hand-authored expected output for scaling/fractions, compatible grocery units, all eight nutrition totals, an 8-serving remaining batch, homework order, conflict-free study blocks and immutable history. Random generated IDs/timestamps are omitted only from calculated-output comparisons; persisted IDs are compared exactly on round trip.

`src/domain/portableContract.test.ts` executes all seven behavior fixtures with the real web domain functions. Swift contract tests decode and re-encode the same backup, compare complete JSON structures, reject invalid/unsupported inputs, preserve the previous persisted document and test local-date/snapshot semantics. Swift calculation tests now target the same scaling/fraction, nutrition, priority and study golden outputs. Grocery aggregation and legacy meal-batch reconciliation parity remain separate work; decoding fixtures alone does not complete those algorithms.
