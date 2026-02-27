# AurisTitutum PRO — Deployment Guide

Everything — frontend, API functions, and persistent storage — deploys to a
**single Vercel project**. No separate backend server, no Render, no extra
hosting accounts.

```
Browser
  │
  └─→ Vercel  (one deployment)
        ├── /             React SPA (Vite build → dist/)
        ├── /api/*        Serverless functions (Node 20, /api folder)
        │     ├── /api/auth/google          Start OAuth flow
        │     ├── /api/auth/google/callback OAuth callback
        │     ├── /api/auth/status          Check connection
        │     ├── /api/auth/disconnect      Remove tokens
        │     ├── /api/append-log           Append single row
        │     ├── /api/sync-logs            Bulk sync
        │     └── /api/get-logs             Read rows
        └── Vercel KV (Upstash Redis)
              └── Stores OAuth tokens + spreadsheet IDs
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18 or 20 | nodejs.org |
| Vercel CLI | latest | `npm i -g vercel` |
| Git | any | git-scm.com |

---

## Step 1 — Google Cloud Console

### 1a. Enable APIs

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Library** and enable:
   - **Google Sheets API**
   - **Google Drive API**

### 1b. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Under **Authorized redirect URIs**, add **both** of these:

   ```
   http://localhost:3000/api/auth/google/callback
   https://YOUR-APP.vercel.app/api/auth/google/callback
   ```

   > Replace `YOUR-APP` with your actual Vercel project subdomain.
   > You can add the production URI after your first deployment — just come back here.

4. Click **Create** and copy the **Client ID** and **Client Secret**.

### 1c. Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (unless your org has Workspace)
3. Fill in App name, support email, and developer email
4. Under **Scopes**, add:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
5. Add yourself as a **Test user** while the app is in Testing mode

---

## Step 2 — Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project (or use an existing one)
3. Click **Add app → Web** and register it
4. Copy the Firebase config object (you need all 6 values)
5. Go to **Authentication → Sign-in method** and enable:
   - **Email/Password**
   - **Google** (optional but recommended)
6. Go to **Authentication → Settings → Authorized domains** and add:
   ```
   YOUR-APP.vercel.app
   localhost
   ```

---

## Step 3 — Deploy to Vercel

### 3a. Push to GitHub

Make sure your project is in a GitHub (or GitLab / Bitbucket) repository.

```bash
git add .
git commit -m "chore: prepare for Vercel deployment"
git push
```

### 3b. Import the project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your repository
3. Vercel auto-detects Vite — confirm these settings:

   | Setting | Value |
   |---|---|
   | Framework Preset | `Vite` |
   | Root Directory | `.` (project root) |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |

4. **Do not deploy yet** — add environment variables first (Step 4).

---

## Step 4 — Upstash Redis (persistent token store)

The API functions store OAuth tokens in Upstash Redis across serverless
invocations. Set it up before the first deploy.

### Option A — Vercel Marketplace (easiest)

1. In your Vercel project dashboard, click the **Integrations** tab
2. Search for **Upstash Redis** and click **Add Integration**
3. Follow the prompts to create a free Redis database
4. Vercel automatically adds `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` to your project's Environment Variables —
   nothing to copy manually
5. Pull the new env vars to your local machine:

   ```bash
   vercel env pull .env.local
   ```

### Option B — Upstash directly (upstash.com)

1. Create a free account at [upstash.com](https://upstash.com)
2. Click **Create Database** → choose a region close to your users
3. From the database details page, copy:
   - **REST URL** → set as `UPSTASH_REDIS_REST_URL` in Vercel
   - **REST Token** → set as `UPSTASH_REDIS_REST_TOKEN` in Vercel
4. Add both variables in Vercel → **Settings → Environment Variables**

---

## Step 5 — Environment Variables

Go to your Vercel project → **Settings → Environment Variables** and add every
variable in the table below. Make sure the **Environment** column includes both
**Production** and **Preview** (and optionally Development).

### Frontend variables (exposed to browser via Vite)

| Variable | Value | Notes |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `AIza…` | From Firebase console |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` | |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1234567890` | |
| `VITE_FIREBASE_APP_ID` | `1:123…:web:abc…` | |
| `VITE_BACKEND_URL` | *(leave empty)* | Empty = same-origin `/api` |


### Server-side variables (API functions only — never exposed to browser)

| Variable | Value | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `123….apps.googleusercontent.com` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-…` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-APP.vercel.app/api/auth/google/callback` | Must match Google Console exactly |
| `FRONTEND_URL` | `https://YOUR-APP.vercel.app` | Optional — callback derives it from host if omitted |
| `UPSTASH_REDIS_REST_URL` | *(auto-added by Upstash integration)* | Do not set manually |
| `UPSTASH_REDIS_REST_TOKEN` | *(auto-added by Upstash integration)* | Do not set manually |

> **Important:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
> `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` must **not** be
> prefixed with `VITE_`. They are server-only secrets — never expose them to
> the browser.

---

## Step 6 — First Deploy

After adding all environment variables, trigger a deployment:

1. In Vercel → **Deployments** → click **Redeploy** (or push a new commit)
2. Wait for the build to complete (~60 s)
3. Visit your deployment URL

### Verify the API is live

```
https://YOUR-APP.vercel.app/api/health
```

Expected response:

```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z", "region": "iad1" }
```

---

## Step 7 — Go-Live Checklist

### Google Cloud Console

- [ ] Add `https://YOUR-APP.vercel.app/api/auth/google/callback` to Authorized redirect URIs
- [ ] Add `https://YOUR-APP.vercel.app` to Authorized JavaScript origins

### Firebase

- [ ] Add `YOUR-APP.vercel.app` to Authorized domains
- [ ] (When ready for public use) Publish the OAuth consent screen

### End-to-End Test

- [ ] `/api/health` returns `{ "status": "ok" }`
- [ ] Sign up / sign in with Firebase Auth works
- [ ] Settings → Google Sheets → **Connect** launches the Google consent screen
- [ ] After consent, redirected back to `/app/settings?sheets_connected=true`
- [ ] **Sync to Sheets** populates the Google Spreadsheet correctly
- [ ] **Get Logs** reads rows back from the spreadsheet
- [ ] Reminder notifications fire in-app (toast) and as browser alerts

---

## Local Development

### Option A — `vercel dev` (recommended — runs everything)

`vercel dev` runs both the Vite dev server and the API serverless functions
on the same port (default **3000**), so there are zero CORS issues and the
`/api/*` routes work exactly as they do in production.

```bash
# One-time: link your local repo to your Vercel project
vercel link

# Pull production env vars into .env.local
vercel env pull .env.local

# Start everything
vercel dev
```

Then open [http://localhost:3000](http://localhost:3000).

> Make sure `GOOGLE_REDIRECT_URI` in your `.env.local` is set to:
> `http://localhost:3000/api/auth/google/callback`
> and that this URI is registered in Google Cloud Console.

### Option B — Vite only (frontend dev without API)

```bash
npm run dev
```

The app runs on [http://localhost:5173](http://localhost:5173). The Google
Sheets features won't work without the API, but all frontend UI is accessible.

---

## Environment Variables — Full Reference

### Frontend (Vercel + local)

| Variable | Required | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | ✅ Yes | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ Yes | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ Yes | Firebase app ID |
| `VITE_BACKEND_URL` | ❌ No | Leave empty — API is same-origin at `/api` |

### Server-side (Vercel project settings only — never in source code)

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | ✅ Yes | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | ✅ Yes | `https://YOUR-APP.vercel.app/api/auth/google/callback` |
| `FRONTEND_URL` | ❌ Optional | Explicit frontend origin; auto-derived from host if absent |
| `UPSTASH_REDIS_REST_URL` | ✅ Yes | From Upstash dashboard or Vercel integration |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Yes | From Upstash dashboard or Vercel integration |

---

## Troubleshooting

### `redirect_uri_mismatch` from Google

`GOOGLE_REDIRECT_URI` in Vercel must **exactly** match a URI registered in
Google Cloud Console — same scheme (`https`), same hostname, same path
(`/api/auth/google/callback`). Check for trailing slashes.

### 404 on page refresh (e.g. `/app/habits`)

The `vercel.json` rewrite routes all non-`/api/*` paths to `index.html` for
client-side routing. Make sure `vercel.json` is committed and present in the
repository root. The critical line is:

```json
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

### Google Sheets "not connected" after deployment

Tokens are stored in Upstash Redis. If Redis is not configured (missing
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), the store module
falls back to an in-memory Map that is wiped on every cold start. Set up
Upstash Redis (Step 4) and the user will only need to connect once.

### Functions timeout on Hobby plan

Vercel Hobby plan allows up to **10 seconds** per function invocation by
default. Google Sheets API calls typically complete in 1–3 s. If you see
timeout errors on large sync operations (`sync-logs`), reduce the number of
rows or upgrade to Vercel Pro (60 s limit).

### `@upstash/redis` not found during build

Run `npm install` in the project root — `@upstash/redis` and `googleapis`
are listed as dependencies in the root `package.json` which Vercel uses when
building the API functions.

### CORS errors in local development

Use `vercel dev` instead of `npm run dev`. `vercel dev` serves everything on
one port so the browser never makes a cross-origin request. If you must use
`npm run dev`, set `FRONTEND_URL=http://localhost:5173` in `.env.local`.

---

## Security Checklist

- [ ] No secrets in source code (`GOOGLE_CLIENT_SECRET`, `KV_REST_API_TOKEN`, etc.)
- [ ] `.env.local` and `.env` are in `.gitignore` — never committed
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are NOT prefixed `VITE_`
- [ ] OAuth tokens are stored server-side in Vercel KV — never sent to the browser
- [ ] CORS is locked to `FRONTEND_URL` (or same-origin) — no wildcard in production
- [ ] Google Cloud project has only Sheets + Drive APIs enabled (least privilege)
- [ ] Firebase API key is restricted to your Vercel domain in Firebase Console
- [ ] OAuth consent screen published before going live to real users