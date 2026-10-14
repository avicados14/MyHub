# Private clothing profile

Settings → Clothing profile stores editable inventory/color notes and temperature/layering rules. The same editor is available in Closet Planner's expandable profile section.

Both optional text fields belong to UserSettings and use existing IndexedDB persistence and encrypted Supabase/GitHub sync. Public application code has empty fields; personal wardrobes and preferences are never embedded in the bundle. The portable JSON contract and generated Swift models preserve these fields. Older backups without them remain valid. JSON exports include the notes as plaintext, like other settings.

This is a reference profile, not automatic garment creation: photo garments and clean/dirty status remain in the existing private closet tables. Profile notes do not alter the current outfit recommendation algorithm or its weather input. No database migration, new login, or storage policy is required.

Validation: backup import/export round trip and legacy-empty-profile compatibility; browser editing, reload persistence, and shared Settings/Closet visibility across desktop, tablet, and mobile.
