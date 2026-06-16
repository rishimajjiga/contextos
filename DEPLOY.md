# ContextOS — Deployment Guide

## Stack
| Layer | Service |
|---|---|
| Frontend | Vercel |
| Backend | Railway |
| Database | Supabase (PostgreSQL) |
| Auth | Clerk |
| Payments | Razorpay |
| Domain | GoDaddy |

---

## 1. Supabase (Database)

1. Create a new project at https://supabase.com
2. Go to **Settings → Database → Connection string** → copy the **URI (pooled)** string
3. Replace `[YOUR-PASSWORD]` with your DB password
4. This becomes your `DATABASE_URL` env var (use `postgresql+asyncpg://...` prefix)

---

## 2. Backend → Railway

1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Select the `contextos` repo, set **Root Directory** to `backend`
3. Railway auto-detects Python. Set the start command:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Add these environment variables in Railway dashboard:

```env
APP_ENV=production
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<ref>.supabase.co:5432/postgres
CLERK_JWKS_URL=https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json
CLERK_SECRET_KEY=sk_live_...
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_BUCKET=contextos-documents
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PRO_PLAN_ID=plan_...
RAZORPAY_PRO_ANNUAL_PLAN_ID=plan_...
RAZORPAY_TEAM_PLAN_ID=plan_...
RAZORPAY_TEAM_ANNUAL_PLAN_ID=plan_...
RAZORPAY_STUDENT_PLAN_ID=plan_...
CORS_ORIGINS=https://your-domain.com,https://your-app.vercel.app
FRONTEND_URL=https://your-domain.com
```

5. After deploy, copy your Railway URL (e.g. `https://contextos-backend-production.up.railway.app`)

---

## 3. Frontend → Vercel

1. Go to https://vercel.com → Import Git Repository → select `contextos/frontend`
2. Framework: **Vite** (auto-detected)
3. Add these environment variables in Vercel dashboard:

```env
VITE_API_URL=https://contextos-backend-production.up.railway.app
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_RAZORPAY_KEY_ID=rzp_live_...
```

4. Deploy. Vercel gives you a URL like `https://contextos.vercel.app`

---

## 4. GoDaddy Domain

1. In Vercel: go to your project → **Settings → Domains** → Add `yourdomain.com`
2. Vercel shows you DNS records to add (usually an A record + CNAME)
3. In GoDaddy: **My Products → DNS → Manage** for your domain
4. Add the records Vercel shows:
   - **A record**: `@` → `76.76.21.21` (Vercel IP)
   - **CNAME**: `www` → `cname.vercel-dns.com`
5. For the backend, in Railway: **Settings → Networking → Custom Domain** → add `api.yourdomain.com`
6. In GoDaddy add: **CNAME**: `api` → your Railway URL

Wait 5–30 min for DNS propagation.

---

## 5. Post-Deploy Checklist

- [ ] Visit `https://yourdomain.com` — frontend loads
- [ ] Visit `https://api.yourdomain.com/health` — returns `{"status":"ok"}`
- [ ] Sign up, create a memory, confirm it saves
- [ ] Update `CORS_ORIGINS` in Railway to include your final domain
- [ ] Set Razorpay webhook URL to `https://api.yourdomain.com/api/v1/billing/webhook`
- [ ] Update Chrome extension `DEFAULT_API_URL` in `background.js` to `https://api.yourdomain.com`
- [ ] Update extension manifest `host_permissions` to include your production API domain

---

## 6. Chrome Extension — Production Build

Edit `extension/background.js` line 4:
```js
const DEFAULT_API_URL = "https://api.yourdomain.com";
```

Then zip the `extension/` folder and submit to Chrome Web Store.
