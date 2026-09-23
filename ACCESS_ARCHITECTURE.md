# MyHub Cross-Device Access Architecture

## Decision

MyHub uses **Supabase as the end-to-end encrypted cross-device AppData store**, **GitHub as the encrypted backup and calendar-ingestion source**, and local IndexedDB as the immediate offline cache. A private access link contains only a random Supabase record identifier and a separate high-entropy decryption/write capability in the URL fragment. Opening that link on a new device loads the encrypted Supabase document, decrypts it only in the browser, remembers the capability in that browser, and opens Home without a form, QR code, or pairing step. Later visits from that linked browser may use the ordinary MyHub URL and reconnect automatically.

## Why the Original GitHub Pages Build Needed Setup Per Device

GitHub Pages is a static hosting service that publishes HTML, CSS, and JavaScript. It does not run a private server process capable of holding a user credential on behalf of an unknown browser.[1] Local IndexedDB and browser credentials do not transfer to a new phone, so a fresh device could not read the private GitHub repository until it received authorization.

GitHub’s browser OAuth flow still requires user authorization and a server-side client-secret exchange; the implicit flow is not supported.[2] That is a valid future account-backed design, but it does not meet the current requirement of opening one private link without a first-device sign-in.

## Private-Link Security Model

The private URL’s fragment is processed by the browser and is not sent in the HTTP request for the GitHub Pages document.[3] The fragment carries a random row ID and a high-entropy client key—not the GitHub token, calendar URLs, passphrase, recipe data, or academic data. Supabase stores two AES-GCM/PBKDF2 ciphertexts: a small repository-access package and the current AppData document. Row Level Security blocks direct anonymous table access; a narrow Edge Function resolves the unguessable active ID and enforces a hashed write capability and monotonic revision number.

The link is intentionally a **bearer capability**. Anyone who obtains it can use MyHub until that link is revoked. Creating a replacement link revokes previous broker records. A leaked GitHub fine-grained token should still be revoked or rotated because GitHub instructs users to treat access tokens like passwords; fine-grained tokens should be limited to the minimum repository and permissions.[4]

## Synchronization Responsibilities

| Layer               | Responsibility                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| IndexedDB           | Immediate offline-first reads and writes on the current browser.                                                        |
| Supabase            | Primary encrypted AppData document for low-friction cross-device use, with optimistic revisions and focus-time refresh. |
| GitHub              | Encrypted snapshot backup, auditable history, and scheduled encrypted Google/Canvas calendar ingestion.                 |
| Private access link | Revocable pointer plus browser-only decrypt/write capability; contains no readable user records or GitHub credential.   |

## Future Account-Backed Upgrade

The future option is a hosted application with Google or GitHub sign-in and server-managed short-lived credentials. That would provide identity-based revocation without relying on a bearer link, at the cost of a first-device authorization step and a permanently hosted authentication backend. The current Supabase document schema can remain the encrypted data layer during that upgrade.

## Sources

[1]: [GitHub Docs — What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
[2]: [GitHub Docs — Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
[3]: [MDN — URI fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)
[4]: [GitHub Docs — Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
