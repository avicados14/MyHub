# Native acceptance and synchronization decisions

## Ready for review

The versioned schema, synthetic backup and golden web behavior tests are in `contracts/v2`. The standalone Xcode project is `native/MyHub.xcodeproj`; `MyHubCore` implements Codable transport, shape validation, atomic offline storage and contract tests. SwiftUI uses phone tabs/navigation stacks and an iPad split view. Current feature screens are **read-only backup viewers**, not completed workflow ports. A macOS CI job tests the core and builds the simulator target without signing. Device accessibility and distribution remain unverified.

## Decision 1 — behavioral acceptance gate

| Option                                                                 | Concrete scope                                                                                                                                                                                                          | Consequence                                                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — approve current web semantics as the native baseline (recommended) | Keep compact dashboard priorities; source-aware calendar/homework; due/priority/ID study ordering; explicit planning/preparation/consumption; reviewed pantry handoff; immutable logs/trips; opaque IDs and local dates | Allows native editing and golden algorithm parity to proceed in dependency order. Does not approve a sync backend or claim fresh-device verification. |
| B — request workflow changes before native editing                     | Identify changes to the six acceptance areas in MYHUB_IOS_PLAN; update web behavior/fixtures first                                                                                                                      | Avoids implementing native workflows that need redesign. Read-only import foundation remains useful.                                                  |

**Decision recorded September 29, 2026:** the owner selected “Keep web behavior.” Current web semantics and the synthetic fixtures are the native compatibility baseline. This authorizes native feature implementation; it does not select a sync backend or mark implementation/device acceptance complete.

## Decision 2 — native synchronization direction

This is an architectural comparison, not a verified current pricing/provisioning quote. Refresh provider documentation and costs at implementation/distribution time.

| Area                 | Existing encrypted Supabase broker                                     | CloudKit private database                                                                           | Identity-backed encrypted shared API                               |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Web interoperability | Reuses current encrypted document and revision                         | CloudKit JS can share its containers with web; current Supabase data/access still require migration | Supports web/native, requires backend upgrade                      |
| Device setup         | Existing bearer capability imported explicitly; not an Apple session   | Apple account/container setup                                                                       | Explicit account enrollment and device authorization               |
| Privacy              | Client encryption; bearer grants all document access                   | Must specify CloudKit encryption/key/recovery assumptions before implementation                     | Client encryption plus per-device authorization/key design         |
| Offline/conflicts    | Atomic local document; stale writes rejected; recovery UX still needed | Native record synchronization; conflicts and history need explicit model                            | Revision/merge policy must be designed                             |
| Revocation/recovery  | Current whole-link revocation; no individual device identity           | Account/container recovery dependencies                                                             | Can support device revocation; additional key recovery work        |
| Maintenance/cost     | Retains two existing services and current backup; verify quotas        | Apple platform/container/distribution constraints; verify quotas                                    | Highest implementation and operations burden; verify hosting costs |

Recommendation for evaluation: retain Supabase interoperability if continued web access is required, but first approve a capability-to-Keychain enrollment design and non-destructive conflict recovery. Do not auto-merge an entire stale document, silently reopen a link over unsynced changes, or treat a bearer link as authenticated identity. If individual device revocation is required, choose the identity-backed upgrade before implementing native sync. No production broker changes are included.

## Adapter contracts required next

- EventKit: permission denial must leave manual workflows usable; define whether imports are copies or linked records; persist external source identity; avoid duplicate MyHub/Canvas events; never request access just to view a JSON backup.
- Camera/OCR/photos: explicit capture/selection, local processing where possible, retained provenance and a review draft before saving; no automatic guessed nutrition.
- Share extension: explicit shared payload only, bounded App Group queue, consumed-item deduplication and review; never scrape accounts or fill missing recipe fields.
- Hosted recipe/nutrition adapters: define allowed sources, outbound-data scope, credential storage, retention, safe failures and manual fallback before implementing endpoints.
- Sync: Keychain storage/accessibility, encryption compatibility fixtures, revision compare-and-swap, recovery export before conflict choice, revocation behavior, fresh-device/offline/simultaneous-edit tests. Never ship real capabilities as fixtures.

## Remaining validation/access

The Mac/Xcode simulator build and 3 Swift tests passed at `ce707bf`; real iPhone/iPad accessibility review is still required. A successful simulator build alone does not prove usable Dynamic Type, VoiceOver, import dialogs or provisioning. Native v1 backups currently require web migration then v2 export. Local atomic JSON is the implemented foundation; adopting SwiftData is a later indexed-storage decision, not a claim made by this branch.

## Primary references checked for the decision

- [Apple CloudKit JS](https://developer.apple.com/documentation/cloudkitjs): web clients can access the same public/private databases as native CloudKit apps. CloudKit is not inherently native-only; adapting this existing Supabase web application would still be additional work.
- [Apple Keychain services](https://developer.apple.com/documentation/security/keychain-services): encrypted storage for small secrets; native enrollment/accessibility/recovery policy remains to be designed.
- [Swift PackageDescription](https://docs.swift.org/package-manager/PackageDescription/PackageDescription.html): package and test-target structure used by the foundation.

The existing Supabase comparison is based on this repository's broker implementation and read-only checks of the connected deployment. No new Supabase API behavior or cost claim is assumed.
