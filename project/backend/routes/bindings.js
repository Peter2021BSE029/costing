// Bindings routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;

// Get all bindings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bindings ORDER BY method');
    res.json(result.rows);
  } catch (err) {
    console.error('[BINDINGS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create binding
router.post('/', async (req, res) => {
  console.log('[BINDINGS] POST /api/bindings - Request body:', req.body);
  const { method, rate_per_copy } = req.body;

  if (!method || !rate_per_copy) {
    return res.status(400).json({ error: 'Method and rate_per_copy are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO bindings (method, rate_per_copy) VALUES ($1, $2) RETURNING *',
      [method, rate_per_copy]
    );
    console.log('[BINDINGS] Binding created:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[BINDINGS] Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;