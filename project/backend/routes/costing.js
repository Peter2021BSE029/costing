// Costing routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;
const PDFDocument = require('pdfkit');
const { authenticateToken } = require('./auth');
const { toNumber, getJobCostSheetData } = require('../lib/quotationPdf');
const { drawCostSheetPdf } = require('../lib/costSheetPdf');

// A fixed job's price is either exclusive of VAT (18% added on top) or
// inclusive (VAT already baked into the entered price). Anything else falls
// back to the historical default.
function normalizeVatOption(value) {
  return value === 'inclusive' ? 'inclusive' : 'exclusive';
}

// Resolves the client to bill and the quotation to attach a new item to.
// If quotation_id is supplied, the item joins that existing quotation (client is
// taken from the quotation, ignoring any client/client_id also sent). Otherwise a
// client is created-or-found from `client`/`client_id`, and a new quotation is opened for it.
async function resolveQuotationAndClient(conn, { quotation_id, client_id, client }) {
  if (quotation_id) {
    const quotationResult = await conn.query('SELECT id, client_id FROM quotations WHERE id = $1', [quotation_id]);
    if (quotationResult.rows.length === 0) {
      throw new Error('Quotation not found');
    }
    return { quotationId: quotationResult.rows[0].id, clientId: quotationResult.rows[0].client_id };
  }

  const clientId = await resolveClient(conn, { client_id, client });

  const newQuotation = await conn.query(
    'INSERT INTO quotations (client_id) VALUES ($1) RETURNING id',
    [clientId]
  );

  return { quotationId: newQuotation.rows[0].id, clientId };
}

// Inserts a job's cost-breakdown rows (materials, plates, machines, processes, bindings,
// additional costs). Shared by job creation and job update (which deletes the old rows first).
async function insertJobLineItems(conn, jobId, { materials = [], plates = [], machines = [], processes = [], binding, additional_costs }) {
  // Materials (paper lines may carry stock_size/print_sides if those columns exist)
  const optionalMaterialColumns = ['stock_size', 'print_sides'];
  const availableMaterialColumns = (await conn.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'job_materials' AND column_name = ANY($1::text[])`,
    [optionalMaterialColumns]
  )).rows.map(row => row.column_name);

  for (const material of materials) {
    const columns = ['job_id', 'material_id', 'quantity', 'unit_cost'];
    const values = [jobId, material.material_id, material.quantity, material.unit_cost];
    for (const column of optionalMaterialColumns) {
      if (availableMaterialColumns.includes(column) && material[column] !== undefined) {
        columns.push(column);
        values.push(material[column]);
      }
    }
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    await conn.query(
      `INSERT INTO job_materials (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );
  }

  // Plates as materials. Filtering by category (not just name LIKE '%A3%')
  // avoids matching an unrelated material whose name happens to contain the
  // plate size, e.g. a paper stock named "A3 Paper 80gsm".
  for (const plate of plates) {
    const plateMaterial = await conn.query(
      "SELECT id FROM materials WHERE name LIKE $1 AND LOWER(category) = 'plates'",
      [`%${plate.size}%`]
    );
    if (plateMaterial.rows.length > 0) {
      await conn.query(
        'INSERT INTO job_materials (job_id, material_id, quantity, unit_cost) VALUES ($1, $2, $3, $4)',
        [jobId, plateMaterial.rows[0].id, plate.quantity, plate.unit_cost]
      );
    } else {
      console.warn('[COSTING] Plate material not found for size:', plate.size);
    }
  }

  // Machines
  for (const machine of machines) {
    await conn.query(
      'INSERT INTO job_machines (job_id, machine_id, impressions, setup_cost, cost_per_impression, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        jobId,
        machine.machine_id,
        machine.impressions,
        toNumber(machine.setup_cost),
        toNumber(machine.cost_per_impression),
        (toNumber(machine.impressions) * toNumber(machine.cost_per_impression)) + toNumber(machine.setup_cost)
      ]
    );
  }

  // Special processes
  for (const process of processes) {
    await conn.query(
      'INSERT INTO job_special_processes (job_id, special_process_id, quantity, cost_per_unit) VALUES ($1, $2, $3, $4)',
      [jobId, process.process_id, process.quantity, process.rate_per_unit]
    );
  }

  // Bindings
  if (binding && binding.bindings && binding.bindings.length > 0) {
    for (const bind of binding.bindings) {
      const bindingCost = toNumber(bind.cost);
      await conn.query(
        'INSERT INTO job_bindings (job_id, binding_id, copies, cost, cost_per_copy, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
        [jobId, bind.binding_id, 1, bindingCost, bindingCost, bindingCost]
      );
    }
  }

  // Additional costs
  if (additional_costs) {
    const additionalColumns = ['job_id', 'design_pages', 'design_rate', 'typesetting_pages', 'typesetting_rate', 'wastage_percent', 'wastage_cost', 'subcontract_description', 'subcontract_cost', 'storage_percent', 'storage_cost', 'transport_percent', 'transport_cost'];
    const additionalValues = [
      jobId,
      additional_costs.design_pages || 0,
      additional_costs.design_rate || 0,
      additional_costs.typesetting_pages || 0,
      additional_costs.typesetting_rate || 0,
      additional_costs.wastage_percent || 5,
      additional_costs.wastage_cost || 0,
      additional_costs.subcontract_description || '',
      additional_costs.subcontract_cost || 0,
      additional_costs.storage_percent || 5,
      additional_costs.storage_cost || 0,
      additional_costs.transport_percent || 10,
      additional_costs.transport_cost || 0
    ];
    const optionalAdditionalColumns = ['ctp_cost', 'commission_cost', 'overhead_percent', 'overhead_cost', 'special_processes_total', 'paper_wastage_percent'];

    const availableAdditionalColumns = (await conn.query(
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
    await conn.query(
      `INSERT INTO job_additional_costs (${additionalColumns.join(', ')}) VALUES (${additionalPlaceholders})`,
      additionalValues
    );
  }

  return {
    materialsCount: materials.length,
    platesCount: plates.length,
    machinesCount: machines.length,
    processesCount: processes.length,
    bindingsCount: binding && binding.bindings ? binding.bindings.length : 0
  };
}

// Resolves (creates if needed) the client a job belongs to, from `client`/`client_id`.
async function resolveClient(conn, { client_id, client }) {
  let clientId = client_id ? parseInt(client_id, 10) : null;
  if (clientId) {
    return clientId;
  }

  const existingClient = await conn.query(
    'SELECT id FROM clients WHERE name = $1 AND email = $2',
    [client.name, client.email || '']
  );
  if (existingClient.rows.length > 0) {
    return existingClient.rows[0].id;
  }

  const inserted = await conn.query(
    'INSERT INTO clients (name, type, address, contact, email, margin_tier_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [client.name, client.type, client.address, client.contact, client.email, client.margin_tier_id]
  );
  return inserted.rows[0].id;
}

// Submit comprehensive costing (adds one fully-costed item, to a new or existing quotation)
router.post('/', authenticateToken, async (req, res) => {
  console.log('[COSTING] POST /api/costing - Request received');

  const {
    client,
    client_id,
    quotation_id,
    job,
    materials = [],
    plates = [],
    machines = [],
    processes = [],
    binding,
    additional_costs
  } = req.body;

  console.log('[COSTING] Parsed data - client:', client, 'job:', job, 'quotation_id:', quotation_id);
  console.log('[COSTING] Arrays - materials:', materials.length, 'machines:', machines.length, 'processes:', processes.length);

  // Validate required fields
  if (!job || !job.name || !job.quantity) {
    return res.status(400).json({ error: 'Job name and quantity are required' });
  }
  if (!quotation_id && (!client || !client.name || !client.margin_tier_id)) {
    console.log('[COSTING] Validation failed:', { client, job });
    return res.status(400).json({ error: 'Client name and margin tier are required' });
  }

  const clientConn = await pool.connect();

  try {
    await clientConn.query('BEGIN');

    const { quotationId, clientId } = await resolveQuotationAndClient(clientConn, { quotation_id, client_id, client });

    // 2. Create job (line item)
    const jobColumns = ['client_id', 'quotation_id', 'name', 'description', 'quantity'];
    const jobValues = [clientId, quotationId, job.name, job.description, job.quantity];
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
    console.log('[COSTING] Created job:', jobId, 'in quotation:', quotationId);

    const counts = await insertJobLineItems(clientConn, jobId, { materials, plates, machines, processes, binding, additional_costs });
    console.log('[COSTING] Inserted line items:', counts);

    await clientConn.query('COMMIT');
    console.log('[COSTING] Transaction committed successfully');

    res.json({ job_id: jobId, quotation_id: quotationId, message: 'Costing saved successfully' });

  } catch (err) {
    await clientConn.query('ROLLBACK');
    console.error('[COSTING] Transaction failed:', err.message);
    console.error('[COSTING] Error details:', err);
    res.status(500).json({ error: err.message });
  } finally {
    clientConn.release();
  }
});

// Update an existing fully-costed job in place: keeps its id and quotation,
// replaces its cost breakdown (materials/machines/bindings/processes/additional costs).
router.put('/:jobId', authenticateToken, async (req, res) => {
  const { jobId } = req.params;
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

  if (!job || !job.name || !job.quantity) {
    return res.status(400).json({ error: 'Job name and quantity are required' });
  }
  if (!client || !client.name || !client.margin_tier_id) {
    return res.status(400).json({ error: 'Client name and margin tier are required' });
  }

  const clientConn = await pool.connect();

  try {
    await clientConn.query('BEGIN');

    const existingJob = await clientConn.query('SELECT id, pricing_mode, quotation_id FROM jobs WHERE id = $1', [jobId]);
    if (existingJob.rows.length === 0) {
      throw Object.assign(new Error('Job not found'), { status: 404 });
    }
    if (existingJob.rows[0].pricing_mode === 'fixed') {
      throw Object.assign(new Error('This is a fixed-price job; update it from the Jobs list instead'), { status: 400 });
    }

    const clientId = await resolveClient(clientConn, { client, client_id: null });

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

    const setClause = jobColumns.map((column, index) => `${column} = $${index + 1}`).join(', ');
    jobValues.push(jobId);
    await clientConn.query(
      `UPDATE jobs SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${jobValues.length}`,
      jobValues
    );

    // Replace the cost breakdown: clear the old rows, then insert the submitted ones
    await clientConn.query('DELETE FROM job_materials WHERE job_id = $1', [jobId]);
    await clientConn.query('DELETE FROM job_machines WHERE job_id = $1', [jobId]);
    await clientConn.query('DELETE FROM job_special_processes WHERE job_id = $1', [jobId]);
    await clientConn.query('DELETE FROM job_bindings WHERE job_id = $1', [jobId]);
    await clientConn.query('DELETE FROM job_additional_costs WHERE job_id = $1', [jobId]);

    const counts = await insertJobLineItems(clientConn, jobId, { materials, plates, machines, processes, binding, additional_costs });
    console.log('[COSTING] Updated job', jobId, '- inserted line items:', counts);

    await clientConn.query('COMMIT');

    res.json({ job_id: Number(jobId), quotation_id: existingJob.rows[0].quotation_id, message: 'Costing updated successfully' });

  } catch (err) {
    await clientConn.query('ROLLBACK');
    console.error('[COSTING] Update failed:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    clientConn.release();
  }
});

// Create one or more fixed-price jobs at once (quick quotation line items,
// skips the costing wizard), all attached to the same quotation.
router.post('/quick', authenticateToken, async (req, res) => {
  const { client_id, client, quotation_id, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }
  for (const item of items) {
    if (!item.name || !item.quantity || item.fixed_price === undefined || item.fixed_price === null || item.fixed_price === '') {
      return res.status(400).json({ error: 'Each item requires a name, quantity, and unit price' });
    }
  }
  if (!quotation_id && !client_id && (!client || !client.name || !client.margin_tier_id)) {
    return res.status(400).json({ error: 'An existing quotation or client, or a new client with name and margin tier, is required' });
  }

  const clientConn = await pool.connect();

  try {
    await clientConn.query('BEGIN');

    const { quotationId, clientId } = await resolveQuotationAndClient(clientConn, { quotation_id, client_id, client });

    const jobIds = [];
    for (const item of items) {
      const jobResult = await clientConn.query(
        `INSERT INTO jobs (client_id, quotation_id, name, description, quantity, pricing_mode, fixed_price, vat_option)
         VALUES ($1, $2, $3, $4, $5, 'fixed', $6, $7) RETURNING id`,
        [clientId, quotationId, item.name, item.description || '', item.quantity, toNumber(item.fixed_price), normalizeVatOption(item.vat_option)]
      );
      jobIds.push(jobResult.rows[0].id);
    }

    await clientConn.query('COMMIT');
    res.json({
      job_ids: jobIds,
      quotation_id: quotationId,
      message: `${jobIds.length} item${jobIds.length === 1 ? '' : 's'} saved successfully`
    });
  } catch (err) {
    await clientConn.query('ROLLBACK');
    console.error('[COSTING] Quick job creation failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    clientConn.release();
  }
});

// Update a fixed-price job
router.put('/quick/:jobId', authenticateToken, async (req, res) => {
  const { jobId } = req.params;
  const { job } = req.body;

  if (!job || !job.name || !job.quantity || job.fixed_price === undefined || job.fixed_price === null || job.fixed_price === '') {
    return res.status(400).json({ error: 'Job name, quantity, and unit price are required' });
  }

  try {
    const result = await pool.query(
      `UPDATE jobs SET name = $1, description = $2, quantity = $3, fixed_price = $4, vat_option = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND pricing_mode = 'fixed' RETURNING id`,
      [job.name, job.description || '', job.quantity, toNumber(job.fixed_price), normalizeVatOption(job.vat_option), jobId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fixed-price job not found' });
    }
    res.json({ job_id: result.rows[0].id, message: 'Fixed-price job updated successfully' });
  } catch (err) {
    console.error('[COSTING] Quick job update failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Internal cost breakdown PDF for one job — how the price was actually
// reached, unlike the client-facing quotation which only shows the total.
router.get('/:jobId/cost-sheet', authenticateToken, async (req, res) => {
  const { jobId } = req.params;

  try {
    const data = await getJobCostSheetData(pool, jobId);
    if (!data) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=cost_sheet_job_${jobId}.pdf`);
    doc.pipe(res);
    drawCostSheetPdf(doc, data);
    doc.end();
  } catch (err) {
    console.error('[COSTING] Cost sheet generation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
