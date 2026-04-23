-- Migration to update job_additional_costs table for new fields
-- Run this after backing up your data

-- Rename columns from hours to pages
ALTER TABLE job_additional_costs RENAME COLUMN design_hours TO design_pages;
ALTER TABLE job_additional_costs RENAME COLUMN typesetting_hours TO typesetting_pages;

-- Add new columns
ALTER TABLE job_additional_costs ADD COLUMN wastage_percent DECIMAL(5,2) DEFAULT 5;
ALTER TABLE job_additional_costs ADD COLUMN wastage_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE job_additional_costs ADD COLUMN subcontract_description TEXT;
ALTER TABLE job_additional_costs ADD COLUMN subcontract_cost DECIMAL(12,2) DEFAULT 0;