-- Add support for fixed-price jobs (quotation line items with a preset price,
-- skipping the full materials/machines/binding cost breakdown).
-- Run this against an existing database that predates this feature.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) NOT NULL DEFAULT 'calculated';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fixed_price DECIMAL(14,2);
