# Operations and deployment guide

This guide describes the deployed system represented by this repository. It is intended for operators of the video application, not as a security review.

## Service map

```text
Browser
  -> Nginx (videos domain, TLS)
     -> Express API on 127.0.0.1:3000
        -> PostgreSQL
        -> Telegram Bot API
        -> Cloudflare R2 / Cloudflare Stream
        -> Cloudflare Worker for signed Telegram playback
        -> FastAPI engine on engine domain / 127.0.0.1:8000
  -> Prerender service (separate process, normally port 3001)
```

The Express process serves `frontend/dist` as an SPA fallback, builds dynamic SEO pages at `/v/:message_id`, receives the Telegram webhook at `/webhook`, and exposes `/api/*`.

## Prerequisites

- Ubuntu/Debian-like host with Nginx and TLS certificates.
- Node.js **22.x** and npm for the frontend and Express API.
- PostgreSQL accessible through a TLS-capable `DATABASE_URL`.
- FFmpeg available on `PATH` for premium-upload thumbnail extraction.
- A Cloudflare R2 bucket and a Cloudflare Worker/R2 binding for Telegram media caching.
- A Cloudflare Stream account only when premium uploads use the Stream destination.
- Python 3.10+ for the FastAPI engine. Its Python dependencies are not currently captured in a requirements file; build its environment from the imports in `../engines/twitter_engine/api.py` before operating it.
- Chromium at `/usr/bin/chromium-browser` only when running the self-hosted prerender service.

## Configuration

Environment files currently exist for the backend and frontend. Keep production values outside source control and grant them restrictive file permissions.

### Express backend (`backend/.env`)

| Variable | Required for | Notes |
| --- | --- | --- |
| `BOT_TOKEN` | API startup and Telegram ingestion/playback | The server refuses to start without it. |
| `DATABASE_URL` | PostgreSQL | Used by API, auth, and admin pools. |
| `PORT` | HTTP listener | Defaults to `3000`. |
| `JWT_SECRET` | Website sessions | Set a strong, stable secret; changing it invalidates sessions. |
| `SIGNING_SECRET` | Signed Worker/video URLs | Must exactly match the Cloudflare Worker secret. |
| `ADMIN_PASSWORD` | `/status` dashboard | Used by Express basic auth. |
| `ALLOWED_ORIGINS` | Browser CORS | Comma-separated origins; local default is Vite at port 5173. |
| `API_BASE_URL` | Thumbnail/share URLs | Public API origin. |
| `FRONTEND_URL` | Canonical SEO/sitemap URLs | Public frontend origin. |
| `WORKER_BASE_URL` | Telegram playback | Base URL of the deployed Worker. |
| `PYTHON_SERVICE_URL` | AI caption and bank verification | Public/reachable FastAPI engine base URL. |
| `APP_NAME` | Status and SEO | Optional display name. |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | R2 uploads, thumbnails, backups | Required for R2 use. |
| `R2_PUBLIC_DOMAIN` | R2 video playback | Public bucket/custom-domain base URL. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_TOKEN` | Stream premium uploads | Required only for the Stream destination. |
| `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | Crypto payments | Callback URL is currently hard-coded to the public videos domain. |
| `PRERENDER_TOKEN` | Legacy/config compatibility | Present in the environment; current Express code uses a fixed prerender service URL. |

### Frontend (`frontend/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Public Express API origin. |
| `VITE_GOOGLE_CLIENT_ID` | Google identity client ID. |
| `VITE_EXOCLICK_ZONE_ID` | Advertising zone ID. |
| `VITE_PYTHON_ENGINE_URL` | Public FastAPI engine origin. |

`VITE_*` values are embedded in the static build. Do not put backend secrets in them.

### Cloudflare Worker secrets/bindings

The Worker requires these bindings/secrets, configured in the Cloudflare dashboard or Wrangler deployment configuration:

- `SIGNING_SECRET` — same value as Express.
- `BOT_TOKEN` — used to retrieve Telegram files on cache miss.
- `VIDEOS_BUCKET` — R2 bucket binding used as the edge cache.

## First-time database setup

Start the backend once with a valid PostgreSQL URL. `initDatabase()` creates the `users`, `app_users`, `videos`, `transactions`, `likes`, `saves`, and `comments` tables, plus video counter/SEO columns.

Before using Telegram albums or premium uploads, apply the currently missing schema addition manually:

```sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS media_group_id TEXT;
```

The application does not use a versioned migration framework. Record every manual schema change in the deployment runbook until migrations are introduced.

## Local startup

From `video-app`:

```bash
cd frontend
npm ci
npm run dev
```

In a second terminal:

```bash
cd backend
npm ci
npm start
```

The frontend runs at `http://localhost:5173`. Set `VITE_API_URL` to the backend URL appropriate for the browser; setting it to `http://localhost:3000` is typical for a local-only setup.

To test the production frontend locally:

```bash
cd frontend
npm run build
npm run preview
```

## Production deployment

Run the following from a release checkout. Stop/restart mechanisms below use `systemctl` as an example; substitute your existing process manager if different.

1. Install locked Node dependencies and build the static client:

   ```bash
   cd /var/www/video-app/frontend
   npm ci
   npm run build
   cd ../backend
   npm ci
   ```

2. Put the resulting `frontend/dist` where the API can see it as `../frontend/dist`. The Express server serves this directory itself. If Nginx serves assets directly, point its `root` at the same build output and retain the Node fallback for dynamic/API routes.
3. Install/update protected backend environment values and confirm PostgreSQL, R2, Telegram, Worker, and FastAPI connectivity.
4. Apply the database prerequisite above before starting a fresh environment.
5. Start or restart the Express service, then verify it locally:

   ```bash
   sudo systemctl restart naijahomemade-api
   curl -I http://127.0.0.1:3000/
   ```

6. Install [`naijahomemade.conf`](../naijahomemade.conf) as the Nginx site configuration, validate it, then reload Nginx:

   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

7. Deploy the Cloudflare Worker with its bindings/secrets, and set `WORKER_BASE_URL` to its URL. Validate a generated `/api/video` URL from a known video record.
8. Configure Telegram to send updates to `https://<public-host>/webhook`; then post an allowed-user video and verify a corresponding `videos` record and thumbnail.
9. Run the FastAPI engine and prerenderer if those features are enabled. The FastAPI proxy configuration expects `127.0.0.1:8000`; prerender is configured to run on port `3001`.

### Example systemd unit: Express API

Create a unit adapted to the actual deploy user and checkout path:

```ini
[Unit]
Description=Naija Homemade Express API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/video-app/backend
EnvironmentFile=/etc/naijahomemade/backend.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

After adding it: `sudo systemctl daemon-reload`, `sudo systemctl enable --now naijahomemade-api`, then inspect logs with `journalctl -u naijahomemade-api -f`.

### FastAPI engine

With a prepared virtual environment and its dependencies installed, start it from the engine directory:

```bash
cd /var/www/engines/twitter_engine
uvicorn api:app --host 127.0.0.1 --port 8000
```

The service starts Telethon clients during its FastAPI lifespan, so start it only with valid Telegram and AI/payment-related configuration. Nginx configuration is in [`python-engine.conf`](../../engines/twitter_engine/python-engine.conf).

### Prerender service

Install its Node dependencies in the directory that owns `server.js`, then run:

```bash
node /var/www/services/prerender-server/server.js
```

The process force-cleans Chromium processes and `/tmp/prerender-profile` at startup/shutdown; run it as a dedicated service, not alongside unrelated Chromium workloads.

## Webhooks and external callbacks

- **Telegram:** `POST /webhook`; only sender IDs hard-coded in `backend/server.js` are accepted. Add an authorized uploader in code and deploy before expecting its uploads to ingest.
- **NOWPayments:** `POST /api/crypto/webhook`; the API validates `x-nowpayments-sig` using `NOWPAYMENTS_IPN_SECRET`.
- **Bank transfer:** the Express API forwards checks to `PYTHON_SERVICE_URL/api/verify-transfer`.

## Backups and recovery

The Express server schedules `pg_dump` every day at 03:00 server time and uploads compressed dumps to `R2_BUCKET_NAME` under `database_backups/`. `pg_dump` must be installed and the runtime account must be able to run it.

To restore a downloaded custom-format dump, use a deliberate target database and `pg_restore`; do not run restore commands against production without confirming the target and maintenance plan.

## Operational checks

- `https://<host>/status` returns the protected Express status monitor.
- `https://<host>/sitemap.xml` should return dynamic XML.
- `https://<host>/v/<message_id>` should return a share page with video metadata.
- `GET /api/videos?category=hotties` should return JSON containing `videos`.
- Verify a thumbnail from `/api/thumbnail?chat_id=<id>&message_id=<id>`.
- Check Express logs for database initialization, Telegram webhook errors, R2 errors, and backup success.

## Common failures

| Symptom | Check |
| --- | --- |
| API exits on boot | `BOT_TOKEN`, `DATABASE_URL`, database reachability, and Node 22. |
| Album/feed SQL errors | Apply the `media_group_id` column shown above. |
| Telegram video cannot play | `WORKER_BASE_URL`, matching `SIGNING_SECRET`, Worker `BOT_TOKEN`, and R2 binding. |
| Broken thumbnails | R2 endpoint/credentials/bucket, Telegram thumbnail availability, and public asset fallback. |
| Premium upload fails | Available disk space, FFmpeg, multipart request size, R2/Stream credentials. |
| Payment remains pending | FastAPI engine reachability, NOWPayments webhook delivery/signature, or bank-engine credentials/connectivity. |
| SEO pages lack crawler content | Express `prerenderServiceUrl`, prerender service health, and Chromium availability. |
