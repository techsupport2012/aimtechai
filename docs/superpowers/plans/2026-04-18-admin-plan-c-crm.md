# Admin Panel CRM + Bookings — Implementation Plan (Plan C of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CRM module (contacts + pipeline kanban) and booking calendar admin inside the existing admin panel.

**Architecture:** Three new route files for contacts CRUD, pipeline kanban with drag-drop, and booking calendar with confirm/cancel actions. All use adminLayout from Plan A and SQLite via db.js.

**Tech Stack:** Express.js routes, SQLite, adminLayout, vanilla JS drag-and-drop

**Depends on:** Plan A (foundation) + Plan B (CMS)

---

### Task 1: Contacts CRM

Create `admin/routes/crm-contacts.js` with:
- GET / — contacts list table (Name, Email, Company, Source badge, Status badge, Created). Search bar. "Add Contact" button opens modal. Click row → detail page.
- GET /:id — contact detail: edit fields + timestamped notes section + linked deals list
- POST /api — create contact
- PUT /api/:id — update contact
- DELETE /api/:id — delete (admin only)
- POST /api/:id/notes — add timestamped note (prepend to existing notes as JSON array)

Mount in server.js, remove 'contacts' from placeholders.

### Task 2: Pipeline Kanban

Create `admin/routes/crm-pipeline.js` with:
- GET / — kanban board: 6 columns (from pipeline_stages), cards = deals. Drag-and-drop via HTML5 drag API. "New Deal" button. Click card → modal.
- POST /api — create deal (title, contact_id, stage_id, value, notes)
- PUT /api/:id — update deal
- PATCH /api/:id/stage — move deal to new stage (for drag-drop)
- DELETE /api/:id — delete deal

Mount in server.js, remove 'pipeline' from placeholders.

### Task 3: Booking Calendar

Create `admin/routes/admin-booking.js` with:
- GET / — calendar view (week view: table grid of time slots × 7 days). Color-coded: pending=yellow, confirmed=green, cancelled=red. Click booking → detail panel.
- PATCH /api/:id/status — confirm or cancel booking
- GET /api/settings — booking config (available days/hours/duration)
- PUT /api/settings — update booking config

Mount in server.js, remove 'bookings' from placeholders.
