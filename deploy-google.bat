@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo  ContextOS — Google Cloud Deployment Script
echo ============================================================
echo.

REM ── Step 0: Collect config ───────────────────────────────────

set /p PROJECT_ID="Enter your Google Cloud Project ID: "
set /p REGION="Enter region (press Enter for us-central1): "
if "!REGION!"=="" set REGION=us-central1

set /p FIREBASE_PROJECT="Enter Firebase Project ID (press Enter to use same as above): "
if "!FIREBASE_PROJECT!"=="" set FIREBASE_PROJECT=!PROJECT_ID!

echo.
echo Project:  !PROJECT_ID!
echo Region:   !REGION!
echo Firebase: !FIREBASE_PROJECT!
echo.
pause

REM ── Step 1: Check prerequisites ──────────────────────────────

echo [1/7] Checking prerequisites...
where gcloud >nul 2>&1
if errorlevel 1 (
    echo ERROR: gcloud CLI not found.
    echo Install from: https://cloud.google.com/sdk/docs/install
    pause & exit /b 1
)
where firebase >nul 2>&1
if errorlevel 1 (
    echo ERROR: Firebase CLI not found.
    echo Run: npm install -g firebase-tools
    pause & exit /b 1
)
echo OK: gcloud and firebase found.
echo.

REM ── Step 2: Set project ───────────────────────────────────────

echo [2/7] Setting Google Cloud project...
gcloud config set project !PROJECT_ID!
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com
echo.

REM ── Step 3: Set backend environment variables ─────────────────

echo [3/7] Configuring backend secrets on Cloud Run...
echo.
echo You need to set these secrets. They will be stored in Cloud Run env vars.
echo (Get these from your .env file or Supabase/Clerk dashboards)
echo.
set /p SUPABASE_URL="SUPABASE_URL: "
set /p SUPABASE_KEY="SUPABASE_KEY: "
set /p CLERK_PUBLISHABLE_KEY="CLERK_PUBLISHABLE_KEY: "
set /p CLERK_SECRET_KEY="CLERK_SECRET_KEY: "
set /p SECRET_KEY="SECRET_KEY (any random 32+ char string): "
echo.

REM ── Step 4: Build and push Docker image ───────────────────────

echo [4/7] Building and pushing Docker image...
cd /d "%~dp0backend"
gcloud builds submit --tag gcr.io/!PROJECT_ID!/contextos-backend:latest .
if errorlevel 1 (
    echo ERROR: Docker build failed.
    pause & exit /b 1
)
echo.

REM ── Step 5: Deploy to Cloud Run ───────────────────────────────

echo [5/7] Deploying backend to Cloud Run...
gcloud run deploy contextos-backend ^
    --image gcr.io/!PROJECT_ID!/contextos-backend:latest ^
    --platform managed ^
    --region !REGION! ^
    --allow-unauthenticated ^
    --port 8000 ^
    --memory 512Mi ^
    --min-instances 0 ^
    --max-instances 10 ^
    --set-env-vars APP_ENV=production,^
DATABASE_URL=!SUPABASE_URL!,^
SUPABASE_URL=!SUPABASE_URL!,^
SUPABASE_SERVICE_KEY=!SUPABASE_KEY!,^
CLERK_PUBLISHABLE_KEY=!CLERK_PUBLISHABLE_KEY!,^
CLERK_SECRET_KEY=!CLERK_SECRET_KEY!,^
SECRET_KEY=!SECRET_KEY!

if errorlevel 1 (
    echo ERROR: Cloud Run deployment failed.
    pause & exit /b 1
)
echo.

REM ── Step 6: Get the backend URL ───────────────────────────────

echo [6/7] Getting backend URL...
for /f "tokens=*" %%i in ('gcloud run services describe contextos-backend --platform managed --region !REGION! --format "value(status.url)"') do set BACKEND_URL=%%i
echo.
echo Backend deployed at: !BACKEND_URL!
echo.

REM ── Update extension with real backend URL ────────────────────

echo Updating extension default API URL...
cd /d "%~dp0"
powershell -Command "(Get-Content 'extension\background.js') -replace 'https://YOUR-BACKEND.run.app', '!BACKEND_URL!' | Set-Content 'extension\background.js'"
echo Extension updated.
echo.

REM ── Step 7: Build and deploy frontend ────────────────────────

echo [7/7] Building and deploying frontend to Firebase Hosting...
cd /d "%~dp0frontend"

REM Write .env.production
echo VITE_API_URL=!BACKEND_URL! > .env.production
echo VITE_CLERK_PUBLISHABLE_KEY=!CLERK_PUBLISHABLE_KEY! >> .env.production

REM Install deps and build
call npm install
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed.
    pause & exit /b 1
)

REM Update .firebaserc with actual project
cd /d "%~dp0"
powershell -Command "(Get-Content '.firebaserc') -replace 'contextos-app', '!FIREBASE_PROJECT!' | Set-Content '.firebaserc'"

REM Deploy
firebase login
firebase use !FIREBASE_PROJECT!
firebase deploy --only hosting
if errorlevel 1 (
    echo ERROR: Firebase deploy failed.
    pause & exit /b 1
)
echo.

REM ── Done ─────────────────────────────────────────────────────

echo ============================================================
echo  Deployment Complete!
echo ============================================================
echo.
echo  Backend (Cloud Run):  !BACKEND_URL!
echo.
echo  Next steps:
echo  1. Open extension\INSTALL.md to load the Chrome extension
echo  2. In the extension popup ^> Settings, paste your backend URL:
echo     !BACKEND_URL!
echo  3. Paste your ContextOS API key (from the web app)
echo  4. Done — extension connects to your live backend!
echo.
pause
