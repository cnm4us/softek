-- Additive batch metadata and per-customer opening amounts; existing users and
-- templates are untouched. MariaDB CREATE may commit implicitly. Back up demo
-- schema/data/ledger before application. On partial failure inspect both tables
-- and ledger, then restore the reviewed backup; never blindly retry failed DDL.
CREATE TABLE customer_generation_batches (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 request_id CHAR(36) NOT NULL UNIQUE,
 request_fingerprint CHAR(64) NOT NULL,
 customer_count SMALLINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL,
 CHECK (customer_count BETWEEN 1 AND 200)
) ENGINE=InnoDB;
CREATE TABLE customer_starting_balances (
 user_id CHAR(36) NOT NULL PRIMARY KEY,
 batch_id INT UNSIGNED NOT NULL,
 position SMALLINT UNSIGNED NOT NULL,
 checking_minor BIGINT UNSIGNED NOT NULL,
 savings_minor BIGINT UNSIGNED NOT NULL,
 UNIQUE (batch_id,position),
 FOREIGN KEY (user_id) REFERENCES demo_users(id) ON DELETE CASCADE,
 FOREIGN KEY (batch_id) REFERENCES customer_generation_batches(id),
 CHECK (position BETWEEN 1 AND 200),
 CHECK (checking_minor <= 100000000),
 CHECK (savings_minor <= 100000000)
) ENGINE=InnoDB;
