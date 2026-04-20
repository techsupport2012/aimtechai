-- =============================================================================
-- AIM Tech AI — MySQL Schema (port of db/schema.sql for SQLite)
-- Target: Hostinger MySQL (utf8mb4)
-- Run inside the database `u122216429_aimtechai`.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- USERS ----------
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'editor',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- SESSIONS ----------
CREATE TABLE IF NOT EXISTS sessions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_sessions_token (token),
  KEY idx_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- PAGES (CMS) ----------
CREATE TABLE IF NOT EXISTS pages (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(191) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  meta_description TEXT NULL,
  content_html LONGTEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pages_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- BLOG POSTS ----------
CREATE TABLE IF NOT EXISTS blog_posts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(191) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT NULL,
  content_html LONGTEXT NULL,
  category VARCHAR(64) NULL,
  tags VARCHAR(500) NULL,
  meta_description TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  author_id INT NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_blog_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_blog_posts_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- CRM CONTACTS ----------
CREATE TABLE IF NOT EXISTS contacts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  company VARCHAR(255) NULL,
  source VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_contacts_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- CRM PIPELINE ----------
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  position INT NOT NULL,
  color VARCHAR(16) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deals (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contact_id INT NULL,
  stage_id INT NULL,
  title VARCHAR(255) NOT NULL,
  value DECIMAL(12, 2) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_deals_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  CONSTRAINT fk_deals_stage FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- BOOKINGS ----------
CREATE TABLE IF NOT EXISTS bookings (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  time TIME NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  client_timezone VARCHAR(64) NULL,
  client_date VARCHAR(32) NULL,
  client_time VARCHAR(32) NULL,
  cancel_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bookings_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- AI AGENTS ----------
CREATE TABLE IF NOT EXISTS agents (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  system_prompt LONGTEXT NULL,
  provider VARCHAR(64) DEFAULT 'claude',
  model VARCHAR(128) DEFAULT 'claude-sonnet-4-20250514',
  trigger_type VARCHAR(64) NULL,
  trigger_config TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_agents_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_runs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  input LONGTEXT NULL,
  output LONGTEXT NULL,
  tokens_used INT NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  error TEXT NULL,
  CONSTRAINT fk_runs_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  KEY idx_agent_runs_agent_id (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ANALYTICS ----------
CREATE TABLE IF NOT EXISTS visitors (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ip_hash VARCHAR(128) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  device VARCHAR(64) NULL,
  browser VARCHAR(64) NULL,
  os VARCHAR(64) NULL,
  country VARCHAR(64) NULL,
  city VARCHAR(128) NULL,
  referrer VARCHAR(1024) NULL,
  landing_page VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_visitors_created_at (created_at),
  KEY idx_visitors_ip_hash (ip_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_views (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id INT NULL,
  path VARCHAR(512) NOT NULL,
  duration_ms INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_views_visitor FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE,
  KEY idx_page_views_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- NOTIFICATIONS ----------
CREATE TABLE IF NOT EXISTS notifications (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NULL,
  link VARCHAR(512) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_read_created (is_read, created_at),
  KEY idx_notifications_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- SETTINGS (key/value) ----------
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(128) NOT NULL PRIMARY KEY,
  value LONGTEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- KNOWLEDGE BASE (hero AI chat) ----------
CREATE TABLE IF NOT EXISTS kb_entries (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question VARCHAR(500) NOT NULL,
  answer TEXT NOT NULL,
  keywords VARCHAR(500) NULL,
  link VARCHAR(255) NULL,
  weight INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_kb_entries_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_queries (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  query VARCHAR(500) NOT NULL,
  matched_source VARCHAR(64) NULL,
  matched_id INT NULL,
  answer TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chat_queries_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- DONE. 16 tables created. Add seed data with INSERT statements as needed.
-- =============================================================================
