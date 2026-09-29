# Native MyHub foundation

Open `MyHub.xcodeproj` in Xcode on a Mac. It targets iPhone and iPad, iOS 17+, with no WebView or third-party runtime dependencies. Choose a development team only for device installation; the simulator build does not need signing.

```sh
swift test --package-path native/MyHubCore
xcodebuild -project native/MyHub.xcodeproj -scheme MyHub -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Run these from the repository root. CI repeats both on macOS. This Linux continuation environment cannot itself run Swift or Xcode.

Implemented source: responsive native navigation, versioned Codable transport models, schema-checked backup decoding, explicit import confirmation, plaintext export, atomic local persistence with iOS file protection, and read-only event/homework/recipe screens. No fixture is preloaded into the app. No network, capability enrollment, integration permissions or synchronization are implemented.

Generated Swift models, schema resources and synthetic fixtures come from `npm run contract:generate`; `npm run contract:check` prevents drift. Keep unknown imported IDs as strings. `Backup.decode` rejects unsupported data without overwriting the current file. Version 1 must first pass through the web migrator. Tests compare full web-export/native-reencode JSON, historical snapshot independence and local-date validity.

This is not the completed native feature set. See `../docs/NATIVE_DECISIONS.md` for the acceptance gate and remaining tests. Editing, deterministic Swift calculations, migration/reconciliation parity, accessible device acceptance, integrations and sync are still unchecked in TODO.

Validated at `ce707bf` by macOS workflow `36507350376`: 3 Swift tests passed; standalone iPhone/iPad simulator build succeeded. Device interaction and accessibility acceptance remain open.
