# Deployment Guide — Temporary Review Deployment

> **⚠ TEMPORARY DEPLOYMENT NOTICE:** This is a temporary review deployment with
> **synthetic data only**. There is no real victim data, no real case data, and no
> real personal information anywhere in this system. All personas are fictional
> constructs for demonstration purposes. Do not share this URL publicly.

## What's Ready

All code changes for deployment are complete:

1. **CORS middleware** — `server/src/index.js` now accepts `ALLOWED_ORIGINS` env var
2. **HTTPS cookies** — session cookies set `secure: true` in production
3. **Shared API utility** — `client/src/api.js` reads `VITE_API_BASE` for cross-origin API calls
4. **All 5 components** updated to use shared API utility
5. **Deployment configs** — `render.yaml` (backend) and `vercel.json` (frontend)

## Step 1: Deploy Backend to Render

1. Go to [render.com](https://render.com) and sign up / log in
2. Click **New +** → **Web Service**
3. Connect your GitHub repo (or use the "Deploy via Git URL" option)
4. Configure:
   - **Name:** `freebuff-api`
   - **Runtime:** Node
   - **Plan:** Free
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
5. Add environment variables:
   - `NODE_ENV` = `production`
   - `GROQ_API_KEY` = your Groq API key
   - `SESSION_SECRET` = any random string (e.g., `openssl rand -hex 32`)
   - `ALLOWED_ORIGINS` = (leave blank for now, update after frontend deploys)
   - `API_PORT` = `10000`
6. Click **Create Web Service**
7. Wait for deployment, note the URL (e.g., `https://freebuff-api.onrender.com`)

## Step 2: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up / log in
2. Click **Add New Project**
3. Import your GitHub repo
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add environment variable:
   - `VITE_API_BASE` = `https://freebuff-api.onrender.com` (your Render URL)
6. Click **Deploy**
7. Note the frontend URL (e.g., `https://freebuff-xyz.vercel.app`)

## Step 3: Update CORS on Backend

1. Go back to Render dashboard
2. Edit the `freebuff-api` service
3. Update `ALLOWED_ORIGINS` to include your Vercel URL:
   - `ALLOWED_ORIGINS` = `https://freebuff-xyz.vercel.app`
4. Save — Render will auto-redeploy

## Step 4: Test

1. Open your Vercel URL
2. Sign in as `counsellor` (passcode: `demo`)
3. Verify case queue loads (should show 8 cases)
4. Click a case, verify trend chart and interventions render
5. Sign out, sign in as `admin`
6. Verify aggregate dashboard loads with charts
7. Go to Check-in, select a case, send a message
8. Verify assessment appears after reply

## Step 5: Test Fallback Mode

1. On Render, set `FORCE_FALLBACK_MODE` = `true`
2. Wait for redeploy
3. Go to Check-in, send a message
4. Verify you get a cached response (assessment should still appear)

## Step 6: Add README Notice

The following notice should be added to README.md:

```markdown
## Temporary Review Deployment

This is a temporary deployment for team review. **All data is synthetic** —
there is no real victim data, no real case data, and no real personal
information. Do not share this URL publicly.

Deployed frontend: [URL]
Deployed backend: [URL]
```

## Environment Variables Summary

### Backend (Render)

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Enables secure cookies |
| `GROQ_API_KEY` | your key | Or leave empty for fallback mode |
| `SESSION_SECRET` | random string | Generate with `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | frontend URL | Comma-separated for multiple |
| `API_PORT` | `10000` | Render uses this internally |
| `FORCE_FALLBACK_MODE` | `true`/`false` | Test fallback with `true` |

### Frontend (Vercel)

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_BASE` | backend URL | e.g., `https://freebuff-api.onrender.com` |
