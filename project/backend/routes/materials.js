// Materials routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;

// Get all materials
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM materials ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('[MATERIALS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create material
router.post('/', async (req, res) => {
  console.log('[MATERIALS] POST /api/materials - Request body:', req.body);
  const { name, category, unit_of_measure, unit_cost } = req.body;

  if (!name || !unit_cost) {
    return res.status(400).json({ error: 'Name and unit_cost are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO materials (name, category, unit_of_measure, unit_cost) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category, unit_of_measure, unit_cost]
    );
    console.log('[MATERIALS] Material created:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[MATERIALS] Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;