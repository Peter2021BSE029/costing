-- Tracks each successful login, so the dashboard can show real usage
-- statistics (how often the system is used, when it was last used) instead
-- of financial totals.
-- Run this against an existing database that predates this feature.

CREATE TABLE IF NOT EXISTS login_events (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  logged_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
