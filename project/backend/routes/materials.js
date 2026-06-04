// Materials routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;
const { authenticateToken } = require('./auth');

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
router.post('/', authenticateToken, async (req, res) => {
  console.log('[MATERIALS] POST /api/materials - Request body:', req.body);
  const { name, category, unit_of_measure, unit_cost } = req.body;

  if (!name || unit_cost === undefined) {
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

// Update material
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, category, unit_of_measure, unit_cost } = req.body;

  try {
    const result = await pool.query(
      `UPDATE materials SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        unit_of_measure = COALESCE($3, unit_of_measure),
        unit_cost = COALESCE($4, unit_cost)
      WHERE id = $5 RETURNING *`,
      [name, category, unit_of_measure, unit_cost, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[MATERIALS] Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete material
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM materials WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json({ message: 'Material deleted successfully', id: result.rows[0].id });
  } catch (err) {
    console.error('[MATERIALS] Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;