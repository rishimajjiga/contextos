# ContextOS Browser Extension — Install Guide

## Load in Chrome (Developer Mode)

1. Open Chrome and go to: `chrome://extensions`
2. Toggle **Developer mode** ON (top-right corner)
3. Click **Load unpacked**
4. Select this folder: `contextos/extension/`
5. The ContextOS icon (🧠) appears in your toolbar

That's it — the extension is loaded.

---

## First-Time Setup

1. Click the **ContextOS icon** in your Chrome toolbar
2. Go to the **Settings** tab
3. Fill in:
   - **API URL**: your backend URL
     - Local: `http://localhost:8000`
     - Deployed: `https://contextos-backend-xxxx.run.app`
   - **API Key**: your `ctxos_...` key from the ContextOS web app
4. Click **Save Settings**
5. Click **Test Connection** — should show ✓ Connected

---

## Using the Extension

### On any AI site (Claude, ChatGPT, Gemini, etc.)
A small **ContextOS** panel appears in the bottom-right corner with two buttons:

- **💾 Save Chat** — saves the current conversation to your memory
- **⚡ Memory** — opens the memory sidebar to search and inject memories

### Memory Sidebar
- Search memories by keyword
- Click **⚡ Inject** to paste a memory into the chat input
- Click **📋 Copy** to copy to clipboard

### Auto-Inject
- In Settings, enable **Auto-inject on new chat**
- When you open a fresh chat, your 3 most recent memories are automatically prepended to the input

---

## Supported AI Platforms

| Platform | URL |
|---|---|
| Claude | claude.ai |
| ChatGPT | chatgpt.com |
| Gemini | gemini.google.com |
| Perplexity | perplexity.ai |
| Microsoft Copilot | copilot.microsoft.com |
| Mistral | chat.mistral.ai |
| Grok | grok.com |

---

## Package for Chrome Web Store (optional)

Run this in the `extension/` folder to create a zip for the store:

```bash
cd extension
powershell Compress-Archive -Path * -DestinationPath ../contextos-extension.zip
```

Then upload `contextos-extension.zip` at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Extension not appearing | Reload the page after loading the extension |
| "Could not find chat input" | Click inside the chat text box first, then inject |
| Connection error | Check API URL has no trailing `/`, API key is correct |
| Auto-inject not working | Enable it in Settings; it only fires on truly empty new chats |
