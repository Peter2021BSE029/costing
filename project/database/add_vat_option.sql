-- Let a job's price be entered either exclusive of VAT (18% added on top,
-- the historical default) or inclusive of VAT (the entered price already has
-- VAT baked in, so VAT is backed out of it instead of added again).
-- Run this against an existing database that predates this feature.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vat_option VARCHAR(10) NOT NULL DEFAULT 'exclusive';
