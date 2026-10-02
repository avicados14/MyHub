# Legacy migration compatibility fixtures

These fixtures are invented from the synthetic v2 contract; they contain no archive or personal records. `legacy-backup.json` exercises schema/envelope v1, missing nutrition provenance/sugar/saturated fat, recipe-derived meal snapshots, food-log snapshot migration, legacy staple strings, settings defaults, and explicitly marked demo records with generated dependents.

`migrated-backup.json` records the current web migrator's full v2 result. Tests separately assert the intended behavior: normal IDs/dates/prepared/consumed quantities and completed-trip history survive; only marked demo records/dependents are removed; missing provenance is unknown. The expected file is reviewed source, not regenerated during tests. Change it deliberately with migration changes.

Web tests compare the real parser's complete result with this golden. Native tests decode and re-encode that same migrated backup without field loss. This verifies the supported web-v1-migration → v2-export → native-import bridge. It does not implement direct Swift v1 migration, nor cover every legacy repair combination. Future direct migration must expand coverage for calendar feeds, existing snapshots, grocery cleanup and malformed legacy input before replacing the bridge.
