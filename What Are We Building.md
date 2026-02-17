# What Are We Building?

We are building **AI Film Maker**: a web app that lets users create complete AI-generated films (video + audio) from a guided setup flow, with consistent characters across scenes and shots.

## Product Goal

Turn movie ideas into complete films with synchronized audio and consistent characters, using a simple, cloud-based workflow.

## Core User Journey

1. User signs in.
2. User enters movie setup details (story, style, length, etc.).
3. System starts an AI generation job.
4. User sees live status/progress updates.
5. User receives a final movie URL and can watch/download/share.

## Core Capabilities

1. Authenticated user accounts.
2. Movie setup form and job submission.
3. Async AI generation orchestration.
4. Realtime job status tracking.
5. Final asset storage for large video files.
6. Subscription and billing support.
7. Character consistency controls across scenes/shots.
8. End-to-end audio generation and final audio-video output.

## Initial Scope (MVP)

1. One clear movie creation flow.
2. One AI provider integration.
3. Job history per user.
4. Basic failure handling + retry path.
5. Hosted deployment with managed services.

## What We Are Doing Later

1. Edit the film remake section.
2. Change a section of the movie.

## Out of Scope (for now)

1. Advanced video editing timeline.
2. Team collaboration features.
3. Multi-provider smart routing.
4. Marketplace/community features.

## Success Criteria

1. A user can go from prompt to playable movie end-to-end.
2. The final output includes both video and audio.
3. Main characters stay visually consistent across scenes.
4. Job states are reliable and visible in the UI.
5. Final videos are stored safely and load consistently.
6. Billing/auth flows work in production.
