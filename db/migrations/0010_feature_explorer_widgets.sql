-- Additive, unseeded configuration. Retained customers/banners/history unchanged.
-- MariaDB DDL commits implicitly. Back up demo including its ledger beforehand.
-- On partial failure inspect actual schema/ledger and restore the scoped backup;
-- do not blindly retry or modify the recorded migration checksum.
CREATE TABLE feature_explorer_widgets (
 id CHAR(36) PRIMARY KEY,
 section_key ENUM('summary','account-checking','account-savings','account-credit') NOT NULL,
 feature_id VARCHAR(40) NOT NULL,
 asset_key VARCHAR(64) NULL,
 alt_text VARCHAR(180) NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 sort_order INT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL,
 updated_at DATETIME(6) NOT NULL,
 UNIQUE section_feature(section_key,feature_id),
 INDEX section_order(section_key,enabled,sort_order,id),
 FOREIGN KEY(asset_key) REFERENCES banner_assets(asset_key),
 CHECK (enabled=FALSE OR asset_key IS NOT NULL)
) ENGINE=InnoDB;
