-- Additive contextual-discovery state; existing table layouts remain unchanged.
-- MariaDB DDL commits implicitly. Back up demo and its ledger before production.
-- Partial failure: inspect actual tables/ledger, then recover the reviewed schema
-- from the scoped backup; never blindly retry or modify applied SQL.
CREATE TABLE discovery_preferences (
 user_id CHAR(36) PRIMARY KEY,
 opt_out BOOLEAN NOT NULL DEFAULT FALSE,
 fewer_suggestions BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at DATETIME(6) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE discovery_presentations (
 id CHAR(36) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 run_id CHAR(36) NOT NULL,
 visit_id CHAR(36) NOT NULL UNIQUE,
 feature_id VARCHAR(40) NOT NULL,
 placement VARCHAR(40) NOT NULL,
 selection_reason VARCHAR(40) NOT NULL,
 policy_version VARCHAR(40) NOT NULL,
 created_at DATETIME(6) NOT NULL,
 impressed_at DATETIME(6) NULL,
 dismissed_at DATETIME(6) NULL,
 clicked_at DATETIME(6) NULL,
 INDEX customer_feature_history(user_id,feature_id,created_at),
 FOREIGN KEY(user_id) REFERENCES demo_users(id) ON DELETE CASCADE,
 FOREIGN KEY(run_id) REFERENCES participant_runs(id) ON DELETE CASCADE,
 FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE discovery_feature_observations (
 interaction_id CHAR(36) PRIMARY KEY,
 presentation_id CHAR(36) NOT NULL,
 FOREIGN KEY(interaction_id) REFERENCES interaction_events(id) ON DELETE CASCADE,
 FOREIGN KEY(presentation_id) REFERENCES discovery_presentations(id) ON DELETE CASCADE
) ENGINE=InnoDB;
