-- Gelistra MySQL Schema
-- Run in MySQL Workbench on gelistraDB

-- 1. Users table (customer login/signup)
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  customer_id   VARCHAR(50) UNIQUE,
  name          TEXT,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Admins table (separate admin authentication)
CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Inquiries table (contact form submissions)
CREATE TABLE IF NOT EXISTS inquiries (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  type        VARCHAR(20)  DEFAULT 'inquiry',
  status      VARCHAR(30)  DEFAULT 'new',
  name        TEXT,
  email       TEXT,
  company     TEXT,
  website     TEXT,
  service     TEXT,
  budget      TEXT,
  timeline    TEXT,
  details     TEXT,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  final_quote TEXT,
  quote_response VARCHAR(20),
  quote_message TEXT,
  quote_response_at DATETIME,
  new_stage_at DATETIME,
  in_review_at DATETIME,
  proposal_sent_at DATETIME,
  closed_at DATETIME,
  customer_id TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Requirements table (detailed project form submissions)
CREATE TABLE IF NOT EXISTS requirements (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  type             VARCHAR(20)  DEFAULT 'requirements',
  status           VARCHAR(30)  DEFAULT 'new',
  name             TEXT,
  email            TEXT,
  phone            TEXT,
  company          TEXT,
  role             TEXT,
  decision_maker   TEXT,
  package          TEXT,
  industry         TEXT,
  audience         TEXT,
  goals            JSON,
  current_site     TEXT,
  page_count       TEXT,
  page_list        TEXT,
  content_status   TEXT,
  brand_assets     TEXT,
  references_text  TEXT,
  features         JSON,
  product_count    TEXT,
  payment_gateway  TEXT,
  integrations     TEXT,
  domain_hosting   TEXT,
  launch_date      DATE,
  budget           TEXT,
  support          TEXT,
  assets_link      TEXT,
  notes            TEXT,
  customer_id      TEXT,
  estimate_range   TEXT,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  final_quote      TEXT,
  quote_response   VARCHAR(20),
  quote_message    TEXT,
  quote_response_at DATETIME,
  new_stage_at     DATETIME,
  in_review_at     DATETIME,
  proposal_sent_at DATETIME,
  closed_at        DATETIME,
  work_status      VARCHAR(30),
  work_status_updated_at DATETIME,
  work_queued_at   DATETIME,
  work_ongoing_at  DATETIME,
  work_testing_at  DATETIME,
  work_revision_at DATETIME,
  work_completed_at DATETIME,
  work_on_hold_at  DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
