// Usage statistics for the dashboard — how often the system is actually
// being used and by whom, rather than financial totals (those already live
// on the Quotations list).
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;
const { authenticateToken } = require('./auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT le.logged_in_at
           FROM login_events le
           ORDER BY le.logged_in_at DESC LIMIT 1) AS last_login_at,
        (SELECT COALESCE(u.full_name, u.username)
           FROM login_events le JOIN users u ON u.id = le.user_id
           ORDER BY le.logged_in_at DESC LIMIT 1) AS last_login_by,
        (SELECT COUNT(*) FROM login_events WHERE logged_in_at >= NOW() - INTERVAL '7 days') AS logins_this_week,
        (SELECT COUNT(DISTINCT DATE(logged_in_at)) FROM login_events
           WHERE date_trunc('month', logged_in_at) = date_trunc('month', NOW())) AS active_days_this_month,
        (SELECT COUNT(*) FROM login_events) AS total_logins
    `);
    const row = result.rows[0] || {};
    res.json({
      last_login_at: row.last_login_at,
      last_login_by: row.last_login_by,
      logins_this_week: Number(row.logins_this_week || 0),
      active_days_this_month: Number(row.active_days_this_month || 0),
      total_logins: Number(row.total_logins || 0)
    });
  } catch (err) {
    console.error('[USAGE-STATS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
