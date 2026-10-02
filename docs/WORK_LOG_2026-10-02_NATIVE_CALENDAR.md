# Native device increment: Apple Calendar export

## Scope and decisions

The owner requested starting native device features after the web release. This increment implements an explicit, reviewed one-event copy using EventKitUI on iPhone/iPad (iOS 17+). Calendar database import, two-way synchronization, camera/OCR and share-extension intake remain future increments.

- Calendar and study-block rows offer Save to Apple Calendar.
- Confirmation explains exactly which fields are copied and that future edits are independent. Repeating the action can create duplicates, especially for events already imported from another calendar.
- Apple’s editor owns calendar selection and the final save. The app does not request calendar database access, enumerate calendars/events, or directly call save.
- Cancelling, exporting, or changing the system draft leaves the original MyHub record intact.
- The export excludes source URLs, feed IDs, homework IDs, credentials and unrelated records. Title, time range, location and description are reviewable in the system editor.
- Existing offline manual calendar workflows remain available.

## Date behavior

Timed values use MyHub’s configured calendar time zone. Explicit overnight/multi-day bounds are preserved. All-day dates float in the device zone, and MyHub’s inclusive final day becomes the exclusive EventKit boundary by adding a calendar day, not 86,400 seconds. Invalid dates/ranges/zones and nonexistent spring-forward times fail before opening the editor. Ambiguous fall-back wall times choose the first occurrence; the system editor provides final review.

## Verification checkpoint

Seven core regression cases cover configured zones, overnight bounds, inclusive all-day ranges, floating device dates, 23-hour DST days, missing/repeated DST times, invalid input and preservation of the source event. Swift/Xcode are not installed in the Linux workspace. macOS CI must compile the adapter, run the full Swift suite and build the iPhone/iPad simulator target before acceptance. Initial source review and git whitespace checks passed; CI evidence will be recorded in the pull request.

## Device acceptance still required

- On iPhone and iPad, open an event, review the copy notice, choose a destination calendar and save.
- Cancel both the confirmation and the system editor; verify MyHub is unchanged.
- Check all-day, overnight and DST boundary dates in Apple Calendar.
- Test with no configured writable calendar, restricted device calendar settings, and after reopening the app.
- Verify VoiceOver, large Dynamic Type and iPad sheet presentation.
- Confirm duplicate-copy wording is understandable. This version cannot detect existing Apple Calendar copies without calendar read access.

## Next native work

- Photo/label intake with local OCR and a review draft.
- Explicit calendar import with source identity and deduplication.
- Share-extension queue and review workflow.
- Keychain enrollment and encrypted sync conflict recovery after architecture selection.

## Apple documentation checked

- [Accessing the event store](https://developer.apple.com/documentation/eventkit/accessing-the-event-store)
- [Accessing Calendar using EventKit and EventKitUI](https://developer.apple.com/documentation/eventkit/accessing-calendar-using-eventkit-and-eventkitui)
- [TN3152: Calendar access levels](https://developer.apple.com/documentation/technotes/tn3152-migrating-to-the-latest-calendar-access-levels)

Apple documents the iOS 17+ EventKitUI editor flow without requesting event-store access. No usage-description permission key is added because this increment makes no calendar authorization request.
