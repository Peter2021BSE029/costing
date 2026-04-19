-- Add Plates to Materials Table
-- Run this script to add plate materials to an existing database

INSERT INTO materials (name, category, unit_of_measure, unit_cost) VALUES
  ('Plate A1', 'Plates', 'piece', 5000),
  ('Plate A2', 'Plates', 'piece', 2500),
  ('Plate A3', 'Plates', 'piece', 1500);

-- Verify insertion
SELECT * FROM materials WHERE category = 'Plates';
