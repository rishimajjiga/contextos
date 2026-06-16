# ContextOS — Google Cloud Deployment Guide

Deploy the backend to **Cloud Run** and the frontend to **Firebase Hosting**.

---

## Prerequisites (install these first)

| Tool | Install Link |
|---|---|
| Google Cloud CLI (`gcloud`) | https://cloud.google.com/sdk/docs/install |
| Firebase CLI | `npm install -g firebase-tools` |
| Docker Desktop | https://www.docker.com/products/docker-desktop/ |
| Node.js 18+ | https://nodejs.org |

After installing gcloud, run:
```
gcloud auth login
gcloud auth configure-docker
```

---

## Step 1 — Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **New Project** → name it `contextos-app` (or anything you like)
3. Copy your **Project ID** (shown under the project name)

---

## Step 2 — Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → select the same Google Cloud project you just created
3. Disable Google Analytics if you don't need it → Create project

---

## Step 3 — Run the Deployment Script

Double-click `deploy-google.bat` in the root of the project.

It will ask you for:
- Google Cloud Project ID
- Region (default: `us-central1`)
- Your environment variables (from your `.env` file):

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard → Project Settings → API → service_role key |
| `CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `SECRET_KEY` | Copy from your `backend/.env` |

The script will:
1. Build the Docker image → push to Google Container Registry
2. Deploy to Cloud Run → get the live backend URL
3. Update `extension/background.js` with that URL
4. Build the React frontend
5. Deploy to Firebase Hosting

---

## Step 4 — Update CORS for Your Frontend URL

After Firebase deploy, you'll get a URL like `https://contextos-app.web.app`.

Update this in Cloud Run:
```
gcloud run services update contextos-backend \
  --region us-central1 \
  --update-env-vars CORS_ORIGINS=["https://contextos-app.web.app","https://contextos-app.firebaseapp.com"]
```

Or update your `backend/.env` and re-run the deploy script.

---

## Step 5 — Load the Chrome Extension

See `extension/INSTALL.md` for full instructions.

Quick version:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Click the ContextOS icon → Settings
5. Set API URL to your Cloud Run URL (e.g. `https://contextos-backend-xxxx.run.app`)
6. Set API Key from the ContextOS web app → Test Connection

---

## Deployed URLs

After deployment, your project lives at:

| Service | URL |
|---|---|
| Backend API | `https://contextos-backend-XXXX-uc.a.run.app` |
| Frontend | `https://YOUR-PROJECT-ID.web.app` |
| API Docs | `https://contextos-backend-XXXX-uc.a.run.app/docs` |

---

## Re-deploying

**Backend only** (after code changes):
```bat
cd backend
gcloud builds submit --tag gcr.io/YOUR-PROJECT-ID/contextos-backend:latest .
gcloud run deploy contextos-backend --image gcr.io/YOUR-PROJECT-ID/contextos-backend:latest --region us-central1
```

**Frontend only** (after UI changes):
```bat
cd frontend
npm run build
firebase deploy --only hosting
```

---

## Costs

Cloud Run and Firebase Hosting both have generous free tiers:
- **Cloud Run**: 2 million requests/month free, scales to zero when not used
- **Firebase Hosting**: 10 GB storage, 360 MB/day transfer free
- **Estimated cost for a small project**: $0/month (free tier)
