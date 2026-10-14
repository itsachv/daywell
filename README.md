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
