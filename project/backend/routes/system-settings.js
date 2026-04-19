// System settings routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;

// Get all system settings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT setting_name, setting_value, description FROM system_settings');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;