-- Two fixes found through testing with many/long line items:
-- 1. jobs.name was VARCHAR(100), so a long item name would fail to save
--    ("value too long for type character varying(100)") instead of just
--    printing on a wrapped/paginated line. Widen it to remove that cap.
-- 2. Lets the costing agent's name be typed in manually on the quotation
--    (printed as "Costed by:"), ahead of it later being picked up
--    automatically from the logged-in account.
-- Run this against an existing database that predates this feature.

ALTER TABLE jobs ALTER COLUMN name TYPE TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS costing_agent_name VARCHAR(150);
