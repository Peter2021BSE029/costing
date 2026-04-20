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
  const { name, cost_per_impression, setup_cost } = req.body;

  if (!name || cost_per_impression === undefined) {
    return res.status(400).json({ error: 'Name and cost_per_impression are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO machines (name, cost_per_impression, setup_cost) VALUES ($1, $2, $3) RETURNING *',
      [name, cost_per_impression, setup_cost || 0]
    );
    console.log('[MACHINES] Machine created:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[MACHINES] Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update machine
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cost_per_impression, setup_cost } = req.body;

  try {
    const result = await pool.query(
      `UPDATE machines SET
        name = COALESCE($1, name),
        cost_per_impression = COALESCE($2, cost_per_impression),
        setup_cost = COALESCE($3, setup_cost)
      WHERE id = $4 RETURNING *`,
      [name, cost_per_impression, setup_cost, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[MACHINES] Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete machine
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM machines WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    res.json({ message: 'Machine deleted successfully', id: result.rows[0].id });
  } catch (err) {
    console.error('[MACHINES] Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;