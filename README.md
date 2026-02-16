# AI Film Maker

UI-first web app to collect movie inputs and later generate full AI movies with external APIs.

## Tech Stack (Cloud Only)

1. **Vercel**
   - Hosts the Next.js app (frontend + API routes).
2. **Convex Cloud**
   - Database, backend functions, realtime updates, and app state.
3. **Auth0**
   - User authentication and account management.
4. **Stripe**
   - Billing, subscriptions, and payments.
5. **AI Generation API Provider(s)**
   - External service(s) that generate movie assets/video.
6. **Vercel Blob** (or compatible object storage)
   - Stores large output files (for long-form movie exports).

## Current Status

- Next.js + Tailwind UI is set up.
- Multi-step movie setup flow is implemented:
  - Title
  - Concept
  - Plot Overview
  - Script
  - Storyboard
- Each step includes **Skip** and **Continue** actions.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
