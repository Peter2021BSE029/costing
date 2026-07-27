-- Add support for multi-item quotations: a quotation can now bundle several
-- jobs (line items) for one client, mixing fixed-price and fully-costed items.
-- Run this against an existing database that predates this feature.

CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quotation_id INT REFERENCES quotations(id) ON DELETE CASCADE;

-- Backfill: wrap every pre-existing job in its own single-item quotation
DO $$
DECLARE
  r RECORD;
  new_quotation_id INT;
BEGIN
  FOR r IN SELECT id, client_id, created_at, updated_at FROM jobs WHERE quotation_id IS NULL LOOP
    INSERT INTO quotations (client_id, created_at, updated_at)
    VALUES (r.client_id, r.created_at, r.updated_at)
    RETURNING id INTO new_quotation_id;

    UPDATE jobs SET quotation_id = new_quotation_id WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE jobs ALTER COLUMN quotation_id SET NOT NULL;
