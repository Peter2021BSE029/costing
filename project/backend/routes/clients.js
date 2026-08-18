// Clients routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool; // We'll export pool from server.js

// Get all clients, each with its list of contact people (may be empty)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, mt.tier_name, mt.margin_percentage, COALESCE(contacts_agg.contacts, '[]') AS contacts
      FROM clients c
      LEFT JOIN margin_tiers mt ON c.margin_tier_id = mt.id
      LEFT JOIN LATERAL (
        SELECT json_agg(cc.* ORDER BY cc.id) AS contacts
        FROM client_contacts cc
        WHERE cc.client_id = c.id
      ) contacts_agg ON true
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create client, optionally with a list of contact people
router.post('/', async (req, res) => {
  console.log('[CLIENTS] POST /api/clients - Request body:', req.body);
  const { name, type, address, contact, email, margin_tier_id, contacts } = req.body;

  // Validate required fields
  if (!name || !margin_tier_id) {
    console.log('[CLIENTS] Validation failed - missing name or margin_tier_id');
    return res.status(400).json({ error: 'Name and margin_tier_id are required' });
  }

  const contactList = Array.isArray(contacts) ? contacts.filter(c => c && (c.name || c.phone || c.email)) : [];
  const primaryContact = contactList[0] || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[CLIENTS] Inserting client:', { name, type, address, contact, email, margin_tier_id });
    const result = await client.query(
      'INSERT INTO clients (name, type, address, contact, email, margin_tier_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, type, address, primaryContact.phone || contact, primaryContact.email || email, margin_tier_id]
    );
    const clientRow = result.rows[0];

    for (const c of contactList) {
      await client.query(
        'INSERT INTO client_contacts (client_id, name, phone, email) VALUES ($1, $2, $3, $4)',
        [clientRow.id, c.name || null, c.phone || null, c.email || null]
      );
    }

    await client.query('COMMIT');
    console.log('[CLIENTS] Client created successfully:', clientRow);
    res.json({ ...clientRow, contacts: contactList });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CLIENTS] Database error:', err.message);
    console.error('[CLIENTS] Error details:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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