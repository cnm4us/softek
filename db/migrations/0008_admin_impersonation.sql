-- Additive session/provenance storage; existing visits remain customer activity.
-- Recovery: inspect partial DDL and restore the scoped pre-0008 data/ledger backup.
-- No existing table layout changes: retained positional writers remain compatible.
CREATE TABLE impersonation_sessions (
 token_hash CHAR(64) PRIMARY KEY, id CHAR(36) NOT NULL UNIQUE,
 admin_token_hash CHAR(64) NOT NULL, user_id CHAR(36) NOT NULL,
 request_id CHAR(36) NOT NULL, created_at DATETIME(6) NOT NULL,
 expires_at DATETIME(6) NOT NULL, ended_at DATETIME(6) NULL,
 UNIQUE admin_request(admin_token_hash,request_id),
 INDEX user_access(user_id,ended_at,expires_at),
 FOREIGN KEY(admin_token_hash) REFERENCES admin_sessions(token_hash) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE visit_contexts (
 visit_id CHAR(36) PRIMARY KEY,
 activity_source ENUM('customer','admin_impersonation') NOT NULL,
 session_context VARCHAR(80) NOT NULL DEFAULT '',
 INDEX source_visit(activity_source,visit_id),
 FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;
