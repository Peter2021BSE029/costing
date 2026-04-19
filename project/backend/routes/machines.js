// Machines routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;

// Get all machines
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('[MACHINES] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create machine
router.post('/', async (req, res) => {
  console.log('[MACHINES] POST /api/machines - Request body:', req.body);
  const { name, cost_per_impression, description } = req.body;

  if (!name || !cost_per_impression) {
    return res.status(400).json({ error: 'Name and cost_per_impression are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO machines (name, cost_per_impression, description) VALUES ($1, $2, $3) RETURNING *',
      [name, cost_per_impression, description]
    );
    console.log('[MACHINES] Machine created:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[MACHINES] Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;