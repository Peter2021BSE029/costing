-- Tracks which logged-in user costed/created each job and quotation, so
-- the printed quotation can show "Costed by: <name>".
-- Run this against an existing database that predates this feature.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);
