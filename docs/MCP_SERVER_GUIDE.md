# WP-Automation MCP Server — Implementation & Hosting Guide

## 1. Overview

The **WP-Automation MCP Server** (`mcp-server/`) is a lightweight Model Context Protocol (MCP) bridge that allows AI assistants (such as **Claude Desktop**) to interact directly with the **WP-AUTOMATION-BACKEND** NestJS API.

Instead of manually copying articles from AI chats into the dashboard or WordPress, the AI assistant can list your connected WordPress sites, inspect post types, process raw articles (AI structuring + Envato image discovery), and publish/unpublish/delete posts directly from chat.

```text
AI Client (Claude Desktop)
   │  stdio (JSON-RPC)
   ▼
mcp-server/dist/index.js
   │  HTTP + Bearer JWT (BackendClient)
   ▼
WP-AUTOMATION-BACKEND (NestJS @ http://localhost:3000/api/v1)
   ├── OpenAI (Article structuring & SEO metadata)
   ├── Envato Elements API (Image discovery)
   ├── PostgreSQL / Supabase (ContentSnapshot drafts)
   └── WordPress REST API (Publish / Update / Trash / Delete)
```

---

## 2. What Was Built (`mcp-server/`)

### Project Structure

```text
mcp-server/
├── src/
│   ├── index.ts                  # MCP server entry point (StdioServerTransport)
│   ├── client.ts                 # HTTP fetch wrapper + JWT auth + NestJS envelope unwrapper
│   └── tools/
│       ├── list-websites.ts      # Tool: list_my_websites
│       ├── get-content-types.ts  # Tool: get_content_types
│       ├── list-articles.ts      # Tool: list_articles
│       ├── send-article.ts       # Tool: send_article_to_backend
│       └── publish-article.ts    # Tool: publish_article
├── dist/                         # Compiled JavaScript output (built via `npx tsc`)
├── package.json                  # Uses @modelcontextprotocol/sdk
├── tsconfig.json
├── claude_desktop_config.example.json
└── README.md
```

### Implemented MCP Tools (5 Tools)

| Tool Name | Backend Endpoint | Purpose |
| :--- | :--- | :--- |
| `list_my_websites` | `GET /websites` | Lists all registered WordPress sites and their UUIDs |
| `get_content_types` | `GET /websites/:websiteId/content-types` | Lists available post types (`post`, `tour-package`, `destination`, etc.) |
| `list_articles` | `GET /websites/:websiteId/articles?page=&limit=` | Paginated list of drafts and published articles |
| `send_article_to_backend` | `POST /websites/:websiteId/articles/process` (+ optional `publish`) | Sends raw text to AI pipeline + Envato image search, saves draft, and optionally auto-publishes |
| `publish_article` | `POST /websites/:websiteId/articles/:id/publish` or `DELETE ...` | Supports `publish`, `unpublish` (revert to `draft`), `delete` (trash), and `delete_permanent` (`?force=true`) |

### Key Implementation Details

- **NestJS Response Envelope Unwrapping (`src/client.ts`):**
  The NestJS backend wraps all responses via `TransformInterceptor` in `{ statusCode, success, message, data, meta }`. `BackendClient.request()` automatically detects and unwraps this outer envelope so every tool receives the inner payload cleanly.
- **Error Handling (`src/index.ts`):**
  HTTP errors (including `401 Unauthorized` when a JWT expires) are caught and returned cleanly to the AI client with a reminder to refresh `WP_BACKEND_TOKEN`.
- **Verification:**
  - `npx tsc --noEmit` and `npx tsc` compile with 0 errors.
  - Verified live with Claude Desktop (`list_my_websites` successfully returned registered websites).

---

## 3. Current Local Setup (Development / Testing)

1. **Build the MCP server:**
   ```bash
   cd mcp-server
   npm install
   npm run build
   ```
2. **Start the NestJS backend:** `http://localhost:3000/api/v1`
3. **Obtain a JWT access token:** `POST /api/v1/auth/login`
4. **Configure Claude Desktop (`claude_desktop_config.json`):**
   - **Standard Windows path:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Microsoft Store (MSIX) Windows path:** `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`
   - Merge `"mcpServers"` into the single root JSON object (do not create two separate `{}` blocks) and paste the full 3-part JWT into `WP_BACKEND_TOKEN`.
5. **Fully quit** Claude Desktop from the Windows system tray and reopen it.

---

## 4. Platform Compatibility Matrix

| Platform | Current Local (`stdio`) | When Hosted (HTTPS) | Notes |
| :--- | :---: | :---: | :--- |
| **Claude Desktop** | ✅ Works now | ✅ Works (1-click Connector) | Supports both local `stdio` and Remote HTTP/SSE MCP |
| **Claude Web** (`claude.ai`) | ❌ | ✅ Works (Remote MCP) | Requires public HTTPS + HTTP/SSE transport |
| **ChatGPT Web** (`chatgpt.com`) | ❌ | ✅ Works | Via **Custom GPT Actions** (OpenAPI JSON) or ChatGPT MCP Connectors |
| **Gemini CLI / Antigravity** | ✅ | ✅ | Native MCP support |
| **Gemini Web** (`gemini.google.com`) | ❌ | ❌ | Consumer Gemini Web does not support custom third-party MCP/OpenAPI connectors |

---

## 5. What To Do When Hosting (Production SaaS Roadmap)

Right now, `stdio` + manual `claude_desktop_config.json` + copying a 7-day JWT works for local developer testing, **not** for end-users. When deploying to production, complete these steps:

### Step 1: Switch MCP Transport from `stdio` to Streamable HTTP / SSE
- Host the MCP endpoint directly on your NestJS backend (or as an HTTP service behind the same domain), e.g. `https://api.yourdomain.com/mcp`.
- Replace `StdioServerTransport` with MCP's **Streamable HTTP / SSE transport** so cloud clients (Claude Web, Claude Desktop Connectors) can connect over HTTPS without running Node.js on the user's machine.

### Step 2: Serve Over Public HTTPS
- Deploy behind a reverse proxy / platform with valid SSL (Nginx, Cloudflare, Railway, Render, etc.).
- Claude Web, Claude Desktop Remote Connectors, and ChatGPT Actions all reject plain `http://` and `localhost` URLs.

### Step 3: Replace Manual JWT Copy-Paste with OAuth 2.0 (Recommended) or API Keys
- **Option A — OAuth 2.0 (Best UX):**
  Users paste `https://api.yourdomain.com/mcp` into Claude → a browser popup opens your normal WP-Automation login page → user logs in and clicks **Authorize** → OAuth handles access + refresh tokens automatically. Zero config files, zero expired-token headaches.
- **Option B — Long-Lived Personal API Keys (Simpler Phase 1):**
  Add an **Integrations / API Keys** page in your frontend dashboard where users generate a `wpa_live_...` token (stored hashed in PostgreSQL). Users paste that key once instead of a short-lived login JWT.
  *(Optional for Desktop-only beta: package `mcp-server` as a `.mcpb` Desktop Extension so users double-click to install and enter their key in a UI form.)*

### Step 4: Configure Timeouts for AI Processing
- `POST /websites/:websiteId/articles/process` takes ~16–22 seconds (OpenAI + Envato).
- **Short-term:** Ensure reverse proxy / CDN timeouts (Nginx `proxy_read_timeout`, Cloudflare, etc.) are set to **120s+** so requests don't drop mid-flight.
- **Long-term:** Move article processing to an async job queue (e.g., **BullMQ + Redis**), return `202 Accepted` immediately with a `jobId`, and let the MCP tool / frontend poll for completion.

### Step 5: Support ChatGPT & Gemini Users
- **ChatGPT Web:** Expose your NestJS Swagger/OpenAPI spec (`/api/v1/docs-json`) over HTTPS and import it into a **Custom GPT Action** with OAuth or Bearer API Key auth.
- **Gemini Users:** Since consumer `gemini.google.com` blocks third-party connectors, add a **"Write with Gemini"** chat panel inside your own WP-Automation web dashboard using the **Gemini API + Function Calling** (using the same 5 backend operations).
