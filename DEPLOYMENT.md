# AurisTitutum PRO — Production Deployment Guide

This guide covers deploying the full-stack app:
- **Frontend** (Vite + React) → [Vercel](https://vercel.com)
- **Backend** (Express + Google OAuth + Sheets) → [Render](https://render.com)

---

## Architecture Overview

```
Browser
  │
  ├─→ Vercel  (React SPA — static build)
  │     └─→ Firebase Auth (login / signup)
  │
  └─→ Render  (Express server — OAuth + Sheets API)
        ├─→ Google OAuth 2.0  (token exchange)
        └─→ Google Sheets API (log sync)
```

All secrets live **only on the server**. The frontend never sees Google OAuth tokens.

---

## Step 1 — Google Cloud Console Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable these APIs:
   - **Google Sheets API**
   - **Google Drive API**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorized redirect URIs**:
   ```
   http://localhost:3001/auth/google/callback
   https://your-backend-name.onrender.com/auth/google/callback
   ```
   *(Add both — local for dev, Render URL for production)*
7. Copy your **Client ID** and **Client Secret** — you'll need them below.

---

## Step 2 — Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project and add a **Web App**
3. Enable **Authentication** → Sign-in method → enable **Email/Password** and **Google**
4. Add your Vercel domain to **Authorized domains** (Settings → Authentication → Authorized domains)
5. Copy the Firebase config values — you'll need them below.

---

## Step 3 — Deploy the Backend to Render

### 3a. Push to GitHub

Make sure your entire project (including the `server/` folder) is pushed to a GitHub repository.

### 3b. Create a new Web Service on Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repository
3. Configure the service:

| Setting | Value |
|---|---|
| **Name** | `auristitutum-backend` (or any name) |
| **Root Directory** | `server` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or paid for always-on) |

### 3c. Add Environment Variables on Render

Go to your Render service → **Environment** tab and add:

| Variable | Value |
|---|---|
| `FRONTEND_URL` | `https://your-app-name.vercel.app` |
| `GOOGLE_CLIENT_ID` | `your_client_id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `your_client_secret` |
| `GOOGLE_REDIRECT_URI` | `https://your-backend-name.onrender.com/auth/google/callback` |
| `NODE_ENV` | `production` |

> **Note:** Do NOT set `PORT` on Render — Render injects it automatically.

### 3d. Verify the backend is live

Once deployed, visit:
```
https://your-backend-name.onrender.com/health
```
You should see:
```json
{ "status": "ok", "timestamp": "..." }
```

---

## Step 4 — Deploy the Frontend to Vercel

### 4a. Import project on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repository
3. Configure the project:

| Setting | Value |
|---|---|
| **Framework Preset** | `Vite` |
| **Root Directory** | `.` (project root, not `server/`) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 4b. Add Environment Variables on Vercel

Go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `VITE_BACKEND_URL` | `https://your-backend-name.onrender.com` |
| `VITE_FIREBASE_API_KEY` | your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project-id.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project-id.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | your messaging sender ID |
| `VITE_FIREBASE_APP_ID` | your Firebase app ID |

> **Important:** All frontend variables MUST be prefixed with `VITE_` — Vite only exposes variables with this prefix to the browser bundle.

### 4c. Trigger a deployment

After adding the environment variables, go to **Deployments → Redeploy** to apply them.

### 4d. Verify the frontend is live

Visit your Vercel URL. The app should load, and the Sign In page should be fully functional.

---

## Step 5 — Wire Everything Together

### Update Google Cloud Console

Add your Vercel domain to **Authorized JavaScript origins** in your OAuth client:
```
https://your-app-name.vercel.app
```

### Update Firebase Authorized Domains

In Firebase Console → Authentication → Settings → Authorized domains:
```
your-app-name.vercel.app
```

### Test the full flow end-to-end

1. Open your Vercel URL
2. Sign up / sign in via Firebase Auth
3. Go to **Settings** → **Google Sheets** → click **Connect Google Sheets**
4. You should be redirected to Google's OAuth consent screen
5. After approving, you should be redirected back to `/app/settings` with a success message
6. Try **Sync to Sheets** — your logs should appear in the Google Sheet

---

## Local Development Setup

### Frontend

```bash
# In project root
cp .env.example .env.local
# Edit .env.local and fill in your values
npm install
npm run dev
```

### Backend

```bash
# In /server
cp .env.example .env
# Edit .env and fill in your values
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:3001`.

---

## Environment Variables — Complete Reference

### Frontend (Vercel)

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | ✅ Yes | Full URL of your Render backend |
| `VITE_FIREBASE_API_KEY` | ✅ Yes | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ Yes | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ Yes | Firebase app ID |

### Backend (Render)

| Variable | Required | Description |
|---|---|---|
| `FRONTEND_URL` | ✅ Yes | Your Vercel frontend URL (for CORS + OAuth redirect) |
| `GOOGLE_CLIENT_ID` | ✅ Yes | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | ✅ Yes | Must match exactly what's in Google Cloud Console |
| `NODE_ENV` | ✅ Yes | Set to `production` |
| `PORT` | ❌ Auto | Injected automatically by Render — do not set |

---

## Common Issues & Fixes

### CORS errors in production

- Make sure `FRONTEND_URL` on Render exactly matches your Vercel URL (no trailing slash)
- Example: `https://auristitutum.vercel.app` not `https://auristitutum.vercel.app/`

### OAuth redirect_uri_mismatch

- The `GOOGLE_REDIRECT_URI` on Render **must exactly match** the URI you added in Google Cloud Console
- Check for `http` vs `https` differences
- Check for trailing slashes

### Vercel 404 on page refresh

- The `vercel.json` file at the project root handles this by rewriting all routes to `index.html`
- Make sure `vercel.json` is committed and present in your repo root

### Render service sleeping (free tier)

- Render free-tier services sleep after 15 minutes of inactivity
- The first OAuth request after sleep may be slow (30–60 seconds cold start)
- Upgrade to a paid Render instance for always-on behaviour

### Google Sheets token expired

- The backend automatically refreshes tokens using the stored `refresh_token`
- If a user sees a "Please reconnect" error, they just need to go to Settings → Google Sheets → Connect again

### Mixed content errors

- Both your Vercel URL and Render URL must use **HTTPS** in production
- Never set `VITE_BACKEND_URL` to an `http://` URL in production

---

## Security Checklist

- [ ] No secrets are hardcoded in source code
- [ ] `.env` and `.env.local` are in `.gitignore`
- [ ] `server/.userstore.json` is in `.gitignore`
- [ ] Google OAuth tokens are stored server-side only
- [ ] `CORS` is locked to `FRONTEND_URL` only (no wildcard)
- [ ] Firebase API key is scoped to your domain in Firebase Console
- [ ] Google Cloud project has only Sheets + Drive APIs enabled

---

## Deployment Checklist

- [ ] Backend deployed to Render and `/health` returns 200
- [ ] All 5 backend env vars set on Render
- [ ] Frontend deployed to Vercel and app loads
- [ ] All 7 frontend env vars set on Vercel
- [ ] Render backend URL added to Google Cloud Console redirect URIs
- [ ] Vercel frontend URL added to Google Cloud Console JS origins
- [ ] Vercel frontend URL added to Firebase Authorized Domains
- [ ] OAuth flow tested end-to-end in production
- [ ] Google Sheets sync tested in production
- [ ] Reminder notifications tested in production (HTTPS required for browser notifications)