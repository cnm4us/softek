-- Additive diagnostics only; initially off. MariaDB DDL commits implicitly.
-- On partial failure inspect schema/ledger and restore the scoped pre-migration
-- backup per db/migrations/README.md. Earlier code ignores these tables.
CREATE TABLE clarity_tracing (
 id TINYINT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE,
 revision CHAR(36) NOT NULL, updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
INSERT INTO clarity_tracing VALUES (1,FALSE,UUID(),UTC_TIMESTAMP(6));
CREATE TABLE clarity_trace_contexts (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, run_id CHAR(36) NOT NULL,
 visit_id CHAR(36) NOT NULL, document_id CHAR(36) NOT NULL,
 session_hash CHAR(64) NOT NULL, collection_revision CHAR(36) NOT NULL,
 tracing_revision CHAR(36) NOT NULL, consent_at DATETIME(6) NOT NULL,
 expires_at DATETIME(6) NOT NULL, closed_at DATETIME(6) NULL,
 dropped_calls INT UNSIGNED NOT NULL DEFAULT 0,
 failed_batches INT UNSIGNED NOT NULL DEFAULT 0,
 UNIQUE trace_document(user_id,document_id,tracing_revision),
 INDEX trace_context_expiry(expires_at),
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE,
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE,
 FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE clarity_api_calls (
 id CHAR(36) PRIMARY KEY, context_id CHAR(36) NOT NULL,
 sequence_number INT UNSIGNED NOT NULL, command VARCHAR(16) NOT NULL,
 arguments_json LONGTEXT NOT NULL CHECK(JSON_VALID(arguments_json)),
 metadata_json LONGTEXT NOT NULL CHECK(JSON_VALID(metadata_json)),
 payload_hash CHAR(64) NOT NULL,
 observed_at DATETIME(6) NOT NULL, received_at DATETIME(6) NOT NULL,
 duration_us INT UNSIGNED NOT NULL,
 sdk_state ENUM('queued','loaded','absent') NOT NULL,
 outcome ENUM('returned','threw','absent') NOT NULL,
 trace_id CHAR(32) NOT NULL, span_id CHAR(16) NOT NULL,
 export_status ENUM('pending','exporting','acknowledged','failed') NOT NULL DEFAULT 'pending',
 attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 next_attempt_at DATETIME(6) NOT NULL, lease_until DATETIME(6) NULL,
 acknowledged_at DATETIME(6) NULL, error_code VARCHAR(32) NULL,
 UNIQUE trace_sequence(context_id,sequence_number),
 INDEX trace_export(export_status,next_attempt_at,lease_until),
 INDEX trace_received(received_at),
 FOREIGN KEY(context_id) REFERENCES clarity_trace_contexts(id) ON DELETE CASCADE
) ENGINE=InnoDB;
