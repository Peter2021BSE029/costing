// Jobs routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;
const { authenticateToken } = require('./auth');

// Get all jobs with client info
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT j.*, c.name as client_name, c.type as client_type,
             mt.tier_name, mt.margin_percentage
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      LEFT JOIN margin_tiers mt ON c.margin_tier_id = mt.id
      ORDER BY j.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create job
router.post('/', async (req, res) => {
  console.log('[JOBS] POST /api/jobs - Request body:', req.body);
  const { client_id, name, description, quantity, status, page_size, pages_per_copy } = req.body;

  // Validate required fields
  if (!client_id || !name || !quantity) {
    console.log('[JOBS] Validation failed - missing client_id, name, or quantity');
    return res.status(400).json({ error: 'client_id, name, and quantity are required' });
  }

  try {
    console.log('[JOBS] Inserting job:', { client_id, name, description, quantity, status, page_size, pages_per_copy });
    const result = await pool.query(
      'INSERT INTO jobs (client_id, name, description, quantity, status, page_size, pages_per_copy) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [client_id, name, description, quantity, status || 'pending', page_size || null, pages_per_copy || null]
    );
    console.log('[JOBS] Job created successfully:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[JOBS] Database error:', err.message);
    console.error('[JOBS] Error details:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get clients for job creation
router.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM clients ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get job by ID with full details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const jobResult = await pool.query(`
      SELECT j.*, c.id as client_id, c.name as client_name, c.type as client_type,
             c.address as client_address, c.contact as client_contact, c.email as client_email,
             mt.tier_name, mt.margin_percentage
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      LEFT JOIN margin_tiers mt ON c.margin_tier_id = mt.id
      WHERE j.id = $1
    `, [id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    const materialsResult = await pool.query(`
      SELECT jm.*, m.name, m.category, m.unit_of_measure, m.unit_cost
      FROM job_materials jm
      JOIN materials m ON jm.material_id = m.id
      WHERE jm.job_id = $1
    `, [id]);
    job.materials = materialsResult.rows;

    const machinesResult = await pool.query(`
      SELECT jm.*, m.name, m.cost_per_impression, m.setup_cost
      FROM job_machines jm
      JOIN machines m ON jm.machine_id = m.id
      WHERE jm.job_id = $1
    `, [id]);
    job.machines = machinesResult.rows;

    const processesResult = await pool.query(`
      SELECT jsp.*, sp.name, sp.unit_type, sp.rate_per_unit
      FROM job_special_processes jsp
      JOIN special_processes sp ON jsp.special_process_id = sp.id
      WHERE jsp.job_id = $1
    `, [id]);
    job.processes = processesResult.rows;

    const bindingResult = await pool.query(`
      SELECT jb.*, b.method, b.rate_per_copy
      FROM job_bindings jb
      JOIN bindings b ON jb.binding_id = b.id
      WHERE jb.job_id = $1
    `, [id]);
    job.bindings = bindingResult.rows;

    const additionalCostsResult = await pool.query(`
      SELECT * FROM job_additional_costs WHERE job_id = $1
    `, [id]);
    job.additional_costs = additionalCostsResult.rows[0] || null;

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a job (line item), whether calculated or fixed-price. Logged to
// job_deletions first (job details snapshotted, since the row itself won't
// exist afterward) so a deletion can always be traced back to who did it.
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const jobResult = await client.query(`
      SELECT j.id, j.name, j.quotation_id, c.name as client_name
      FROM jobs j JOIN clients c ON j.client_id = c.id
      WHERE j.id = $1
    `, [id]);

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];
    await client.query(
      'INSERT INTO job_deletions (job_id, job_name, quotation_id, client_name, deleted_by) VALUES ($1, $2, $3, $4, $5)',
      [job.id, job.name, job.quotation_id, job.client_name, req.user.id]
    );
    await client.query('DELETE FROM jobs WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'Job deleted successfully', id: Number(id) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[JOBS] Delete error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;