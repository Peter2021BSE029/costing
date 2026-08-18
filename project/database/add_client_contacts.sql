-- Lets a client have several named contact people (name/phone/email each)
-- instead of the single flat `contact`/`email` columns on `clients`.
-- Those columns are kept and auto-synced from the first contact for
-- backward compatibility with existing display code.
-- Run this against an existing database that predates this feature.

CREATE TABLE IF NOT EXISTS client_contacts (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
