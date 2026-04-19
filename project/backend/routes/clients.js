// Clients routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool; // We'll export pool from server.js

// Get all clients
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, mt.tier_name, mt.margin_percentage
      FROM clients c
      LEFT JOIN margin_tiers mt ON c.margin_tier_id = mt.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create client
router.post('/', async (req, res) => {
  console.log('[CLIENTS] POST /api/clients - Request body:', req.body);
  const { name, type, address, contact, email, margin_tier_id } = req.body;

  // Validate required fields
  if (!name || !margin_tier_id) {
    console.log('[CLIENTS] Validation failed - missing name or margin_tier_id');
    return res.status(400).json({ error: 'Name and margin_tier_id are required' });
  }

  try {
    console.log('[CLIENTS] Inserting client:', { name, type, address, contact, email, margin_tier_id });
    const result = await pool.query(
      'INSERT INTO clients (name, type, address, contact, email, margin_tier_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, type, address, contact, email, margin_tier_id]
    );
    console.log('[CLIENTS] Client created successfully:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CLIENTS] Database error:', err.message);
    console.error('[CLIENTS] Error details:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get margin tiers
router.get('/margin-tiers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM margin_tiers ORDER BY margin_percentage');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;