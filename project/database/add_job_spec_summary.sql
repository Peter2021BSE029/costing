-- Lets the printed quotation carry a short job specification summary
-- (page size, pages, paper stock, binding, finishing), similar to the
-- job info shown on the internal Cost Sheet. Auto-drafted from job data
-- and editable per quotation, same pattern as delivery/terms/special conditions.
-- Run this against an existing database that predates this feature.

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS job_spec_summary TEXT;
