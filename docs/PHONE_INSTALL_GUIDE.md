# MyHub on your phone — free Home Screen app

This uses the same web app and data model as desktop. No Apple hosting, Apple Developer membership, App Store, or TestFlight payment is required. Existing GitHub and Supabase service quotas still apply.

## iPhone / iPad

1. Open [MyHub](https://avicados14.github.io/MyHub/) in **Safari**.
2. Tap **Share → Add to Home Screen**. You may need to scroll the share menu. Leave **Open as Web App** enabled when shown, then tap **Add**.
3. Open **MyHub from its new Home Screen icon**. Install first: Safari and the installed app may keep separate device storage.
4. Open **Settings → Install MyHub / connect a device**.
5. On an already-connected computer or phone, open the same page. Wait until sync is current, then select **Generate sign-in code**.
6. Type that code on your new phone. Confirm that you want to load the synced copy, then select **Connect this device**.
7. Check your calendar, school, food, groceries, and pantry. Make a small change and check that it appears on your other connected device after syncing.

The code expires after 10 minutes and works once. Generating a new code invalidates the previous pending code. Cancel code invalidates it immediately. If a connection fails after consuming the code, generate another. Never send a code to another person: it grants access to your MyHub data.

If the existing device does not have private access active, open it using your existing private access link. For a manually configured GitHub connection, Settings can create a private access link first. **Creating a replacement private access link revokes previous links**, so do not do this routinely to add devices: use the sign-in code instead.

## Android / another computer

Open MyHub in Chrome, choose **Install app** or **Add to Home screen**, then open the installed app and follow the same code steps. Other computers can use the web app directly and enter a code on the device setup page.

## Data, offline use, and updates

- Connecting replaces that browser's local data with the synced copy. Export a backup in Settings before connecting if you have unsynced local work to keep.
- Your connection stays on the device. Do not clear browser/site data if you want to keep it. A temporary network outage no longer deletes the saved connection.
- After a successful online load, the installed app shell and existing local records can open offline. Sync, external recipe images, OCR downloads, calendar fetching, and other network services still need a connection. This is not a guarantee of offline availability for every external feature.
- When an update is available, close all MyHub windows and reopen online. Existing open windows finish using their current version.
- Devices share the existing private-access capability. Unlink in Settings removes the local connection; it does not revoke other devices. Replacing the private access link revokes the shared access for all devices using it. Separate per-device revocation is not implemented.
- This is a Home Screen web app, not the separately maintained native Swift application. It preserves the web features; native-only Apple Calendar export remains in the native app.

Apple's installation instructions: [Open a website as an app on iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
