-- Persistent site-wide collection switch. Defaults off; deployment readiness and
-- each customer's explicit consent are still required. Revision invalidates old
-- browser opt-ins whenever the switch changes. No participant data is altered.
-- MariaDB CREATE commits implicitly: back up demo including the ledger before
-- production application. On failure inspect table/ledger and recover from that
-- backup per README.md; never blindly retry a failed migration.
CREATE TABLE clarity_collection (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 revision CHAR(36) NOT NULL,
 updated_at DATETIME(6) NOT NULL,
 CHECK (id = 1)
) ENGINE=InnoDB;
INSERT INTO clarity_collection VALUES (1,FALSE,UUID(),UTC_TIMESTAMP(6));
