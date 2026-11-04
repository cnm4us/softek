-- Additive screenshot metadata; image bytes live in private Softek storage.
-- Earlier app versions ignore these tables. MariaDB DDL commits implicitly.
-- If partially applied, inspect schema/ledger and restore the scoped backup
-- including the ledger per db/migrations/README.md; do not force a ledger entry.
CREATE TABLE screenshot_recordings (
 id CHAR(36) PRIMARY KEY,
 user_id CHAR(36) NOT NULL, run_id CHAR(36) NOT NULL,
 session_hash CHAR(64) NOT NULL, credential_hash CHAR(64) NOT NULL UNIQUE,
 request_id CHAR(36) NOT NULL, document_id CHAR(36) NOT NULL,
 approval_version VARCHAR(32) NOT NULL,
 state ENUM('active','uploading','stopped','interrupted','deleting') NOT NULL,
 started_at DATETIME(6) NOT NULL, heartbeat_at DATETIME(6) NOT NULL,
 credential_expires_at DATETIME(6) NOT NULL, retained_until DATETIME(6) NOT NULL,
 capture_stopped_at DATETIME(6) NULL, finalized_at DATETIME(6) NULL,
 stop_reason VARCHAR(64) NULL, stop_elapsed_ms INT UNSIGNED NULL,
 scheduled_slots SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 received_frames SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 stored_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 UNIQUE recording_request(user_id,request_id),
 INDEX recording_retention(retained_until),
 INDEX recording_liveness(state,heartbeat_at),
 INDEX recording_user(user_id,started_at),
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE,
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE screenshot_frames (
 recording_id CHAR(36) NOT NULL, sequence_number SMALLINT UNSIGNED NOT NULL,
 captured_at DATETIME(6) NOT NULL, received_at DATETIME(6) NOT NULL,
 elapsed_ms INT UNSIGNED NOT NULL, capture_ms INT UNSIGNED NOT NULL,
 width SMALLINT UNSIGNED NOT NULL, height SMALLINT UNSIGNED NOT NULL,
 byte_length INT UNSIGNED NOT NULL,
 request_hash CHAR(64) NOT NULL, image_hash CHAR(64) NOT NULL,
 clock_skew BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(recording_id,sequence_number),
 FOREIGN KEY(recording_id) REFERENCES screenshot_recordings(id) ON DELETE CASCADE,
 CHECK(sequence_number BETWEEN 1 AND 900),
 CHECK(elapsed_ms BETWEEN 900 AND 900999),
 CHECK(byte_length BETWEEN 1 AND 1048576)
) ENGINE=InnoDB;
