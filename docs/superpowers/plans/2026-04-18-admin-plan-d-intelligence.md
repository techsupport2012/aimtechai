# Admin Panel Intelligence — Implementation Plan (Plan D of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the final three modules — visitor analytics (tracking script + dashboard), AI agent builder (Claude API integration), and upgrade the dashboard with real stats + recent activity.

**Architecture:** Visitor tracking via lightweight public script + API endpoint. Agent builder stores configs in DB, executes via Claude API SDK. Dashboard queries all tables for live stats.

**Tech Stack:** Express.js, SQLite, geoip-lite, @anthropic-ai/sdk (optional), adminLayout

**Depends on:** Plans A + B + C

---

### Task 1: Visitor Tracking

Create public tracking script + API + admin visitors page.

**Files to create:**
- `public/js/tracker.js` — tiny script (<1KB) injected on public pages. On load: POST /api/track { path, referrer }. On unload: sendBeacon /api/track/duration { path, duration_ms }.
- `admin/routes/admin-visitors.js` — Express router:
  - Public API: POST /api/track (rate limited 30/min/IP, hashes IP with SHA-256 + salt, geoip lookup, inserts visitor + page_view)
  - POST /api/track/duration (updates duration_ms on most recent page_view)
  - Admin page GET / — stat cards (live now, today, week, month), top pages table, top referrers table, recent visitors table
  - Admin API: GET /api/overview, GET /api/pages, GET /api/referrers, GET /api/recent

Install geoip-lite: `npm install geoip-lite`

Mount in server.js, remove 'visitors' from placeholders.

### Task 2: AI Agent Builder

Create `admin/routes/admin-agents.js`:
- GET / — agent list table (Name, Trigger type badge, Status toggle, Last Run, Runs Today). "New Agent" button.
- GET /new — agent config form: name, description, system prompt (monospace textarea), trigger type (manual/scheduled/on_event radio), trigger config, max tokens, active toggle. Save + Test Run buttons.
- GET /:id — edit agent form (same as new, pre-filled)
- GET /:id/runs — run history table
- POST /api — create agent
- PUT /api/:id — update agent
- DELETE /api/:id — delete agent
- POST /api/:id/run — execute agent: check for Claude API key in settings, decrypt it, call Claude API, log result to agent_runs, create notification. If no API key: return error "Add API key in Settings".

Install @anthropic-ai/sdk: `npm install @anthropic-ai/sdk`

Mount in server.js, remove 'agents' from placeholders.

### Task 3: Dashboard Upgrade

Update `admin/routes/dashboard.js` to show:
- Stat cards: contacts, published posts, upcoming bookings, active agents, visitors today
- Recent activity: last 10 notifications rendered as timeline
- Quick actions: New Post, Add Contact, Run Agent, View Site
