-- Let the Delivery / Terms / Special conditions lines on the printed
-- quotation be filled in per-quotation instead of always being blank.
-- Run this against an existing database that predates this feature.

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_text VARCHAR(300);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms_text VARCHAR(300);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS special_conditions_text VARCHAR(300);
