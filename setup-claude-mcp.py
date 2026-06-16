"""
Merges the ContextOS MCP server entry into Claude Desktop's config.
Run via: setup-claude-mcp.bat
"""
import json
import os
import shutil
from pathlib import Path

CONFIG_PATH  = Path(os.environ["APPDATA"]) / "Claude" / "claude_desktop_config.json"
PYTHON_PATH  = Path(__file__).parent / "mcp-server" / ".venv" / "Scripts" / "python.exe"
SERVER_PATH  = Path(__file__).parent / "mcp-server" / "server.py"
RUN_BAT_PATH = Path(__file__).parent / "mcp-server" / "run-server.bat"
ENV_PATH     = Path(__file__).parent / "mcp-server" / ".env"

# Read the API key from mcp-server/.env
api_key = ""
api_url = "http://localhost:8000"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith("CONTEXTOS_API_KEY="):
            api_key = line.split("=", 1)[1].strip()
        if line.startswith("CONTEXTOS_API_URL="):
            api_url = line.split("=", 1)[1].strip()

if not api_key:
    print("ERROR: Could not read CONTEXTOS_API_KEY from mcp-server/.env")
    input("Press Enter to close...")
    exit(1)

# Load existing config (or create empty one)
if CONFIG_PATH.exists():
    shutil.copy(CONFIG_PATH, str(CONFIG_PATH) + ".backup")
    with open(CONFIG_PATH) as f:
        config = json.load(f)
    print(f"Loaded existing config from {CONFIG_PATH}")
else:
    config = {}
    print(f"No existing config found, creating new one at {CONFIG_PATH}")

if "mcpServers" not in config:
    config["mcpServers"] = {}

config["mcpServers"]["contextos"] = {
    "command": "cmd",
    "args": ["/c", str(RUN_BAT_PATH)],
}

CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(CONFIG_PATH, "w") as f:
    json.dump(config, f, indent=2)

print()
print("=" * 60)
print("Claude Desktop config updated!")
print(f"Config path: {CONFIG_PATH}")
print()
print("MCP server entry added:")
print(f"  command: cmd /c {RUN_BAT_PATH}")
print()
print("NEXT STEP: Restart Claude Desktop for the MCP to take effect.")
print("=" * 60)
print()
input("Press Enter to close...")
