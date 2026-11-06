-- Additive durable replay queue; one row per recording, no historical backfill.
-- A single CREATE TABLE may commit implicitly. If ledger/application fails,
-- restore the scoped schema/ledger backup per README; never force the ledger.
CREATE TABLE screenshot_replay_jobs (
 recording_id CHAR(36) PRIMARY KEY,
 state ENUM('queued','rendering','ready','failed') NOT NULL DEFAULT 'queued',
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 queued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 started_at DATETIME(6) NULL,
 finished_at DATETIME(6) NULL,
 last_error VARCHAR(64) NULL,
 INDEX replay_job_schedule(state,available_at),
 FOREIGN KEY(recording_id) REFERENCES screenshot_recordings(id) ON DELETE CASCADE,
 CHECK(attempts <= 3)
) ENGINE=InnoDB;
