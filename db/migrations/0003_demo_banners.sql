-- Additive banner/observation tables. Asset files are immutable and retained.
-- Recovery: restore the pre-upgrade backup including the ledger after inspecting
-- partial DDL; no implicit database or asset cleanup is performed.
CREATE TABLE banner_assets (
 asset_key VARCHAR(64) PRIMARY KEY, format VARCHAR(8) NOT NULL,
 width INT UNSIGNED NOT NULL, height INT UNSIGNED NOT NULL,
 byte_size INT UNSIGNED NOT NULL, created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE demo_banners (
 id VARCHAR(40) PRIMARY KEY, asset_key VARCHAR(64) NOT NULL,
 title VARCHAR(100) NOT NULL, alt_text VARCHAR(180) NOT NULL,
 destination VARCHAR(40) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE,
 sort_order INT NOT NULL DEFAULT 0, campaign_id VARCHAR(40) NULL,
 created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 INDEX enabled_order(enabled,sort_order,id),
 FOREIGN KEY(asset_key) REFERENCES banner_assets(asset_key),
 FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
) ENGINE=InnoDB;
CREATE TABLE banner_rotation (
 user_id CHAR(36) PRIMARY KEY, last_banner_id VARCHAR(40) NULL,
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE banner_presentations (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, run_id CHAR(36) NOT NULL,
 visit_id CHAR(36) NOT NULL, request_key VARCHAR(100) NOT NULL,
 banner_id VARCHAR(40) NULL, asset_key VARCHAR(64) NULL,
 title VARCHAR(100) NULL, alt_text VARCHAR(180) NULL, destination VARCHAR(40) NULL,
 campaign_id VARCHAR(40) NULL, reason ENUM('login','refresh','fallback') NOT NULL,
 created_at DATETIME(6) NOT NULL,
 UNIQUE selection_retry(user_id,run_id,request_key), INDEX user_selection(user_id,created_at),
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE,
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE,
 FOREIGN KEY(visit_id) REFERENCES visits(id),
 FOREIGN KEY(asset_key) REFERENCES banner_assets(asset_key)
) ENGINE=InnoDB;
CREATE TABLE interaction_events (
 id CHAR(36) PRIMARY KEY, run_id CHAR(36) NOT NULL, visit_id CHAR(36) NOT NULL,
 page_id CHAR(36) NOT NULL, selection_id CHAR(36) NULL,
 name ENUM('banner_visible','banner_clicked','page_view','menu_open','menu_selected','placeholder_action') NOT NULL,
 route_key VARCHAR(40) NOT NULL, target_key VARCHAR(40) NULL,
 dedupe_key VARCHAR(120) NOT NULL, observed_at DATETIME(6) NOT NULL,
 created_at DATETIME(6) NOT NULL, UNIQUE(run_id,dedupe_key),
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE,
 FOREIGN KEY(visit_id) REFERENCES visits(id),
 FOREIGN KEY(selection_id) REFERENCES banner_presentations(id) ON DELETE CASCADE
) ENGINE=InnoDB;
