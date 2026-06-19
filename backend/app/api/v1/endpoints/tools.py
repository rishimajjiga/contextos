"""
app/api/v1/endpoints/tools.py

/api/v1/tools — Machine-readable tool definitions.

GET /api/v1/tools/openai
  Returns tool definitions in OpenAI function-calling format.
  Works with: GPT-4/4o, Gemini (same format), Mistral, Groq, Cohere,
  LangChain, LlamaIndex, or any OpenAI-compatible SDK.

No authentication required — it's just a schema.
"""
from fastapi import APIRouter

router = APIRouter()

# The tool definitions mirror what the MCP server exposes, expressed in
# OpenAI function-calling format so any model or framework can use them.
OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_my_profile",
            "description": (
                "Retrieve the user's professional profile: their role, skills, "
                "preferred programming languages, frameworks, communication tone, "
                "and response style. Call this once at the start of a conversation "
                "to understand who you are talking to."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_context",
            "description": (
                "Get the user's full context in one call: profile and all projects. "
                "Use this instead of calling get_my_profile + list_my_projects separately "
                "when you need a broad understanding of the user's world."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "format": {
                        "type": "string",
                        "enum": ["markdown", "text", "json"],
                        "description": "Output format. Use 'text' for smaller context windows.",
                        "default": "markdown",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_my_projects",
            "description": (
                "List the user's projects with their tech stack, goals, architecture, "
                "active tasks, and current problems. Use when the user asks about "
                "their work, what they are building, or what they are stuck on."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of projects to return (default: 10).",
                        "default": 10,
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_project",
            "description": (
                "Get full details for a specific project by its ID. "
                "Use after list_my_projects to drill into a project the user mentioned."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "The project's UUID from list_my_projects.",
                    }
                },
                "required": ["project_id"],
            },
        },
    },
]

# How to wire these tools to the ContextOS API
INTEGRATION_GUIDE = {
    "base_url": "https://your-contextos-api.com/api/v1",
    "auth": {
        "type": "header",
        "header": "X-Api-Key",
        "value": "ctxos_<your_api_key>",
    },
    "tool_endpoints": {
        "get_my_profile":  {"method": "GET",  "path": "/profile"},
        "get_my_context":  {"method": "GET",  "path": "/context"},
        "list_my_projects":{"method": "GET",  "path": "/projects"},
        "get_my_project":  {"method": "GET",  "path": "/projects/{project_id}"},
    },
}


@router.get(
    "/openai",
    summary="OpenAI-compatible tool definitions",
    description=(
        "Returns ContextOS tool definitions in OpenAI function-calling format. "
        "Compatible with GPT-4, GPT-4o, Gemini, Mistral, Groq, Cohere, LangChain, "
        "LlamaIndex, and any OpenAI-compatible SDK. Pass the `tools` array directly "
        "to your model's API call."
    ),
)
async def get_openai_tools():
    return {
        "tools": OPENAI_TOOLS,
        "integration": INTEGRATION_GUIDE,
        "note": (
            "Pass `tools` to your model's API call. "
            "When the model calls a tool, forward the call to the corresponding "
            "ContextOS endpoint using X-Api-Key authentication."
        ),
    }
