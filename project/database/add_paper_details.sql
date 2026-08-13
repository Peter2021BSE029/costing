-- Adds job-wide paper wastage % (pads calculated sheet quantity, separate from
-- the general cost-based wastage_percent in job_additional_costs), plus
-- per-line stock sheet size and print sides so the paper-quantity calculation
-- inputs survive a save/reload cycle.
-- Run this against an existing database that predates this feature.

ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS paper_wastage_percent DECIMAL(5,2) DEFAULT 5;

ALTER TABLE job_materials ADD COLUMN IF NOT EXISTS stock_size VARCHAR(10);
ALTER TABLE job_materials ADD COLUMN IF NOT EXISTS print_sides VARCHAR(10);
