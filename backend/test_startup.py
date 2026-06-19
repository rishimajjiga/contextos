import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("ContextOS Backend Startup Test")
print("=" * 50)
print(f"Python: {sys.version.split()[0]}")
print()

all_ok = True

def ok(msg): print(f"  [OK] {msg}")
def fail(msg, e): global all_ok; all_ok = False; print(f"  [FAIL] {msg}: {e}")

try:
    import pydantic_settings; ok(f"pydantic_settings {pydantic_settings.VERSION}")
except Exception as e: fail("pydantic_settings", e)

try:
    from app.config.settings import settings
    ok(f"settings — env={settings.app_env}")
    ok(f"DATABASE_URL = {settings.database_url[:45]}...")
except Exception as e: fail("settings", e)

try:
    import sqlalchemy; ok(f"sqlalchemy {sqlalchemy.__version__}")
except Exception as e: fail("sqlalchemy", e)

try:
    import psycopg; ok(f"psycopg {psycopg.__version__}")
except Exception as e: fail("psycopg", e)

try:
    import fastapi; ok(f"fastapi {fastapi.__version__}")
except Exception as e: fail("fastapi", e)

try:
    from app.main import app
    ok(f"app.main — {len(app.routes)} routes")
except Exception as e: fail("app.main", e)

print()
if all_ok:
    print("ALL CHECKS PASSED")
    sys.exit(0)
else:
    print("CHECKS FAILED — see errors above")
    sys.exit(1)
