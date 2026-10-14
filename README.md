# Daywell

A mobile-friendly food, movement, journal, and daily progress tracker.

## What it does
- Record food, calories, and macronutrients.
- Log exercise and choose how much estimated activity contributes to a daily energy reference.
- Keep daily journal and wellbeing entries.
- Explore trends and export CSV/JSON records.
- Install as a website shortcut / progressive web app (PWA) with offline support.

## Deploy with Cloudflare Pages
1. In Cloudflare, create a **Pages** project connected to GitHub repository `itsachv/daywell`.
2. Use branch `main`, no build command, and output directory `.` (repository root).
3. Publish and open the provided HTTPS URL.
4. On iPhone, use Safari > Share > Add to Home Screen.

**Important:** This version stores personal data in **browser localStorage**, not in GitHub or a cloud database. The live website will not synchronize journal or meal entries between devices. Download JSON backups regularly and import them when switching URLs/devices. Do not commit private health or journal data to this public repository.

To update the live app, commit changes to the connected GitHub branch. Cloudflare Pages deploys those commits automatically. A previously drag-and-drop-uploaded Pages project may require creating a new Git-integrated project.

## v2 cloud sync setup (required before announcing online backups)

Daywell is now **cloud-ready, not cloud-enabled**. It will display *Setup required* until you configure a Firebase project.

1. Visit [Firebase Console](https://console.firebase.google.com/), create a project, and register a **Web app**.
2. Under **Build > Authentication**, enable the **Google** sign-in provider and configure a support email. Under authorized domains, add the *exact Cloudflare Pages hostname* (and any custom domain).
3. Under **Build > Firestore Database**, create the database. In **Rules**, replace the rules with the repository's `firestore.rules` and **publish** them before anyone signs in. NEVER use permissive public test rules.
4. Copy the public Web app fields `apiKey`, `authDomain`, `projectId`, `appId` into `firebase-config.js`. These client identifiers are not service-account credentials.
5. Deploy the committed updates to Cloudflare. Sign in on two devices and test meal creation, journal edits, deletion, and confirmation that each device updates. Test two separate Google accounts to verify records are private.
6. Watch the **Cloud backup** status in Goals. *Waiting to sync* does not guarantee an upload; only *Synced to cloud* reports Firestore confirmation. Keep independent JSON backups; no cloud platform guarantees zero data loss.

### Architecture
- Every signed-in account has separate Firestore paths: `users/{uid}/foods/{id}`, `users/{uid}/exercises/{id}`, `users/{uid}/journals/{date}`, `users/{uid}/profile/main`.
- The app syncs individual records and listens for account-specific live updates. It uses Firestore offline persistence where supported, with local device copies.
- Existing anonymous device data is *not* automatically uploaded to a random account. After sign-in, choose **Import guest entries** if desired.
- Do not commit exports, secrets, health notes, or private journals into GitHub.
- This is a starter integration: verify synchronization and conflict behavior before inviting public users. Simultaneous edits to the same record may use last-write-wins; keep JSON backups.
