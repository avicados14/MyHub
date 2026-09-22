# MyHub Native iPhone and iPad Plan

## Status

Native implementation is intentionally paused until the web application’s design and workflows are tested and approved. This document records the handoff strategy; it is not an Xcode project.

## Product Objective

The Apple version will be a true Swift and SwiftUI application for iPhone and iPad. It will not wrap the web application in a WebView. The approved web behavior will define the product contract, while every screen and interaction will be rebuilt with native controls and platform conventions.

## Interface Strategy

The iPhone app should use `TabView`, `NavigationStack`, sheets, and confirmation dialogs. It must not reproduce the desktop sidebar. The iPad app should use `NavigationSplitView`, multi-column layouts, a larger week calendar, and platform-native drag and drop where it improves the workflow.

The content priorities proven on mobile web should determine compact iPhone layouts. The desktop and tablet web hierarchy should inform, but not mechanically dictate, the iPad arrangement.

## Shared Domain Contract

Before native work begins, freeze representative JSON backups and golden test fixtures for:

- Recipe scaling and cooking-friendly fractions
- Unit compatibility and grocery aggregation
- Nutrition summation and immutable logs
- Prepared, consumed, and leftover servings
- Homework priority and remaining work
- Conflict-free study block generation
- Completed grocery-trip snapshots

Swift should use `UUID`, `Decimal`, explicit local dates, and versioned `Codable` payloads. SwiftData should not depend on browser-specific field names beyond the documented transfer schema.

## Native Adapters

| Capability | Native direction |
|---|---|
| Calendars | EventKit or Apple’s current recommended calendar framework |
| Local persistence | SwiftData or another native persistence layer after schema review |
| Camera and labels | AVFoundation, Vision, and VisionKit |
| Photo intake | PhotosPicker |
| Sharing into MyHub | Share Extension with an App Group handoff queue |
| Private sync | Evaluate CloudKit against a private shared backend |
| Credentials | Keychain where secrets are genuinely required |

The Share Extension should capture only data legitimately supplied by the source application. It should create a reviewable draft rather than fabricate missing recipe fields.

## Distribution Research Required Before Deployment

The private deployment decision must be refreshed against current Apple documentation immediately before native testing. Compare Xcode Personal Team provisioning, paid Apple Developer Program development installation, Ad Hoc distribution, Apple Configurator, AltStore, SideStore, and any current legitimate personal-use method.

The comparison must include cost, re-sign frequency, iPhone and iPad support, Share Extensions, App Groups, CloudKit, EventKit, camera, Vision, barcode scanning, SwiftData, background work, Keychain, networking, and maintenance. Older community answers are background only and cannot establish current signing rules.

## Sync Decision

The first native prototype can import a MyHub JSON backup. Cross-device synchronization should be added only after the web data model is approved.

CloudKit is attractive for private Apple-device use, but it constrains schemas and ties synchronization to Apple platforms. A self-hosted API can serve both web and native clients and can securely proxy recipe or nutrition services. The final decision should compare privacy, maintenance, conflict handling, backups, offline behavior, and whether the web application also needs synchronization.

## Native Acceptance Gate

Native work should begin only after the user approves:

1. Dashboard content priority and visual density.
2. Calendar and homework workflows.
3. Deterministic study-planner behavior.
4. Recipe and meal-planning workflows.
5. Nutrition, pantry, and grocery flows.
6. The portable backup and historical snapshot rules.

## References

[1]: https://developer.apple.com/documentation/swiftui "Apple Developer Documentation — SwiftUI"
[2]: https://developer.apple.com/documentation/eventkit "Apple Developer Documentation — EventKit"
[3]: https://developer.apple.com/documentation/swiftdata "Apple Developer Documentation — SwiftData"
