# Naija Homemade video application

Naija Homemade is a React single-page video application backed by an Express API. It ingests allowed Telegram uploads, stores metadata in PostgreSQL, serves media from Telegram, Cloudflare R2, or Cloudflare Stream, and supports accounts, social interactions, premium access, payments, and SEO share pages.

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React 19/Vite client application. |
| `backend/` | Node 22/Express API, PostgreSQL schema initialization, Telegram webhook, uploads, payments, and SEO. |
| `backend/worker.js` | Cloudflare Worker for signed Telegram-video delivery and edge caching. |
| `../engines/twitter_engine/` | FastAPI automation/AI service used for SEO caption expansion and bank-transfer verification. |
| `../services/prerender-server/` | Self-hosted Prerender/Chromium service for crawler snapshots. |
| `naijahomemade.conf` | Production Nginx virtual-host configuration. |

## Quick start (local development)

Prerequisites: Node.js 22, npm, a reachable PostgreSQL database, and the required credentials/configuration. The Node API also needs FFmpeg when using premium uploads.

1. Configure the environment files as described in [the operations guide](docs/operations.md#configuration). Never commit secret values.
2. Install dependencies:

   ```bash
   cd frontend && npm ci
   cd ../backend && npm ci
   ```

3. Build or run the frontend development server:

   ```bash
   cd frontend
   npm run dev
   ```

4. In another terminal, run the API:

   ```bash
   cd backend
   npm start
   ```

   The API listens on `PORT`, defaulting to `3000`; Vite defaults to `5173`.

For the complete production deployment, service configuration, webhook setup, backup behavior, and troubleshooting, use [docs/operations.md](docs/operations.md).

## Important implementation detail

The API initializes most database tables when it starts. Its video queries also require `videos.media_group_id`, but the current initializer does not create that column. Provision it before the first production run:

```sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS media_group_id TEXT;
```

No application behavior is changed by this documentation.
