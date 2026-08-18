-- Lets the printed quotation show a real name ("Costed by: Jane K.")
-- instead of a bare login username.
-- Run this against an existing database that predates this feature.

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
