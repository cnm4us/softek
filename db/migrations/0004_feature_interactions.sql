-- Add engagement observations without changing existing ENUM value ordinals.
-- MariaDB ALTER commits implicitly. Before production application back up demo
-- and its migration ledger. On failure inspect the actual column definition and
-- ledger, then recover from that reviewed backup using db/migrations/README.md;
-- never remove ENUM values, downgrade retained events, or blindly retry failed DDL.
ALTER TABLE interaction_events MODIFY COLUMN name
 ENUM('banner_visible','banner_clicked','page_view','menu_open','menu_selected','placeholder_action','feature_viewed','feature_cta_clicked') NOT NULL;
