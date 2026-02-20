# AI Film Maker

UI-first web app to collect movie inputs and later generate full AI movies with external APIs.

## Tech Stack (Cloud Only)

1. **Firebase App Hosting**
   - Hosts the Next.js app (frontend + API routes, SSR, and API handlers).
2. **Firebase Firestore + Admin SDK**
   - Database and backend app state via Next.js API routes.
3. **Firebase Cloud Storage**
   - Stores large output files (for long-form movie exports).
4. **AI Generation API Provider(s)**
   - External service(s) that generate movie assets/video.
5. **Firebase Secret Manager (via App Hosting secrets)**
   - Stores runtime secrets like OpenCode/Shotstack credentials.

## Current Status

- Next.js + Tailwind UI is set up.
- Multi-step movie setup flow is implemented:
  - Title
  - Concept
  - Plot Overview
  - Script
  - Visual Style
- Each step includes **Skip** and **Continue** actions.
- Movie jobs, creative files, and render webhook updates are persisted in Firebase Firestore.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required Environment Variables

```bash
# Opencode server
OPENCODE_BASE_URL=
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=
OPENCODE_MODEL=

# Shotstack webhook auth
SHOTSTACK_WEBHOOK_SECRET=
```

## Deploy (Firebase Only)

```bash
npm i -g firebase-tools
firebase login
firebase use --add
firebase init apphosting
firebase apphosting:secrets:set opencode-base-url
firebase apphosting:secrets:set opencode-server-username
firebase apphosting:secrets:set opencode-server-password
firebase apphosting:secrets:set opencode-model
firebase apphosting:secrets:set shotstack-webhook-secret
firebase deploy --only apphosting
```
