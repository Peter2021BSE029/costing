-- Logs every job (line item) deletion for tracking — who deleted what and
-- when. Job details are snapshotted here since the job row itself is gone
-- afterward (no FK to jobs, deliberately, so this record outlives it).
-- Run this against an existing database that predates this feature.

CREATE TABLE IF NOT EXISTS job_deletions (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL,
  job_name TEXT,
  quotation_id INT,
  client_name VARCHAR(100),
  deleted_by INT REFERENCES users(id),
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
