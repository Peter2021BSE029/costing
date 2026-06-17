-- Migration to update job_additional_costs table for new fields
-- Run this after backing up your data

-- Rename columns from hours to pages when upgrading an older database
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_additional_costs' AND column_name = 'design_hours'
  ) THEN
    ALTER TABLE job_additional_costs RENAME COLUMN design_hours TO design_pages;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_additional_costs' AND column_name = 'typesetting_hours'
  ) THEN
    ALTER TABLE job_additional_costs RENAME COLUMN typesetting_hours TO typesetting_pages;
  END IF;
END $$;

-- Add new columns
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS wastage_percent DECIMAL(5,2) DEFAULT 5;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS wastage_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS subcontract_description TEXT;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS subcontract_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS ctp_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS commission_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS storage_percent DECIMAL(5,2) DEFAULT 5;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS transport_percent DECIMAL(5,2) DEFAULT 10;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS overhead_percent DECIMAL(5,2) DEFAULT 10;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS overhead_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE job_additional_costs ADD COLUMN IF NOT EXISTS special_processes_total DECIMAL(12,2) DEFAULT 0;

-- Bring older job cost component tables up to the current schema
ALTER TABLE job_machines ADD COLUMN IF NOT EXISTS setup_cost DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE job_machines ADD COLUMN IF NOT EXISTS cost_per_copy DECIMAL(10,2) DEFAULT 0;
ALTER TABLE job_machines ADD COLUMN IF NOT EXISTS setup_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE job_machines ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0;

ALTER TABLE job_bindings ADD COLUMN IF NOT EXISTS cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE job_bindings ADD COLUMN IF NOT EXISTS cost_per_copy DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE job_bindings ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0;
