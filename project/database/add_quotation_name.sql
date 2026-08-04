-- Add an optional descriptive name to quotations, so a multi-item quotation
-- can be labeled with what it's for instead of only showing "Quotation #N".
-- Run this against an existing database that predates this feature.

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS name VARCHAR(150);
