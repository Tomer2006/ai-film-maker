# Tech Stack

## Core Stack

1. **Vercel**
   - Hosts the Next.js app (frontend + API routes).
2. **Convex Cloud**
   - Database, backend functions, and realtime app state.
3. **Auth0**
   - Authentication, sessions, and user identity.
4. **Stripe**
   - Subscriptions, billing, and payments.
5. **AI Generation API Provider(s)**
   - External APIs that generate movie assets and final videos.
6. **Vercel Blob** (or S3/R2)
   - Large-file storage for long movie outputs.

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
3. Job state is stored/updated in Convex.
4. Final video is stored in Blob storage.
5. App shows progress and final result URL to the user.

## Environment Variables (Example)

```bash
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=
AUTH0_SECRET=
AUTH0_BASE_URL=
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
AI_PROVIDER_API_KEY=
BLOB_READ_WRITE_TOKEN=
```
