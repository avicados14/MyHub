# Native MyHub foundation

Open `MyHub.xcodeproj` in Xcode on a Mac. It targets iPhone and iPad, iOS 17+, with no WebView or third-party runtime dependencies. Choose a development team only for device installation; the simulator build does not need signing.

```sh
swift test --package-path native/MyHubCore
xcodebuild -project native/MyHub.xcodeproj -scheme MyHub -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Run these from the repository root. CI repeats both on macOS. This Linux continuation environment cannot itself run Swift or Xcode.

Implemented source: responsive native navigation, versioned Codable transport models, schema-checked backup decoding, explicit import confirmation, plaintext export, atomic local persistence with iOS file protection, daily dashboard, event editing, recipe viewing, scaling previews, homework editing and study previews/application. No fixture is preloaded into the app. Calendar events and study blocks can now be copied through Apple’s system event editor after explicit review. Capability enrollment, calendar reading, and synchronization are not implemented.

Generated Swift models, schema resources and synthetic fixtures come from `npm run contract:generate`; `npm run contract:check` prevents drift. Keep unknown imported IDs as strings. `Backup.decode` rejects unsupported data without overwriting the current file. Version 1 must first pass through the web migrator. Tests compare full web-export/native-reencode JSON, historical snapshot independence and local-date validity.

This is not the completed native feature set. See `../docs/NATIVE_DECISIONS.md` for the acceptance gate and remaining tests. Full editing/calculation parity, migration/reconciliation parity, accessible device acceptance, integrations and sync are still unchecked in TODO.

Validated at `ce707bf` by macOS workflow `36507350376`: 3 Swift tests passed; standalone iPhone/iPad simulator build succeeded. Device interaction and accessibility acceptance remain open.

Native calculation work in progress: scaling/fractions, consumption-only nutrition, source visibility, homework ranking and study previews now have Swift tests. Recipe serving controls remain previews. School now supports explicit confirmed application of generated study plans. Grocery/batch calculation parity and full editing remain open; consult the running work log for the exact tested commit.

September 29 increment: the owner approved web behavior as the baseline. Native School now includes homework forms/subtasks, confirmation before deletion, completed-item reopening, and confirmed study-preview application. Commands reject stale drafts and preserve provenance; saving precedes UI publication. This increment passed Mac CI; see `../docs/WORK_LOG.md`. Study-block editing is implemented in the subsequent calendar increment below. Full feature/device acceptance remains open.

Calendar/study controls at `338a02c` passed 18 Swift tests and the simulator build (run `36622161736`): event forms/deletion, overlap confirmation, protected study edits, completion/reopening/locking, and study settings with avoid ranges. Imported multi-day bounds stay intact; moving those ranges is not implemented. Full calendar layouts and on-device acceptance remain open. Dedicated legacy migration bridge fixtures now live in `../contracts/v1`; direct Swift v1 migration is still unsupported.

October 2 device increment: Calendar rows offer **Save to Apple Calendar**. A confirmation explains independent-copy and duplicate behavior, followed by Apple’s event editor and calendar chooser. Saving or cancelling does not modify the MyHub event. Only title, dates, location and description are copied; source URLs, feed identifiers, homework links and credentials are excluded. Timed events use MyHub’s calendar time zone; all-day events retain floating device-local dates and an exclusive final boundary. Missing DST times are rejected; repeated fall-back times use the first occurrence and remain reviewable in the editor. See `../docs/WORK_LOG_2026-10-02_NATIVE_CALENDAR.md` for verification and device acceptance.
