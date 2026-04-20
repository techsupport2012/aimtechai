# AIM Tech AI Admin Panel / CRM — Design Spec

**Date:** 2026-04-18
**Project:** AIM Tech AI website (`Y:\AimTechAI`)
**Scope:** MVP admin panel with CMS, CRM, Booking, AI Agents, Visitors, Notifications — all behind `/admin` route with role-based auth.

---

## 1. Goals

- Single admin panel at `/admin` to manage the entire AIM Tech AI platform
- Content management for 10 site pages + 30 blog posts (create/edit/publish)
- CRM with contacts, notes, and deal pipeline (kanban)
- Booking/scheduling admin view with calendar
- AI agent builder using Claude API (add key later)
- Lightweight visitor analytics (privacy-friendly, server-side)
- Real-time notifications for admin events
- Secure: bcrypt auth, session cookies, role-based access, encrypted API keys

## 2. Non-goals (MVP)

- Public-facing user accounts / client portal
- Email sending (notifications are admin-panel-only for MVP)
- File uploads / media library
- Multi-tenant / white-label
- Real-time WebSocket updates (polling is fine for MVP)

## 3. Tech Stack

- **Server:** Express.js (extend existing `server.js`)
- **Database:** SQLite via `better-sqlite3`
- **Auth:** bcrypt + crypto session tokens + httpOnly cookies
- **UI:** Server-rendered HTML + vanilla JS (no build step)
- **Theme:** AIM Tech AI brand (teal `#0FC1B7`, navy `#2A354B`, Outfit font)
- **AI:** Claude API via `@anthropic-ai/sdk` (optional, add key in settings)

## 4. Architecture

```
Y:\AimTechAI\
├── server.js              (extended: mount admin routes, auth, tracking API)
├── admin/
│   ├── middleware/
│   │   └── auth.js        (session check, role guard, CSRF)
│   ├── routes/
│   │   ├── auth.js        (login/logout/setup/users)
│   │   ├── cms.js         (pages + blogs CRUD)
│   │   ├── crm.js         (contacts, deals, pipeline)
│   │   ├── booking.js     (calendar, appointment management)
│   │   ├── agents.js      (agent CRUD, run, logs)
│   │   ├── visitors.js    (analytics queries)
│   │   ├── notifications.js (list, mark read)
│   │   └── settings.js    (API keys, users, site config)
│   ├── views/             (HTML templates)
│   │   ├── layout.html    (admin shell: sidebar + topbar)
│   │   ├── login.html
│   │   ├── setup.html     (first-run admin creation)
│   │   ├── dashboard.html
│   │   ├── cms-pages.html
│   │   ├── cms-blog.html
│   │   ├── crm-contacts.html
│   │   ├── crm-pipeline.html
│   │   ├── booking.html
│   │   ├── agents.html
│   │   ├── visitors.html
│   │   ├── notifications.html
│   │   └── settings.html
│   └── public/            (served at /admin/assets/)
│       ├── admin.css
│       └── admin.js
├── db/
│   ├── schema.sql
│   └── db.js              (connection + query helpers)
└── data/
    └── aimtechai.db        (SQLite file, gitignored)
```

## 5. Database Schema

```sql
-- Auth
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',  -- admin | editor | viewer
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL
);

-- CMS
CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  meta_description TEXT,
  content_html TEXT,
  status TEXT DEFAULT 'published',  -- published | draft
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT,
  category TEXT,
  tags TEXT,  -- comma-separated
  meta_description TEXT,
  status TEXT DEFAULT 'draft',  -- published | draft
  author_id INTEGER REFERENCES users(id),
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- CRM
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT DEFAULT 'manual',  -- manual | booking | website
  status TEXT DEFAULT 'new',     -- new | contacted | qualified | client
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT
);

CREATE TABLE deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER REFERENCES contacts(id),
  stage_id INTEGER REFERENCES pipeline_stages(id),
  title TEXT NOT NULL,
  value REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Booking
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',  -- pending | confirmed | cancelled
  client_timezone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Agents
CREATE TABLE agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  trigger_type TEXT DEFAULT 'manual',  -- manual | scheduled | on_event
  trigger_config TEXT,  -- cron expression or event name (JSON)
  is_active INTEGER DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  status TEXT DEFAULT 'running',  -- running | completed | failed
  input TEXT,
  output TEXT,
  tokens_used INTEGER DEFAULT 0,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT
);

-- Visitors
CREATE TABLE visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  referrer TEXT,
  landing_page TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id INTEGER REFERENCES visitors(id),
  path TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,  -- booking | contact | agent | visitor | system
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default pipeline stages
INSERT INTO pipeline_stages (name, position, color) VALUES
  ('Lead', 1, '#0FC1B7'),
  ('Qualified', 2, '#0DAFA6'),
  ('Proposal', 3, '#0A9B92'),
  ('Negotiation', 4, '#087D75'),
  ('Won', 5, '#28a745'),
  ('Lost', 6, '#dc3545');
```

## 6. Authentication & Security

- **Passwords:** bcrypt, cost factor 12
- **Sessions:** 64-byte `crypto.randomBytes` token, stored in `sessions` table, 24hr expiry
- **Cookie:** `httpOnly`, `secure` (production), `sameSite: strict`
- **Login rate limit:** 5 attempts / 15 min per IP, then lockout
- **First-run setup:** if `users` table is empty, `/admin` redirects to `/admin/setup` (one-time form)
- **Route protection:** all `/admin/*` through auth middleware; all `/api/admin/*` require session + role
- **Roles:** `admin` = full, `editor` = CMS + CRM + bookings, `viewer` = read-only
- **CSRF:** token stored in session, validated on all POST/PUT/DELETE
- **Visitor IPs:** SHA-256 + server salt, never stored raw
- **Claude API key:** AES-256 encrypted in settings table, decrypted only at runtime
- **SQL:** parameterized statements only, no string concatenation
- **Agent output:** text-only display, never eval'd or injected into DOM as raw HTML

## 7. Admin UI

### Sidebar
```
AIMTECHAI admin panel
─────────────────────
◉ Dashboard
👁 Visitors
🔔 Notifications (badge)
📄 Pages
✏️ Blog
👥 Contacts
💰 Pipeline
📅 Bookings
🤖 Agents
⚙️ Settings
─────────────────────
🔓 Logout
```

### Dashboard
- Stat cards: total contacts, new this week, upcoming bookings, published posts, active agents
- Quick actions: "New Post", "New Contact", "Run Agent"
- Recent activity feed (last 10 notifications)

### Theme
- Dark mode default: sidebar navy `#2A354B`, main area `#1a1f2e`
- Teal `#0FC1B7` for active states, buttons, accents
- White text, Outfit font
- Compact spacing, information-dense
- All modules: top bar (title + search + Add button), table view, slide-out detail panel, modals for forms

## 8. Module MVP Scope (Detailed)

### 8.1 Pages (CMS)

**List view:**
- Table columns: Title, Slug, Status (published/draft), Last Edited, Edited By
- Search bar filters by title or slug
- Status toggle: click to switch published ↔ draft inline

**Edit view (slide-out panel):**
- Fields: Title (text input), Slug (read-only for main pages), Meta Description (textarea, 160 char limit with counter), Content HTML (code editor with syntax highlighting using a lightweight lib like CodeJar), Status toggle
- "Preview" button opens the public page in a new tab
- "Save" button: validates fields → writes to DB → regenerates the static HTML file on disk using the site's existing template structure (nav + content + footer)
- "Revert" button: discards unsaved changes
- Last edited timestamp + username shown at bottom

**Constraints:**
- No create/delete for main pages (site structure stays fixed)
- Editing content replaces only the inner content area, preserving nav/footer/scripts
- Version history: not in MVP, but schema supports adding it later

**API endpoints:**
- `GET /api/admin/pages` — list all pages
- `GET /api/admin/pages/:id` — get single page with content
- `PUT /api/admin/pages/:id` — update page (title, meta, content, status)

---

### 8.2 Blog (CMS)

**List view:**
- Table columns: Title, Category, Status (published/draft), Published Date, Word Count, Author
- Filter dropdown: by category (All, AI & ML, Engineering, Cloud, Design, Company)
- Bulk actions: publish selected, unpublish selected, delete selected
- "New Post" button top-right

**Create/Edit form (full page, not slide-out — blog posts need more space):**
- Title (text input, large font preview)
- Slug (auto-generated from title, editable)
- Category (dropdown: AI & ML, Engineering, Cloud, Design, Company)
- Tags (comma-separated text input with tag pills UI)
- Excerpt (textarea, 200 char, used in blog listing cards)
- Content (markdown editor with live preview split-pane — use a simple textarea + marked.js for preview)
- Meta Description (textarea, 160 char with counter)
- Featured (checkbox — shows at top of blog listing)
- Status toggle: Draft / Published
- "Save Draft" and "Publish" as separate buttons
- "Preview" opens rendered HTML in new tab

**Publish flow:**
1. Admin writes content in markdown
2. Clicks "Publish"
3. Server converts markdown → HTML using the blog post template (glass container, nav, footer, JSON-LD schemas)
4. Writes HTML file to `public/blog/<slug>.html`
5. Regenerates `blog.html` listing page (re-reads all published posts from DB, rebuilds the card grid)
6. Creates notification: "✏️ Blog post published: <title>"

**Delete flow:**
- Soft delete: sets status to 'deleted', removes HTML file from disk, rebuilds listing
- Hard delete: available in settings for admin role only

**API endpoints:**
- `GET /api/admin/blog` — list all posts (with filters)
- `GET /api/admin/blog/:id` — get single post with content
- `POST /api/admin/blog` — create new post
- `PUT /api/admin/blog/:id` — update post
- `DELETE /api/admin/blog/:id` — soft delete post
- `POST /api/admin/blog/:id/publish` — publish (generates HTML)
- `POST /api/admin/blog/:id/unpublish` — unpublish (removes HTML)
- `POST /api/admin/blog/rebuild-listing` — regenerate blog.html

---

### 8.3 Contacts (CRM)

**List view:**
- Table columns: Name, Email, Phone, Company, Source (badge), Status (badge), Created
- Color-coded status badges: New (teal), Contacted (blue), Qualified (purple), Client (green)
- Source badges: Manual (gray), Booking (teal), Website (navy)
- Search: filters across name, email, company
- Filter dropdowns: by status, by source
- "Add Contact" button → modal form
- "Import CSV" button → file upload modal with column mapping preview

**Detail panel (slide-out):**
- Editable fields: name, email, phone, company, source, status
- Notes section: timestamped entries (newest first), "Add Note" textarea at top
- Linked deals: list of deals associated with this contact, "Create Deal" button
- Activity timeline: when contact was created, status changes, notes added, bookings made
- "Delete" button (admin only, with confirmation modal)

**Auto-creation:**
- When a booking is submitted via public form, server checks if contact with that email exists
  - If yes: links booking to existing contact, adds note "Booked appointment for <date>"
  - If no: creates new contact with source='booking', adds note

**CSV import:**
- Upload CSV → server parses → shows preview table with column mapping dropdowns (Name, Email, Phone, Company, Skip)
- "Import" button creates contacts in batch
- Shows result: X imported, Y skipped (duplicates by email), Z errors

**API endpoints:**
- `GET /api/admin/contacts` — list (with search, filter, pagination)
- `GET /api/admin/contacts/:id` — single contact with notes + deals
- `POST /api/admin/contacts` — create
- `PUT /api/admin/contacts/:id` — update
- `DELETE /api/admin/contacts/:id` — delete (admin only)
- `POST /api/admin/contacts/:id/notes` — add note
- `POST /api/admin/contacts/import` — CSV import

---

### 8.4 Pipeline (CRM)

**Kanban view (default):**
- 6 columns: Lead → Qualified → Proposal → Negotiation → Won → Lost
- Each column header: stage name + count + total value
- Cards: contact name, deal title, value ($X,XXX), days in stage
- Drag-and-drop cards between columns (vanilla JS drag API)
- Click card → deal detail modal

**Deal detail modal:**
- Fields: title, value (currency input), linked contact (dropdown search), stage (dropdown), notes
- Activity log: stage changes with timestamps
- "Save" and "Delete" buttons

**Table view (toggle):**
- Switch to table view with columns: Deal Title, Contact, Stage, Value, Created, Days in Stage
- Sortable by any column

**Create deal:**
- "New Deal" button → modal: title, contact (search dropdown), stage (default: Lead), value, notes
- Or from contact detail panel → "Create Deal" button (pre-fills contact)

**API endpoints:**
- `GET /api/admin/pipeline` — all deals grouped by stage
- `GET /api/admin/pipeline/:id` — single deal
- `POST /api/admin/pipeline` — create deal
- `PUT /api/admin/pipeline/:id` — update deal (including stage change)
- `DELETE /api/admin/pipeline/:id` — delete deal
- `PATCH /api/admin/pipeline/:id/stage` — move deal to different stage (drag-drop)
- `GET /api/admin/pipeline/stages` — list stages
- `PUT /api/admin/pipeline/stages` — reorder/rename stages (admin only)

---

### 8.5 Bookings

**Calendar view (default):**
- Week view: 7 columns (Mon-Sun), rows = time slots based on configured hours
- Month view: grid with booking count badges per day, click to expand
- Color coding: pending (yellow), confirmed (green), cancelled (red/strikethrough)
- Click slot → booking detail panel

**Booking detail panel:**
- Read-only: name, email, notes, client timezone, submitted date
- Actions: "Confirm" (sets status, creates notification), "Cancel" (sets status, creates notification), "Reschedule" (opens date/time picker)
- "Create Contact" button (if no linked contact exists for this email)
- "View Contact" link (if contact exists)

**Booking settings (sub-tab):**
- Available days: checkbox per weekday
- Available hours: start time + end time dropdowns
- Slot duration: 15/30/45/60 min dropdown
- Max bookings per slot: number input
- Days off: date picker to block specific dates
- Buffer time between slots: 0/5/10/15 min

**Migration:**
- On first run, reads `data/schedule.json` → inserts into `bookings` table → renames JSON file to `.migrated`
- Public API `/api/schedule/*` updated to use SQLite instead of JSON

**API endpoints:**
- `GET /api/admin/bookings` — list (with date range filter)
- `GET /api/admin/bookings/:id` — single booking
- `PATCH /api/admin/bookings/:id/status` — confirm/cancel
- `PATCH /api/admin/bookings/:id/reschedule` — update date/time
- `GET /api/admin/bookings/settings` — get booking config
- `PUT /api/admin/bookings/settings` — update booking config
- Public: `GET /api/schedule/availability` and `POST /api/schedule/book` remain (migrated to SQLite)

---

### 8.6 Agents

**Agent list view:**
- Table: Name, Description, Trigger (badge), Status (active/paused toggle), Last Run, Runs Today
- "New Agent" button → full config form
- Click row → agent detail/edit page

**Agent config form:**
- Name (text input)
- Description (textarea, what this agent does in plain English)
- System Prompt (large textarea with monospace font, placeholder with example prompt)
- User Prompt Template (textarea — the input sent each run; can include variables like `{{date}}`, `{{new_contacts}}`, `{{recent_bookings}}`)
- Trigger Type (radio buttons):
  - **Manual** — run only when admin clicks "Run Now"
  - **Scheduled** — cron expression input with human-readable preview ("Every day at 9am")
  - **On Event** — dropdown: "New Booking", "New Contact", "Daily Summary"
- Max Tokens (number input, default 4096)
- Active toggle
- "Save" and "Test Run" buttons

**Test Run flow:**
1. Admin clicks "Test Run"
2. Server checks for Claude API key in settings → if missing, shows "Add API key in Settings"
3. Sends system prompt + user prompt to Claude API
4. Shows response in a result panel below the form (with token count + latency)
5. Logs to `agent_runs` table

**Run history (sub-tab on agent detail):**
- Table: Run ID, Status (badge: running/completed/failed), Started, Duration, Tokens Used
- Click row → expandable: full input sent, full output received, error message if failed
- "Clear History" button (admin only)

**Scheduled agent execution:**
- Server runs a `setInterval` every 60 seconds
- Checks `agents` table for active agents with `trigger_type='scheduled'`
- Parses cron expression from `trigger_config`, checks if current time matches
- If match: runs the agent (calls Claude API), logs result
- Errors create a notification

**On-event execution:**
- When booking API receives a new booking → checks for agents with `trigger_type='on_event'` and `trigger_config` containing `'new_booking'`
- Injects booking data into the user prompt template variables
- Runs agent, logs result

**Variable substitution in user prompts:**
- `{{date}}` — current date
- `{{time}}` — current time
- `{{new_contacts}}` — contacts added today (JSON)
- `{{recent_bookings}}` — bookings for next 7 days (JSON)
- `{{site_stats}}` — visitor count today, total contacts, etc.
- Custom variables can be added in settings later

**API endpoints:**
- `GET /api/admin/agents` — list all agents
- `GET /api/admin/agents/:id` — single agent with config
- `POST /api/admin/agents` — create agent
- `PUT /api/admin/agents/:id` — update agent
- `DELETE /api/admin/agents/:id` — delete agent
- `POST /api/admin/agents/:id/run` — trigger manual run
- `GET /api/admin/agents/:id/runs` — run history
- `DELETE /api/admin/agents/:id/runs` — clear history

---

### 8.7 Visitors

**Overview (top section):**
- Stat cards: Live Now (last 5 min), Today, This Week, This Month, Total
- Line chart: page views over last 30 days (vanilla JS canvas or simple SVG)
- Bar chart: unique visitors per day over last 14 days

**Top Pages table:**
- Columns: Page Path, Views (today), Views (total), Avg Duration
- Sorted by views descending
- Click row → page detail with daily breakdown

**Top Referrers table:**
- Columns: Referrer Domain, Visits (today), Visits (total)
- Common: google.com, direct, linkedin.com, twitter.com, etc.

**Recent Visitors table:**
- Columns: Visitor (hashed ID, first 8 chars), Country/City, Landing Page, Pages Viewed, Time on Site, Referrer, When
- Click row → full session detail: ordered list of pages visited with timestamps

**Date range filter:**
- Preset buttons: Today, Last 7 Days, Last 30 Days, Custom
- Custom: date picker for start + end date

**Tracking implementation:**
- `tracker.js` (~15 lines) injected via `<script>` on all public pages
- On page load: `POST /api/track` with `{ path, referrer, screenWidth }`
- On `beforeunload`: `navigator.sendBeacon('/api/track/duration', { path, duration_ms })`
- Server: hashes IP with SHA-256 + server-side salt, geoip lookup via `geoip-lite`, writes to SQLite
- No cookies, no localStorage, no fingerprinting — GDPR-friendly

**API endpoints:**
- `POST /api/track` — public, logs page view (rate limited: 30/min per IP)
- `POST /api/track/duration` — public, updates duration
- `GET /api/admin/visitors/overview` — stat cards + chart data
- `GET /api/admin/visitors/pages` — top pages
- `GET /api/admin/visitors/referrers` — top referrers
- `GET /api/admin/visitors/recent` — recent visitors list
- `GET /api/admin/visitors/:id` — single visitor session detail

---

### 8.8 Notifications

**Topbar bell icon:**
- Badge shows unread count (red circle with number)
- Click opens dropdown panel (max 10 recent)
- Each item: type icon + title + "2 min ago" / "1 hour ago" relative time
- Click item → navigates to the relevant admin page (e.g., click booking notification → bookings page with that booking selected)
- "Mark all read" link at bottom
- "View all" link → full notifications page

**Full notifications page:**
- Table: Type (icon+badge), Title, Message, Time, Read/Unread
- Filter by type: All, Bookings, Contacts, Agents, Visitors, System
- Bulk actions: mark selected as read, delete selected
- Auto-delete notifications older than 30 days (cleanup on server startup)

**Events that create notifications:**
- `booking`: new booking → "📅 New booking: {name}, {date} at {time}"
- `booking`: booking cancelled → "❌ Booking cancelled: {name}, {date}"
- `contact`: new contact (from booking or manual) → "👥 New contact: {name} ({email})"
- `agent`: run completed → "🤖 Agent '{name}' completed — {tokens} tokens used"
- `agent`: run failed → "⚠️ Agent '{name}' failed: {error_summary}"
- `visitor`: daily milestone (100, 500, 1000) → "👁 {count} visitors today!"
- `system`: first-run setup complete → "✅ Admin panel setup complete"
- `system`: API key added/changed → "🔑 Claude API key updated"

**Polling:**
- Admin JS polls `GET /api/admin/notifications?unread=true` every 30 seconds
- Response: `{ unreadCount: N, recent: [...] }`
- Updates badge + dropdown without full page reload

**API endpoints:**
- `GET /api/admin/notifications` — list (with type filter, pagination)
- `GET /api/admin/notifications?unread=true` — unread only with count
- `PATCH /api/admin/notifications/:id/read` — mark single as read
- `POST /api/admin/notifications/read-all` — mark all as read
- `DELETE /api/admin/notifications/:id` — delete single

---

### 8.9 Settings

**Users tab:**
- Table: Username, Email, Role (badge), Last Login, Created
- "Add User" button → modal: username, email, password, role dropdown
- Click row → edit modal: change role, reset password, delete (can't delete self)
- Minimum: 1 admin must always exist (prevent lockout)

**API Keys tab:**
- Claude API Key: password-style input (masked with dots), "Show" toggle, "Save" button
- Key is encrypted with AES-256 before storing in `settings` table
- Decrypted only in memory when agent runner needs it
- "Test Connection" button: sends a tiny prompt to Claude, shows "Connected" or error
- Future-ready: slots for other API keys (OpenAI, SendGrid, etc.) — empty for MVP

**Site Config tab:**
- Company Name (text)
- Phone (text)
- Address (textarea)
- Timezone (dropdown of common timezones, used for booking display + agent scheduling)
- Logo URL (text — not a file upload for MVP)

**Booking Config tab:**
- Available Days: checkbox per weekday (Mon-Sun)
- Available Hours: start time dropdown + end time dropdown (e.g., 9:00 AM - 5:00 PM)
- Slot Duration: dropdown (15 / 30 / 45 / 60 min)
- Max Per Slot: number input (default 1)
- Buffer Between Slots: dropdown (0 / 5 / 10 / 15 min)
- Days Off: date picker, list of blocked dates with "Remove" button

**Agent Limits tab:**
- Max Tokens Per Run: number (default 4096)
- Max Runs Per Hour: number (default 10)
- Max Runs Per Day: number (default 100)
- Enable Scheduled Agents: toggle (master switch)

**Danger Zone (admin only):**
- "Export All Data" → downloads full SQLite DB as file
- "Reset Database" → confirmation modal with "type RESET to confirm" → drops and recreates all tables
- "Clear All Visitors" → purges visitor + page_view tables

**API endpoints:**
- `GET /api/admin/settings` — all settings (API keys masked)
- `PUT /api/admin/settings` — update settings
- `GET /api/admin/users` — list users
- `POST /api/admin/users` — create user
- `PUT /api/admin/users/:id` — update user
- `DELETE /api/admin/users/:id` — delete user (admin only, can't self-delete)
- `POST /api/admin/settings/test-claude` — test Claude API connection
- `POST /api/admin/settings/export` — download DB
- `POST /api/admin/settings/reset` — reset database (admin only)

## 9. Tracking Script (`tracker.js`)

Injected on all public pages via a `<script>` tag. Minimal, privacy-friendly:

```js
// ~15 lines, <1KB minified
// On page load: POST /api/track { path, referrer, timestamp }
// On page unload: POST /api/track/duration { path, duration_ms }
// No cookies, no fingerprinting, no PII
```

Server-side: hashes IP with salt, does geoip lookup (free `geoip-lite` npm), writes to SQLite.

## 10. Dependencies to Add

```json
{
  "better-sqlite3": "^11.0.0",
  "bcrypt": "^5.1.0",
  "geoip-lite": "^1.4.0",
  "@anthropic-ai/sdk": "^0.30.0"
}
```

All are well-maintained, production-ready packages. `@anthropic-ai/sdk` is optional until API key is added.

## 11. Migration Plan

- Existing `data/schedule.json` bookings migrated to SQLite `bookings` table on first run
- Existing 51 HTML pages scanned and registered in `pages` / `blog_posts` tables on first run
- Public booking API (`/api/schedule/*`) migrated to read/write from SQLite instead of JSON
- No breaking changes to public-facing site
