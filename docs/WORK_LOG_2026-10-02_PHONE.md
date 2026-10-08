# Phone installation and device pairing — 2026-10-02

## Scope

Implement the selected free Home Screen web-app path, retain existing web functionality and the native calendar increment, add temporary single-use device sign-in, and verify before merging.

## Implementation

- Added installation manifest, deterministic icons, and production service-worker generation. Cache only shipped same-origin shell assets; never cache broker/API responses. Updates wait for existing windows to close.
- Added a device setup page and Settings entry. Explicit consent precedes replacement of local data.
- Pairing uses a random 80-bit code, client-encrypted access package, a server-held code hash, 10-minute expiry, and atomic single-use redemption. Existing private access is not rotated when pairing.
- Added service-only pairing table/functions with RLS and revoked direct client permissions. Cancellation/replacement authenticates the existing write capability.
- Preserved saved private access through temporary reconnect failures. Explicit unlink still clears device credentials.
- Added phone guide and regression coverage for encryption, malformed/expired codes, fresh-device connection, outages, and the built production app offline.

## Verification checkpoint

- Original 128 unit tests passed before adding new coverage.
- 131 unit tests, formatting, lint, contract checks and production build passed locally.
- Deployed additive pairing migration and broker version 5.
- Transactional synthetic database checks passed: wrong token, successful redemption, reuse, expiry, replacement, cancellation and parent revocation. Fixtures rolled back.
- Security advisor reports only informational RLS-without-policy for the new service-only table; no direct client grants exist. The absence of policies intentionally denies access.
- Live synthetic HTTP tests passed for authorization, encrypted transfer, concurrent one-winner redemption, cancellation, existing resolve/push, and stale-write rejection. Fixture cleanup and direct-client privilege denial verified.
- Native CI passed all 35 Swift tests and the iPhone/iPad simulator build.
- Found that `tsc --noEmit` on the root references-only config skipped actual project checking. Changed it to `tsc -b`, added existing ES2023/Vite typings, corrected narrow types and guarded an optional calendar URL. Actual project type checking now passes.
- Added five malformed broker request tests: 136 unit tests now pass locally.
- Browser and production PWA tests, final regression CI, and merge remain pending at this checkpoint.

## Avoid repeating mistakes

Do not clear credentials on a network error. Do not rotate private links to pair each new device. Do not use a guessable numeric PIN without a separate approval/rate-limit design. Do not deploy a merge before browser checks pass. Never log private credentials, pairing codes, decrypted records, or private access URLs.

## Browser verification follow-up

- All 135 browser tests passed, including device-code login and outage recovery; all 9 focused meal/Canvas regressions passed.
- The separate installed-app test found an offline startup failure after successful online startup. The static asset cache now ignores Origin-based Vary headers for its exact public build-file allowlist; broker and other API requests remain outside the cache. Production smoke testing runs before the longer browser suite to catch installation failures earlier.
- Production Chromium offline verification now passes after the cache fix. Added Safari-engine coverage for the iPhone installation/offline and device-code flows. Final cross-browser verification and release remain gated on CI.

## October 8 integration and offline test correction

- Integrated main through PR #26, retaining Closet Planner and immutable session authorization. Local full check passes 143 unit tests plus contracts, formatting, lint, types and production build.
- Live pairing authorization, single-use, expiry, cancellation and revocation assertions passed with rollback. Closet ownership, planning, storage and revoked-session refresh assertions passed with rollback.
- Native CI 37807602599 passed. Web CI 37807602636 passed static/unit/build gates and Chromium offline startup, then exposed Playwright WebKit offline emulation issue [#42775](https://github.com/microsoft/playwright/issues/42775).
- The PWA test now shuts down its real origin and verifies an uncached HTTP request fails before testing offline navigation in both engines. Chromium additionally retains offline emulation. No assertions were removed. Physical iPhone acceptance remains unverified.
