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
        │     ├── /api/state/get            Read app state snapshot
        │     └── /api/state/set            Save app state snapshot
        └── Vercel KV (Upstash Redis)
              └── Stores app state snapshots
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18 or 20 | nodejs.org |
| Vercel CLI | latest | `npm i -g vercel` |
| Git | any | git-scm.com |

---

## Step 1 — Firebase

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

## Step 2 — Deploy to Vercel

### 2a. Push to GitHub

Make sure your project is in a GitHub (or GitLab / Bitbucket) repository.

```bash
git add .
git commit -m "chore: prepare for Vercel deployment"
git push
```

### 2b. Import the project in Vercel

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

4. **Do not deploy yet** — add environment variables first (Step 3).

---

## Step 3 — Upstash Redis (persistent state store)

The API functions store app state snapshots in Upstash Redis across serverless
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

## Step 4 — Environment Variables

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
| `UPSTASH_REDIS_REST_URL` | *(auto-added by Upstash integration)* | Do not set manually |
| `UPSTASH_REDIS_REST_TOKEN` | *(auto-added by Upstash integration)* | Do not set manually |

---

## Step 5 — First Deploy

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

## Step 6 — Go-Live Checklist

### Firebase

- [ ] Add `YOUR-APP.vercel.app` to Authorized domains

### End-to-End Test

- [ ] `/api/health` returns `{ "status": "ok" }`
- [ ] Sign up / sign in with Firebase Auth works
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

### Option B — Vite only (frontend dev without API)

```bash
npm run dev
```

The app runs on [http://localhost:5173](http://localhost:5173).

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
| `UPSTASH_REDIS_REST_URL` | ✅ Yes | From Upstash dashboard or Vercel integration |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Yes | From Upstash dashboard or Vercel integration |

---

## Troubleshooting

### 404 on page refresh (e.g. `/app/habits`)

The `vercel.json` rewrite routes all non-`/api/*` paths to `index.html` for
client-side routing. Make sure `vercel.json` is committed and present in the
repository root. The critical line is:

```json
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

### `@upstash/redis` not found during build

Run `npm install` in the project root — `@upstash/redis` is listed as a dependency in the root `package.json` which Vercel uses when building the API functions.

---

## Security Checklist

- [ ] No secrets in source code (`UPSTASH_REDIS_REST_TOKEN`, etc.)
- [ ] `.env.local` and `.env` are in `.gitignore` — never committed
- [ ] Firebase API key is restricted to your Vercel domain in Firebase Console