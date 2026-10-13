-- Additive Summary-only cursor. Configured artwork/widgets and all retained data
-- remain unchanged. Immutable banner_presentations hold selection snapshots.
-- Back up demo including the ledger before application. MariaDB DDL commits
-- implicitly; on partial failure inspect and restore the scoped backup, never
-- modify applied SQL or force the migration ledger.
CREATE TABLE summary_explorer_rotation (
 user_id CHAR(36) PRIMARY KEY,
 last_widget_id CHAR(36) NULL,
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
