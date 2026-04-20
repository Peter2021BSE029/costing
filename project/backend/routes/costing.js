// Costing routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;

// Submit comprehensive costing
router.post('/', async (req, res) => {
  console.log('[COSTING] POST /api/costing - Request received');
  console.log('[COSTING] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[COSTING] POST /api/costing - Request body:', JSON.stringify(req.body, null, 2));

  const {
    client,
    job,
    materials = [],
    plates = [],
    machines = [],
    processes = [],
    binding,
    additional_costs
  } = req.body;

  console.log('[COSTING] Parsed data - client:', client, 'job:', job);
  console.log('[COSTING] Arrays - materials:', materials.length, 'machines:', machines.length, 'processes:', processes.length);

  // Validate required fields
  if (!client || !client.name || !client.margin_tier_id || !job || !job.name || !job.quantity) {
    console.log('[COSTING] Validation failed:', { client, job });
    return res.status(400).json({ error: 'Client name, margin tier, job name, and quantity are required' });
  }

  const clientConn = await pool.connect();

  try {
    await clientConn.query('BEGIN');

    // 1. Create or find client
    let clientResult;
    const existingClient = await clientConn.query(
      'SELECT id FROM clients WHERE name = $1 AND email = $2',
      [client.name, client.email || '']
    );

    if (existingClient.rows.length > 0) {
      clientResult = existingClient;
      console.log('[COSTING] Using existing client:', clientResult.rows[0]);
    } else {
      clientResult = await clientConn.query(
        'INSERT INTO clients (name, type, address, contact, email, margin_tier_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [client.name, client.type, client.address, client.contact, client.email, client.margin_tier_id]
      );
      console.log('[COSTING] Created new client:', clientResult.rows[0]);
    }

    const clientId = clientResult.rows[0].id;

    // 2. Create job
    const jobColumns = ['client_id', 'name', 'description', 'quantity'];
    const jobValues = [clientId, job.name, job.description, job.quantity];
    const optionalJobColumns = ['page_size', 'pages_per_copy', 'stock_sheets', 'plates_a1', 'plates_a2', 'plates_a3'];

    const availableJobColumns = (await clientConn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = ANY($1::text[])`,
      [optionalJobColumns]
    )).rows.map(row => row.column_name);

    for (const column of optionalJobColumns) {
      if (availableJobColumns.includes(column) && job[column] !== undefined) {
        jobColumns.push(column);
        jobValues.push(job[column]);
      }
    }

    const jobPlaceholders = jobColumns.map((_, index) => `$${index + 1}`).join(', ');
    const jobResult = await clientConn.query(
      `INSERT INTO jobs (${jobColumns.join(', ')}) VALUES (${jobPlaceholders}) RETURNING id`,
      jobValues
    );
    const jobId = jobResult.rows[0].id;
    console.log('[COSTING] Created job:', jobId);

    // 3. Insert materials
    for (const material of materials) {
      await clientConn.query(
        'INSERT INTO job_materials (job_id, material_id, quantity, unit_cost) VALUES ($1, $2, $3, $4)',
        [jobId, material.material_id, material.quantity, material.unit_cost]
      );
    }
    console.log('[COSTING] Inserted materials:', materials.length);

    // 3a. Insert plates as materials
    for (const plate of plates) {
      // Find the plate material by name
      const plateMaterial = await clientConn.query(
        'SELECT id FROM materials WHERE name LIKE $1',
        [`%${plate.size}%`]
      );
      if (plateMaterial.rows.length > 0) {
        await clientConn.query(
          'INSERT INTO job_materials (job_id, material_id, quantity, unit_cost) VALUES ($1, $2, $3, $4)',
          [jobId, plateMaterial.rows[0].id, plate.quantity, plate.unit_cost]
        );
      } else {
        console.warn('[COSTING] Plate material not found for size:', plate.size);
      }
    }
    console.log('[COSTING] Inserted plates:', plates.length);

    // 4. Insert machines
    for (const machine of machines) {
      await clientConn.query(
        'INSERT INTO job_machines (job_id, machine_id, impressions, cost_per_impression) VALUES ($1, $2, $3, $4)',
        [jobId, machine.machine_id, machine.impressions, machine.cost_per_impression]
      );
    }
    console.log('[COSTING] Inserted machines:', machines.length);

    // 5. Insert special processes
    for (const process of processes) {
      await clientConn.query(
        'INSERT INTO job_special_processes (job_id, special_process_id, quantity, cost_per_unit) VALUES ($1, $2, $3, $4)',
        [jobId, process.process_id, process.quantity, process.rate_per_unit]
      );
    }
    console.log('[COSTING] Inserted processes:', processes.length);

    // 6. Insert bindings if provided
    if (binding && binding.bindings && binding.bindings.length > 0) {
      for (const bind of binding.bindings) {
        await clientConn.query(
          'INSERT INTO job_bindings (job_id, binding_id, copies, cost_per_copy) VALUES ($1, $2, $3, $4)',
          [jobId, bind.binding_id, job.quantity, bind.cost] // Assuming copies = job quantity
        );
      }
      console.log('[COSTING] Inserted bindings:', binding.bindings.length);
    }

    // 7. Insert additional costs
    if (additional_costs) {
      const additionalColumns = ['job_id', 'design_hours', 'design_rate', 'typesetting_hours', 'typesetting_rate', 'storage_cost', 'transport_cost'];
      const additionalValues = [
        jobId,
        additional_costs.design_hours || 0,
        additional_costs.design_rate || 0,
        additional_costs.typesetting_hours || 0,
        additional_costs.typesetting_rate || 0,
        additional_costs.storage_cost || 0,
        additional_costs.transport_cost || 0
      ];
      const optionalAdditionalColumns = ['overhead_percent', 'overhead_cost', 'special_processes_total'];

      const availableAdditionalColumns = (await clientConn.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'job_additional_costs' AND column_name = ANY($1::text[])`,
        [optionalAdditionalColumns]
      )).rows.map(row => row.column_name);

      for (const column of optionalAdditionalColumns) {
        if (availableAdditionalColumns.includes(column)) {
          additionalColumns.push(column);
          additionalValues.push(additional_costs[column] || 0);
        }
      }

      const additionalPlaceholders = additionalColumns.map((_, index) => `$${index + 1}`).join(', ');
      await clientConn.query(
        `INSERT INTO job_additional_costs (${additionalColumns.join(', ')}) VALUES (${additionalPlaceholders})`,
        additionalValues
      );
      console.log('[COSTING] Inserted additional costs');
    }

    await clientConn.query('COMMIT');
    console.log('[COSTING] Transaction committed successfully');

    res.json({ job_id: jobId, message: 'Costing saved successfully' });

  } catch (err) {
    await clientConn.query('ROLLBACK');
    console.error('[COSTING] Transaction failed:', err.message);
    console.error('[COSTING] Error details:', err);
    res.status(500).json({ error: err.message });
  } finally {
    clientConn.release();
  }
});

// Generate quotation PDF (placeholder - will implement later)
router.get('/quotation/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    // For now, return a simple text response
    // TODO: Implement actual PDF generation
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation_${jobId}.pdf`);

    // Placeholder PDF content (this would be replaced with actual PDF generation)
    const pdfContent = `Quotation for Job ${jobId}\n\nThis is a placeholder quotation.\nPDF generation will be implemented.`;

    res.send(Buffer.from(pdfContent));
  } catch (err) {
    console.error('[QUOTATION] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;