-- Plan 025. Add policy/events/context without adding columns to screenshot_frames:
-- legacy API releases use a positional frame INSERT and must remain compatible.
-- CONSTRAINT_2 is the elapsed check verified on both dedicated MariaDB schemas.
-- DDL can commit implicitly. If interrupted, restore the scoped schema/data/ledger
-- backup, inspect migration status and retry; never force a successful ledger row.
ALTER TABLE screenshot_recordings
 ADD COLUMN capture_policy ENUM('periodic-v1','changes-v2') NOT NULL DEFAULT 'periodic-v1',
 ADD COLUMN received_events INT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN event_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN expected_events INT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN lost_events INT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN coalesced_triggers INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE screenshot_frames
 DROP CONSTRAINT CONSTRAINT_2,
 ADD CONSTRAINT screenshot_elapsed_range CHECK(elapsed_ms BETWEEN 0 AND 900999);
CREATE TABLE screenshot_frame_context (
 recording_id CHAR(36) NOT NULL, sequence_number SMALLINT UNSIGNED NOT NULL,
 context_json JSON NOT NULL,
 PRIMARY KEY(recording_id,sequence_number),
 FOREIGN KEY(recording_id,sequence_number) REFERENCES screenshot_frames(recording_id,sequence_number) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE screenshot_events (
 recording_id CHAR(36) NOT NULL, sequence_number INT UNSIGNED NOT NULL,
 elapsed_ms INT UNSIGNED NOT NULL, event_kind VARCHAR(16) NOT NULL,
 payload_json JSON NOT NULL, request_hash CHAR(64) NOT NULL,
 batch_id CHAR(36) NOT NULL, received_at DATETIME(6) NOT NULL,
 PRIMARY KEY(recording_id,sequence_number),
 INDEX screenshot_event_time(recording_id,elapsed_ms,sequence_number),
 FOREIGN KEY(recording_id) REFERENCES screenshot_recordings(id) ON DELETE CASCADE,
 CHECK(sequence_number BETWEEN 1 AND 12000),
 CHECK(elapsed_ms BETWEEN 0 AND 901000)
) ENGINE=InnoDB;
