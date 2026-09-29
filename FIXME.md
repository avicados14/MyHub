# MyHub FIXME and verification ledger

This file distinguishes a confirmed correction from an unverified condition. At the September 28 handoff, no known source defect was left open after the Canvas UID fix. Do not infer a regression from the earlier README counts alone.

## Immediate verification — status: open, outcome unknown

- [ ] **Confirm cross-device propagation of the latest Canvas assignments.** The connected Calendar imported an encrypted snapshot with 3,332 events and 168 assignments, and School rendered assignment cards. The handoff did not recheck whether that newly imported state reached the Supabase encrypted `AppData` document or a fresh private-link browser. First check the existing linked browser's sync state; then check aggregate counts in a separate fresh profile. Do not print the link, key, token, passphrase, raw ICS, or decrypted assignments. If there is a mismatch, inspect revision/sync-queue metadata and reproduce the exact path before editing code. Source: `HANDOFF_CONTINUATION_GUIDE.md` §§6 and 8.

## Documentation corrections — status: confirmed

- [ ] **Update stale snapshot counts after the verification above.** `README.md` (Encrypted Supabase Sync and GitHub Backup) and `REQUIREMENTS_AUDIT.md` (dated September 23) still report 3,328 events and zero homework assignments from the prior snapshot. The later September 28 connected-browser result was 3,332 events and 168 assignments. State the date and verification scope of each count; do not claim fresh-device sync until observed.
- [ ] **Refresh release evidence when publishing a new baseline.** The September 23 audit's test totals describe its own release run; the handoff records later fixes and a successful Pages workflow. Rerun only the checks needed for the actual change, then update evidence and dates instead of carrying old totals forward as current results.
- [ ] **Clarify calendar refresh paths in user documentation.** Direct browser fetch of the private Canvas feed can fail under provider CORS. The reliable automatic route is the scheduled encrypted `MyHub-Data` snapshot, with reviewed local `.ics` import as a fallback. Describe those separately so “Refresh feed” is not mistaken for the scheduled path.

## Product limitations and design decisions — not confirmed defects

- [ ] **Concurrent cross-device edits:** Supabase rejects a stale `data_version` rather than silently overwriting newer ciphertext. Review a more helpful conflict/reconciliation flow if Phase 2 requires simultaneous editing; preserve the current safety property meanwhile.
- [ ] **Private-link access model:** the web app uses a revocable bearer capability, not individual Supabase accounts. Anyone holding a valid link can use it until replacement. Decide whether native sync needs identity-based sharing/revocation before changing the broker or schema.
- [ ] **Browser-side external imports:** public recipe URLs and Open Food Facts can be blocked or incomplete. Preserve reviewable pasted/manual paths; evaluate a secure adapter as a scoped Phase 2 feature, not a client-side CORS bypass.
- [ ] **Native platform functions:** EventKit, live camera/barcode capture, PhotosPicker, and Share Extension are intentionally absent from the web prototype. Track implementation in `TODO.md`, not as Phase 1 defects.

## Investigation rules

Before a fix, establish where the authoritative data resides (IndexedDB, encrypted Supabase document, or encrypted GitHub backup), reproduce the narrow failure, and read the exact relevant log. A browser-local record cannot be repaired by speculative Supabase migration. Preserve the deployed Canvas UID parser unless a new regression is demonstrated. See `HANDOFF_CONTINUATION_GUIDE.md` §§4, 7, and 8.
