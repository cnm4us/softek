-- Additive preferences; existing users without rows default to Desktop/Chrome.
-- MariaDB DDL commits implicitly. Back up demo/schema/ledger before application.
-- On partial failure inspect this table and ledger, then restore the reviewed
-- scoped backup per README.md; do not blindly retry or modify applied SQL.
CREATE TABLE customer_browser_profiles (
 user_id CHAR(36) NOT NULL PRIMARY KEY,
 device ENUM('desktop','android','iphone','ipad') NOT NULL,
 browser ENUM('chrome','edge','firefox','safari') NOT NULL,
 FOREIGN KEY (user_id) REFERENCES demo_users(id) ON DELETE CASCADE,
 CHECK ((device='desktop') OR (device='android' AND browser='chrome')
   OR (device IN ('iphone','ipad') AND browser='safari'))
) ENGINE=InnoDB;
