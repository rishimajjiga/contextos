import os
os.environ['CORS_ORIGINS'] = '["https://contextos-eta.vercel.app", "http://localhost:5173"]'
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:postgres@localhost:5432/postgres'
os.environ['SECRET_KEY'] = '12345678901234567890123456789012'
os.environ['CLERK_SECRET_KEY'] = 'test'
os.environ['CLERK_PUBLISHABLE_KEY'] = 'test'
os.environ['CLERK_JWKS_URL'] = 'test'
os.environ['SUPABASE_URL'] = 'test'
os.environ['SUPABASE_ANON_KEY'] = 'test'
os.environ['SUPABASE_SERVICE_KEY'] = 'test'


from app.config.settings import settings
print("LOADED CORS ORIGINS:", settings.cors_origins)
