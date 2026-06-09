-- Migrate Stripe columns to Yoco (run once on existing databases)
-- docker exec -i venuepos-mysql mysql -uroot -pvenuepos venuepos < database/migrate-yoco.sql

USE venuepos;

-- Companies: rename stripe keys to yoco keys
ALTER TABLE companies
  CHANGE COLUMN stripe_publishable_key yoco_public_key VARCHAR(255),
  CHANGE COLUMN stripe_secret_key yoco_secret_key VARCHAR(255),
  CHANGE COLUMN stripe_webhook_secret yoco_webhook_secret VARCHAR(255);

-- Orders: update payment_method enum
ALTER TABLE orders MODIFY payment_method ENUM('cash', 'card', 'mobile', 'split', 'tab', 'yoco') DEFAULT 'cash';
UPDATE orders SET payment_method = 'yoco' WHERE payment_method = 'stripe';

-- Payments: update method enum and rename charge columns
ALTER TABLE payments MODIFY method ENUM('cash', 'card', 'mobile', 'yoco', 'tab') NOT NULL;
UPDATE payments SET method = 'yoco' WHERE method = 'stripe';

ALTER TABLE payments
  CHANGE COLUMN stripe_payment_intent_id yoco_token VARCHAR(255),
  CHANGE COLUMN stripe_charge_id yoco_charge_id VARCHAR(255);
