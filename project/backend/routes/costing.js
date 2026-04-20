// Costing routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;
const PDFDocument = require('pdfkit');

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

// Generate quotation PDF
router.get('/quotation/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    // Get job details with client information
    const jobQuery = `
      SELECT j.*, c.name as client_name, c.type as client_type, c.address as client_address,
             c.contact as client_contact, c.email as client_email, mt.margin_percentage
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      JOIN margin_tiers mt ON c.margin_tier_id = mt.id
      WHERE j.id = $1
    `;
    const jobResult = await pool.query(jobQuery, [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    // Get job materials
    const materialsQuery = `
      SELECT jm.*, m.name as material_name, m.unit_of_measure as unit
      FROM job_materials jm
      JOIN materials m ON jm.material_id = m.id
      WHERE jm.job_id = $1
    `;
    const materials = await pool.query(materialsQuery, [jobId]);

    // Get job machines
    const machinesQuery = `
      SELECT jm.*, m.name as machine_name
      FROM job_machines jm
      JOIN machines m ON jm.machine_id = m.id
      WHERE jm.job_id = $1
    `;
    const machines = await pool.query(machinesQuery, [jobId]);

    // Get job bindings
    const bindingsQuery = `
      SELECT jb.*, b.method as binding_name
      FROM job_bindings jb
      JOIN bindings b ON jb.binding_id = b.id
      WHERE jb.job_id = $1
    `;
    const bindings = await pool.query(bindingsQuery, [jobId]);

    // Get job special processes
    const processesQuery = `
      SELECT jsp.*, sp.name as process_name
      FROM job_special_processes jsp
      JOIN special_processes sp ON jsp.special_process_id = sp.id
      WHERE jsp.job_id = $1
    `;
    const processes = await pool.query(processesQuery, [jobId]);

    // Get additional costs
    const additionalCostsQuery = 'SELECT * FROM job_additional_costs WHERE job_id = $1';
    const additionalCosts = await pool.query(additionalCostsQuery, [jobId]);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation_${jobId}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('UGANDA PRINTING AND PUBLISHING CORPORATION', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('QUOTATION', { align: 'center' });
    doc.moveDown(2);

    // Quotation details
    doc.fontSize(12);
    doc.text(`Quotation No: Q${jobId.toString().padStart(4, '0')}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Client information
    doc.fontSize(14).text('CLIENT INFORMATION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Name: ${job.client_name}`);
    doc.text(`Type: ${job.client_type}`);
    if (job.client_address) doc.text(`Address: ${job.client_address}`);
    if (job.client_contact) doc.text(`Contact: ${job.client_contact}`);
    if (job.client_email) doc.text(`Email: ${job.client_email}`);
    doc.moveDown();

    // Job details
    doc.fontSize(14).text('JOB DETAILS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Job Name: ${job.name}`);
    if (job.description) doc.text(`Description: ${job.description}`);
    doc.text(`Quantity: ${job.quantity}`);
    if (job.page_size) doc.text(`Page Size: ${job.page_size}`);
    if (job.pages_per_copy) doc.text(`Pages per Copy: ${job.pages_per_copy}`);
    doc.moveDown();

    // Cost breakdown
    doc.fontSize(14).text('COST BREAKDOWN', { underline: true });
    doc.moveDown(0.5);

    let totalCost = 0;

    // Materials
    if (materials.rows.length > 0) {
      doc.fontSize(12).text('Materials:', { underline: true });
      materials.rows.forEach(material => {
        const subtotal = material.quantity * material.unit_cost;
        totalCost += subtotal;
        doc.text(`  ${material.material_name}: ${material.quantity} ${material.unit} @ UGX ${material.unit_cost.toLocaleString()} = UGX ${subtotal.toLocaleString()}`);
      });
      doc.moveDown(0.5);
    }

    // Machines
    if (machines.rows.length > 0) {
      doc.text('Machines:', { underline: true });
      machines.rows.forEach(machine => {
        const subtotal = machine.impressions * machine.cost_per_impression;
        totalCost += subtotal;
        doc.text(`  ${machine.machine_name}: ${machine.impressions} impressions @ UGX ${machine.cost_per_impression.toLocaleString()} = UGX ${subtotal.toLocaleString()}`);
      });
      doc.moveDown(0.5);
    }

    // Bindings
    if (bindings.rows.length > 0) {
      doc.text('Bindings:', { underline: true });
      bindings.rows.forEach(binding => {
        const subtotal = binding.copies * binding.cost_per_copy;
        totalCost += subtotal;
        doc.text(`  ${binding.binding_name}: ${binding.copies} copies @ UGX ${binding.cost_per_copy.toLocaleString()} = UGX ${subtotal.toLocaleString()}`);
      });
      doc.moveDown(0.5);
    }

    // Special Processes
    if (processes.rows.length > 0) {
      doc.text('Special Processes:', { underline: true });
      processes.rows.forEach(process => {
        const subtotal = process.quantity * process.cost_per_unit;
        totalCost += subtotal;
        doc.text(`  ${process.process_name}: ${process.quantity} @ UGX ${process.cost_per_unit.toLocaleString()} = UGX ${subtotal.toLocaleString()}`);
      });
      doc.moveDown(0.5);
    }

    // Additional Costs
    if (additionalCosts.rows.length > 0) {
      const costs = additionalCosts.rows[0];
      doc.text('Additional Costs:', { underline: true });

      if (costs.design_hours > 0) {
        const designTotal = costs.design_hours * costs.design_rate;
        totalCost += designTotal;
        doc.text(`  Design: ${costs.design_hours} hours @ UGX ${costs.design_rate.toLocaleString()} = UGX ${designTotal.toLocaleString()}`);
      }

      if (costs.typesetting_hours > 0) {
        const typesettingTotal = costs.typesetting_hours * costs.typesetting_rate;
        totalCost += typesettingTotal;
        doc.text(`  Typesetting: ${costs.typesetting_hours} hours @ UGX ${costs.typesetting_rate.toLocaleString()} = UGX ${typesettingTotal.toLocaleString()}`);
      }

      if (costs.storage_cost > 0) {
        totalCost += costs.storage_cost;
        doc.text(`  Storage: UGX ${costs.storage_cost.toLocaleString()}`);
      }

      if (costs.transport_cost > 0) {
        totalCost += costs.transport_cost;
        doc.text(`  Transport: UGX ${costs.transport_cost.toLocaleString()}`);
      }

      if (costs.overhead_cost > 0) {
        totalCost += costs.overhead_cost;
        doc.text(`  Overhead: UGX ${costs.overhead_cost.toLocaleString()}`);
      }

      doc.moveDown(0.5);
    }

    // Total before margin
    doc.fontSize(14).text(`Total Cost: UGX ${totalCost.toLocaleString()}`, { underline: true });
    doc.moveDown(0.5);

    // Apply margin
    const marginAmount = totalCost * (job.margin_percentage / 100);
    const finalTotal = totalCost + marginAmount;

    doc.text(`Margin (${job.margin_percentage}%): UGX ${marginAmount.toLocaleString()}`);
    doc.moveDown();
    doc.fontSize(16).text(`FINAL QUOTE: UGX ${finalTotal.toLocaleString()}`, { bold: true });

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text('This quotation is valid for 30 days from the date of issue.', { align: 'center' });
    doc.text('Terms and conditions apply.', { align: 'center' });

    // Finalize PDF
    doc.end();

  } catch (err) {
    console.error('[QUOTATION] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;