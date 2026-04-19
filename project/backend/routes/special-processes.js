// Special Processes routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;

// Get all special processes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM special_processes ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('[SPECIAL_PROCESSES] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create special process
router.post('/', async (req, res) => {
  console.log('[SPECIAL_PROCESSES] POST /api/special-processes - Request body:', req.body);
  const { name, unit_type, rate_per_unit } = req.body;

  if (!name || !rate_per_unit) {
    return res.status(400).json({ error: 'Name and rate_per_unit are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO special_processes (name, unit_type, rate_per_unit) VALUES ($1, $2, $3) RETURNING *',
      [name, unit_type, rate_per_unit]
    );
    console.log('[SPECIAL_PROCESSES] Special process created:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[SPECIAL_PROCESSES] Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;