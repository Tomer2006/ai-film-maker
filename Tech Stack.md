# Tech Stack

## Core Stack

1. **Firebase App Hosting**
   - Hosts the Next.js app (frontend + API routes, SSR, and API handlers).
2. **Firebase Firestore + Admin SDK**
   - Database and backend app state via Next.js API routes.
3. **Firebase Cloud Storage**
   - Large-file storage for long movie outputs.
4. **AI Generation API Provider(s)**
   - External APIs that generate movie assets and final videos.
5. **Firebase Secret Manager (App Hosting secrets)**
   - Secure runtime config for OpenCode/Shotstack credentials.

## App Framework

1. **Next.js (App Router)**
2. **React**
3. **Tailwind CSS**

## Why This Stack

1. Keeps everything managed in the cloud (no self-hosted hardware).
2. Matches the current UI-first development phase.
3. Supports async movie generation with external providers.
4. Handles large video files via object storage, not app server memory.

## High-Level Flow

1. User submits movie setup form in Next.js UI.
2. API route starts generation job with external AI provider.
3. Job state is stored/updated in Firebase Firestore.
4. Final video is stored in Firebase Cloud Storage.
5. App shows progress and final result URL to the user.

## Environment Variables (Example)

```bash
OPENCODE_BASE_URL=
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=
OPENCODE_MODEL=
SHOTSTACK_WEBHOOK_SECRET=
```
