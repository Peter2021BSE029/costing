-- schema.sql
-- Costing System Database for Uganda Printing and Publishing Corporation
-- Run this in PostgreSQL to set up the database

CREATE DATABASE costing_db;

\c costing_db;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Margin tiers table
CREATE TABLE margin_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(50) UNIQUE NOT NULL,
  margin_percentage DECIMAL(5,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert margin tiers
INSERT INTO margin_tiers (tier_name, margin_percentage, description) VALUES
  ('Government / Parastatal', 15, '15% margin for government and parastatal clients'),
  ('NGO / Dev. Partner', 20, '20% margin for NGOs and development partners'),
  ('Commercial / Private', 30, '30% margin for commercial and private clients'),
  ('Internal / UPPC', 0, '0% margin for internal UPPC jobs');

-- Clients table
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  address TEXT,
  contact VARCHAR(20),
  email VARCHAR(100),
  margin_tier_id INT REFERENCES margin_tiers(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table (linked to clients)
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  quantity INT,
  page_size VARCHAR(10),
  pages_per_copy INT,
  stock_sheets INT DEFAULT 0,
  plates_a1 INT DEFAULT 0,
  plates_a2 INT DEFAULT 0,
  plates_a3 INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  subtotal_cost DECIMAL(12,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Materials table (ink, glue, sundries, paper, etc.)
CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  unit_of_measure VARCHAR(20),
  unit_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job materials (materials used in each job)
CREATE TABLE job_materials (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  material_id INT NOT NULL REFERENCES materials(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Machines table
CREATE TABLE machines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  cost_per_impression DECIMAL(10,2) NOT NULL,
  setup_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job machines (machine usage in jobs)
CREATE TABLE job_machines (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  machine_id INT NOT NULL REFERENCES machines(id),
  impressions INT,
  setup_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_per_impression DECIMAL(10,2) NOT NULL,
  cost_per_copy DECIMAL(10,2) DEFAULT 0,
  setup_applied BOOLEAN DEFAULT FALSE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Binding methods table
CREATE TABLE bindings (
  id SERIAL PRIMARY KEY,
  method VARCHAR(100) NOT NULL,
  rate_per_copy DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job bindings
CREATE TABLE job_bindings (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  binding_id INT NOT NULL REFERENCES bindings(id),
  copies INT,
  cost DECIMAL(12,2) DEFAULT 0,
  cost_per_copy DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Special processes table (perforation, collating, guillotine, etc.)
CREATE TABLE special_processes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rate_per_unit DECIMAL(10,2) NOT NULL,
  unit_type VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job special processes
CREATE TABLE job_special_processes (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  special_process_id INT NOT NULL REFERENCES special_processes(id),
  quantity DECIMAL(10,2),
  cost_per_unit DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional costs table (design, typesetting, storage, transport)
CREATE TABLE job_additional_costs (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  design_hours DECIMAL(10,2) DEFAULT 0,
  design_rate DECIMAL(10,2) DEFAULT 0,
  typesetting_hours DECIMAL(10,2) DEFAULT 0,
  typesetting_rate DECIMAL(10,2) DEFAULT 0,
  storage_percent DECIMAL(5,2) DEFAULT 5,
  storage_cost DECIMAL(12,2) DEFAULT 0,
  transport_percent DECIMAL(5,2) DEFAULT 10,
  transport_cost DECIMAL(12,2) DEFAULT 0,
  overhead_percent DECIMAL(5,2) DEFAULT 10,
  overhead_cost DECIMAL(12,2) DEFAULT 0,
  special_processes_total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional costs table (design, typesetting, storage, transport, etc.)
CREATE TABLE job_costs (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  cost_type VARCHAR(50) NOT NULL,
  description TEXT,
  work_hours DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  fixed_amount DECIMAL(12,2),
  is_percentage BOOLEAN DEFAULT FALSE,
  percentage_value DECIMAL(5,2),
  calculated_amount DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table (for VAT and overhead percentages)
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_name VARCHAR(50) UNIQUE NOT NULL,
  setting_value DECIMAL(5,2),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system settings
INSERT INTO system_settings (setting_name, setting_value, description) VALUES
  ('VAT_PERCENTAGE', 18, 'Value Added Tax percentage'),
  ('OVERHEAD_PERCENTAGE', 5, 'General overhead cost percentage (adjust as needed)'),
  ('PLATES_A1_STOCK', 100, 'Available A1 plates in stock'),
  ('PLATES_A2_STOCK', 200, 'Available A2 plates in stock'),
  ('PLATES_A3_STOCK', 300, 'Available A3 plates in stock');

-- Insert sample materials
INSERT INTO materials (name, category, unit_of_measure, unit_cost) VALUES
  ('A4 Paper 80gsm', 'Paper', 'sheet', 150),
  ('A3 Paper 80gsm', 'Paper', 'sheet', 250),
  ('Cardstock 200gsm', 'Paper', 'sheet', 400),
  ('Glossy Photo Paper', 'Paper', 'sheet', 800),
  ('Envelope A4', 'Envelope', 'piece', 200),
  ('Envelope DL', 'Envelope', 'piece', 150),
  ('Plate A1', 'Plates', 'piece', 5000),
  ('Plate A2', 'Plates', 'piece', 2500),
  ('Plate A3', 'Plates', 'piece', 1500);

-- Insert sample machines
INSERT INTO machines (name, cost_per_impression, setup_cost) VALUES
  ('HP Indigo 5000', 50, 10000),
  ('Heidelberg Speedmaster', 30, 15000),
  ('Xerox Versant', 40, 12000),
  ('Duplo Collator', 10, 5000),
  ('Stahl Folder', 15, 3000);

-- Insert sample bindings
INSERT INTO bindings (method, rate_per_copy) VALUES
  ('Saddle Stitch', 500),
  ('Perfect Binding', 800),
  ('Wire Binding', 600),
  ('Tape Binding', 400),
  ('No Binding', 0);

-- Insert sample special processes
INSERT INTO special_processes (name, unit_type, rate_per_unit) VALUES
  ('Perforation', 'sheet', 20),
  ('Lamination', 'sheet', 100),
  ('Folding', 'sheet', 30),
  ('Collating', 'set', 50),
  ('Guillotine Cutting', 'cut', 25),
  ('Drilling', 'hole', 15);