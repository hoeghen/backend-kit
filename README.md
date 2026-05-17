# @hoeghen/backend-kit

A TypeScript client SDK for Firebase, Google Drive, transactional email, and Cloud Task scheduling.

## Security model

| Concern | Approach |
|---|---|
| Firebase config (`apiKey`, etc.) | **Public by design.** Security is enforced by Firestore/Storage Rules and IAM, not by hiding the config. |
| SendGrid API key | Lives **only** in Firebase Functions runtime env (`SENDGRID_API_KEY` secret). Never touches the client bundle. |
| Google Drive access | **OAuth 2.0** — the user's own token, scoped to `drive.readonly`. No server credential needed. |
| Cloud Tasks credential | **Application Default Credentials** on the Firebase runtime. No manual secret. |
| Caller identity | Every Cloud Function requires Firebase Auth. Rate-limit and abuse controls belong in the function. |

## Installation

```bash
# Authenticate with GitHub Packages first
npm login --registry=https://npm.pkg.github.com --scope=@hoeghen

npm install @hoeghen/backend-kit firebase
```

## Quick start

### 1 — Initialise Firebase

```ts
import { getFirebaseApp } from "@hoeghen/backend-kit";

// Call once at app startup with values from your .env
getFirebaseApp({
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
});
```

### 2 — Google Drive

```ts
import { initGoogleDrive, signInToGoogle, listDriveFiles } from "@hoeghen/backend-kit";

// Load the gapi script in index.html, then:
await initGoogleDrive(import.meta.env.VITE_GOOGLE_CLIENT_ID);
await signInToGoogle();

const { files } = await listDriveFiles({ mimeType: "application/vnd.google-apps.spreadsheet" });
console.log(files);
```

### 3 — Send email

```ts
import { sendEmail } from "@hoeghen/backend-kit";

// User must be signed in to Firebase Auth
await sendEmail({
  to: "recipient@example.com",
  subject: "Hello from backend-kit",
  text: "Plain-text body",
  html: "<p>HTML body</p>",
});
```

### 4 — Schedule a task

```ts
import { scheduleTask, cancelTask } from "@hoeghen/backend-kit";

const { taskId } = await scheduleTask({
  taskName: "weekly-digest-user-42",
  scheduleTime: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
  targetFunction: "sendReminderEmail",   // must be in the server allowlist
  data: { userId: "42" },
});

// Cancel later
await cancelTask({ taskId });
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in your values. See the inline comments for what is safe to embed and what must stay server-side.

## Firebase Functions

The `functions/` directory contains the backend Cloud Functions.  Deploy them with:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

Set the SendGrid secret before deploying:

```bash
firebase functions:secrets:set SENDGRID_API_KEY
# paste your key when prompted
```

## Development

```bash
npm install
npm test            # run tests
npm run test:coverage
npm run build       # compile to dist/
```

## Publishing

Push a tag to trigger the GitHub Actions publish workflow:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The `GITHUB_TOKEN` provided by Actions has `packages: write` permission — no manual token setup needed.
