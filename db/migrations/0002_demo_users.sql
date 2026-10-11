-- Additive upgrade; preserve all anonymous runs and their history.
-- Recovery: restore the recorded pre-upgrade schema/data/ledger backup after
-- inspecting partial DDL. Applied migrations are immutable; use forward fixes.
CREATE TABLE demo_users (
 id CHAR(36) PRIMARY KEY, username VARCHAR(40) NOT NULL UNIQUE,
 display_name VARCHAR(100) NOT NULL, password_hash VARCHAR(255) NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT TRUE, profile_id VARCHAR(40) NOT NULL,
 variant ENUM('baseline','value') NOT NULL DEFAULT 'value', eligible BOOLEAN NOT NULL,
 actor ENUM('human','automation') NOT NULL DEFAULT 'human',
 created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 FOREIGN KEY(profile_id) REFERENCES customer_profiles(id)
) ENGINE=InnoDB;
ALTER TABLE participant_runs ADD COLUMN user_id CHAR(36) NULL,
 ADD INDEX user_history(user_id,created_at),
 ADD CONSTRAINT runs_user FOREIGN KEY(user_id) REFERENCES demo_users(id);
CREATE TABLE user_current_runs (
 user_id CHAR(36) PRIMARY KEY, run_id CHAR(36) NOT NULL UNIQUE,
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE,
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE user_sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL,
 created_at DATETIME(6) NOT NULL, expires_at DATETIME(6) NOT NULL,
 INDEX user_expiry(user_id,expires_at),
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
