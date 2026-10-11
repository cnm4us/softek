-- Additive initial schema. Recovery: restore the pre-migration schema backup
-- after inspecting a failed ledger entry; MariaDB DDL is not transactional.
CREATE TABLE institutions (
 id VARCHAR(40) PRIMARY KEY, name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE services (
 id VARCHAR(40) PRIMARY KEY, name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE institution_services (
 institution_id VARCHAR(40) NOT NULL, service_id VARCHAR(40) NOT NULL,
 purchased BOOLEAN NOT NULL DEFAULT FALSE, PRIMARY KEY(institution_id, service_id),
 FOREIGN KEY(institution_id) REFERENCES institutions(id), FOREIGN KEY(service_id) REFERENCES services(id)
) ENGINE=InnoDB;
CREATE TABLE customer_profiles (
 id VARCHAR(40) PRIMARY KEY, institution_id VARCHAR(40) NOT NULL,
 display_name VARCHAR(100) NOT NULL, first_name VARCHAR(40) NOT NULL, eligible BOOLEAN NOT NULL,
 FOREIGN KEY(institution_id) REFERENCES institutions(id)
) ENGINE=InnoDB;
CREATE TABLE account_templates (
 id VARCHAR(40) PRIMARY KEY, profile_id VARCHAR(40) NOT NULL,
 kind ENUM('checking','savings','credit') NOT NULL, name VARCHAR(80) NOT NULL,
 last_four CHAR(4) NOT NULL, balance_minor BIGINT NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'USD',
 FOREIGN KEY(profile_id) REFERENCES customer_profiles(id)
) ENGINE=InnoDB;
CREATE TABLE transaction_templates (
 id VARCHAR(40) PRIMARY KEY, account_template_id VARCHAR(40) NOT NULL,
 description VARCHAR(100) NOT NULL, amount_minor BIGINT NOT NULL, occurred_at DATETIME(6) NOT NULL,
 FOREIGN KEY(account_template_id) REFERENCES account_templates(id)
) ENGINE=InnoDB;
CREATE TABLE campaigns (
 id VARCHAR(40) PRIMARY KEY, institution_id VARCHAR(40) NOT NULL, service_id VARCHAR(40) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(institution_id,service_id) REFERENCES institution_services(institution_id,service_id)
) ENGINE=InnoDB;
CREATE TABLE participant_runs (
 id CHAR(36) PRIMARY KEY, token_hash CHAR(64) NOT NULL UNIQUE, profile_id VARCHAR(40) NOT NULL,
 campaign_id VARCHAR(40) NOT NULL, variant ENUM('baseline','value') NOT NULL,
 eligible BOOLEAN NOT NULL, actor ENUM('human','automation') NOT NULL,
 status ENUM('active','retired') NOT NULL DEFAULT 'active',
 created_at DATETIME(6) NOT NULL, expires_at DATETIME(6) NOT NULL, retired_at DATETIME(6) NULL,
 INDEX cohort(created_at,actor,variant), FOREIGN KEY(profile_id) REFERENCES customer_profiles(id),
 FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
) ENGINE=InnoDB;
CREATE TABLE visits (
 id CHAR(36) PRIMARY KEY, run_id CHAR(36) NOT NULL, browser_session CHAR(36) NOT NULL,
 created_at DATETIME(6) NOT NULL, last_seen_at DATETIME(6) NOT NULL,
 INDEX browser_visit(run_id,browser_session,last_seen_at), FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE accounts (
 id CHAR(36) PRIMARY KEY, run_id CHAR(36) NOT NULL,
 kind ENUM('checking','savings','credit') NOT NULL, name VARCHAR(80) NOT NULL,
 last_four CHAR(4) NOT NULL, balance_minor BIGINT NOT NULL, currency CHAR(3) NOT NULL,
 UNIQUE(run_id,kind), FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE transactions (
 id CHAR(36) PRIMARY KEY, run_id CHAR(36) NOT NULL, account_id CHAR(36) NOT NULL,
 description VARCHAR(100) NOT NULL, amount_minor BIGINT NOT NULL, occurred_at DATETIME(6) NOT NULL,
 INDEX recent_activity(run_id,occurred_at),
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE,
 FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE enrollments (
 run_id CHAR(36) NOT NULL, service_id VARCHAR(40) NOT NULL, enrolled_at DATETIME(6) NOT NULL,
 PRIMARY KEY(run_id,service_id), FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE,
 FOREIGN KEY(service_id) REFERENCES services(id)
) ENGINE=InnoDB;
CREATE TABLE savings_goals (
 id CHAR(36) PRIMARY KEY, run_id CHAR(36) NOT NULL, title VARCHAR(80) NOT NULL,
 target_minor BIGINT NOT NULL CHECK(target_minor > 0),
 current_minor BIGINT NOT NULL DEFAULT 0 CHECK(current_minor >= 0 AND current_minor <= target_minor),
 created_at DATETIME(6) NOT NULL, FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE request_receipts (
 run_id CHAR(36) NOT NULL, request_id CHAR(36) NOT NULL,
 operation VARCHAR(40) NOT NULL, payload_hash CHAR(64) NOT NULL, response_json JSON NOT NULL,
 created_at DATETIME(6) NOT NULL, PRIMARY KEY(run_id,request_id),
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE adoption_events (
 id CHAR(36) PRIMARY KEY, run_id CHAR(36) NOT NULL, visit_id CHAR(36) NOT NULL,
 name ENUM('eligible','promotion_visible','promotion_clicked','details_viewed','enrollment_started','enrollment_completed','first_use','repeat_use','service_use') NOT NULL,
 source ENUM('client_observed','server_confirmed') NOT NULL,
 placement ENUM('banner','sidebar','direct') NOT NULL,
 presentation ENUM('banner','sidebar','inline','direct') NOT NULL,
 dedupe_key VARCHAR(160) NOT NULL, observed_at DATETIME(6) NULL, created_at DATETIME(6) NOT NULL,
 UNIQUE(run_id,dedupe_key), INDEX event_cohort(run_id,created_at,name),
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE,
 FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE admin_sessions (
 token_hash CHAR(64) PRIMARY KEY, expires_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
