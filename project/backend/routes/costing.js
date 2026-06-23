// Costing routes
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('./auth');

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatUGX(value) {
  return toNumber(value).toLocaleString();
}

function getLogoPath() {
  const logoPath = path.join(__dirname, '..', '..', 'UPPC-LOGO.png');
  return fs.existsSync(logoPath) ? logoPath : null;
}

async function getQuotationData(jobId) {
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
    return null;
  }

  const [materials, machines, bindings, processes, additionalCosts] = await Promise.all([
    pool.query(`
      SELECT jm.*, m.name as material_name, m.unit_of_measure as unit
      FROM job_materials jm
      JOIN materials m ON jm.material_id = m.id
      WHERE jm.job_id = $1
    `, [jobId]),
    pool.query(`
      SELECT jm.*, m.name as machine_name
      FROM job_machines jm
      JOIN machines m ON jm.machine_id = m.id
      WHERE jm.job_id = $1
    `, [jobId]),
    pool.query(`
      SELECT jb.*, b.method as binding_name
      FROM job_bindings jb
      JOIN bindings b ON jb.binding_id = b.id
      WHERE jb.job_id = $1
    `, [jobId]),
    pool.query(`
      SELECT jsp.*, sp.name as process_name
      FROM job_special_processes jsp
      JOIN special_processes sp ON jsp.special_process_id = sp.id
      WHERE jsp.job_id = $1
    `, [jobId]),
    pool.query('SELECT * FROM job_additional_costs WHERE job_id = $1', [jobId])
  ]);

  return {
    job: jobResult.rows[0],
    materials: materials.rows,
    machines: machines.rows,
    bindings: bindings.rows,
    processes: processes.rows,
    additionalCosts: additionalCosts.rows
  };
}

function calculateQuotationTotals(data) {
  const { job, materials, machines, bindings, processes, additionalCosts } = data;
  let productionTotal = 0;

  materials.forEach(material => {
    productionTotal += toNumber(material.quantity) * toNumber(material.unit_cost);
  });

  machines.forEach(machine => {
    productionTotal += (toNumber(machine.impressions) * toNumber(machine.cost_per_impression)) + toNumber(machine.setup_cost);
  });

  bindings.forEach(binding => {
    productionTotal += binding.cost !== null && binding.cost !== undefined
      ? toNumber(binding.cost)
      : toNumber(binding.copies) * toNumber(binding.cost_per_copy);
  });

  processes.forEach(process => {
    productionTotal += toNumber(process.quantity) * toNumber(process.cost_per_unit);
  });

  if (additionalCosts.length > 0) {
    const costs = additionalCosts[0];
    productionTotal += toNumber(costs.design_pages) * toNumber(costs.design_rate);
    productionTotal += toNumber(costs.typesetting_pages) * toNumber(costs.typesetting_rate);
    productionTotal += toNumber(costs.ctp_cost);
    productionTotal += toNumber(costs.wastage_cost);
    productionTotal += toNumber(costs.subcontract_cost);
    productionTotal += toNumber(costs.storage_cost);
    productionTotal += toNumber(costs.transport_cost);
    productionTotal += toNumber(costs.overhead_cost);
    productionTotal += toNumber(costs.special_processes_total);
  }

  const additionalCostRow = additionalCosts[0] || {};
  const commissionAmount = toNumber(additionalCostRow.commission_cost);
  const marginAmount = productionTotal * (toNumber(job.margin_percentage) / 100);
  const sellingPrice = productionTotal + commissionAmount + marginAmount;
  const vatAmount = sellingPrice * 0.18;

  return {
    productionTotal,
    commissionAmount,
    marginAmount,
    sellingPrice,
    vatAmount,
    finalTotal: sellingPrice + vatAmount,
    rate: toNumber(job.quantity) > 0 ? sellingPrice / toNumber(job.quantity) : sellingPrice
  };
}

function drawHorizontalLine(doc, x1, x2, y, width = 1) {
  doc.lineWidth(width).moveTo(x1, y).lineTo(x2, y).stroke();
}

function drawUnderlineField(doc, label, value, x, y, labelWidth, fieldWidth) {
  doc.font('Helvetica').fontSize(10).fillColor('black').text(label, x, y);
  doc.text(value || '', x + labelWidth, y, { width: fieldWidth, height: 14 });
  drawHorizontalLine(doc, x + labelWidth, x + labelWidth + fieldWidth, y + 14, 0.8);
}

function drawQuotationPdf(doc, jobId, data) {
  const { job } = data;
  const totals = calculateQuotationTotals(data);
  const logoPath = getLogoPath();
  const quoteNo = String(jobId).padStart(6, '0');
  const quoteDate = new Date().toLocaleDateString('en-GB');
  const pageLeft = 34;
  const pageRight = 561;
  const pageWidth = pageRight - pageLeft;
  const description = [job.name, job.description].filter(Boolean).join(' - ');

  doc.fillColor('black').lineJoin('miter');

  if (logoPath) {
    doc.image(logoPath, 246, 24, { fit: [105, 54], align: 'center' });
  }

  doc.font('Helvetica').fontSize(22).text('UGANDA', pageLeft, 82, { width: pageWidth, align: 'center' });
  doc.fontSize(21).text('PRINTING AND PUBLISHING', pageLeft, 109, { width: pageWidth, align: 'center' });
  doc.fontSize(21).text('CORPORATION', pageLeft, 135, { width: pageWidth, align: 'center' });
  doc.fontSize(8.8).text(
    'P.O. Box 33, Entebbe, Uganda, Telephones: 0414-320639, Toll-Free: 0800111467, WhatsApp: +256783914332',
    pageLeft,
    164,
    { width: pageWidth, align: 'center' }
  );
  drawHorizontalLine(doc, pageLeft, pageRight, 181, 1.4);

  doc.font('Helvetica-Bold').fontSize(18).text('QUOTATION', pageLeft, 190, { width: pageWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(17).fillColor('#b41414').text(quoteNo, 456, 190, { width: 80, align: 'center' });
  doc.fillColor('black');
  drawHorizontalLine(doc, pageLeft, pageRight, 215, 1.4);

  drawUnderlineField(doc, 'To:', job.client_name, pageLeft, 230, 24, 300);
  drawUnderlineField(doc, 'Enquiry Ref:', '', 350, 230, 70, 130);
  drawUnderlineField(doc, '', job.client_address || '', pageLeft + 24, 254, 0, 300);
  drawUnderlineField(doc, '', job.client_contact || '', 350, 254, 0, 200);
  drawUnderlineField(doc, '', job.client_email || '', pageLeft + 24, 278, 0, 300);
  drawHorizontalLine(doc, pageLeft, pageRight, 304, 1.4);

  doc.font('Helvetica').fontSize(11).text('Dear Sir/Madam,', pageLeft, 315);
  drawUnderlineField(doc, 'Date:', quoteDate, 392, 315, 34, 125);
  doc.text('Thank you for your valued enquiry for which we have pleasure in quoting as follows:', pageLeft, 337);

  const tableTop = 358;
  const tableLeft = pageLeft;
  const colWidths = [105, 215, 80, 125];
  const rowHeight = 23;
  const tableRows = 13;
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  const tableBottom = tableTop + rowHeight * (tableRows + 1);
  const colX = [
    tableLeft,
    tableLeft + colWidths[0],
    tableLeft + colWidths[0] + colWidths[1],
    tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
    tableLeft + tableWidth
  ];

  doc.lineWidth(1.1).rect(tableLeft, tableTop, tableWidth, rowHeight * (tableRows + 1)).stroke();
  for (let i = 1; i < colX.length - 1; i++) {
    doc.moveTo(colX[i], tableTop).lineTo(colX[i], tableBottom).stroke();
  }
  for (let i = 1; i <= tableRows + 1; i++) {
    doc.moveTo(tableLeft, tableTop + i * rowHeight).lineTo(tableLeft + tableWidth, tableTop + i * rowHeight).stroke();
  }

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Quantity', colX[0], tableTop + 6, { width: colWidths[0], align: 'center' });
  doc.text('Description', colX[1], tableTop + 6, { width: colWidths[1], align: 'center' });
  doc.text('Rate', colX[2], tableTop + 6, { width: colWidths[2], align: 'center' });
  doc.text('Price', colX[3], tableTop + 6, { width: colWidths[3], align: 'center' });

  doc.font('Helvetica').fontSize(10);
  const itemY = tableTop + rowHeight + 6;
  doc.text(formatUGX(job.quantity), colX[0] + 4, itemY, { width: colWidths[0] - 8, align: 'center' });
  doc.text(description || 'Printing services', colX[1] + 6, itemY, { width: colWidths[1] - 12, height: rowHeight * 2 - 4 });
  doc.text(formatUGX(totals.rate), colX[2] + 4, itemY, { width: colWidths[2] - 8, align: 'right' });
  doc.text(formatUGX(totals.sellingPrice), colX[3] + 4, itemY, { width: colWidths[3] - 8, align: 'right' });

  const totalsTop = tableBottom + 10;
  doc.font('Helvetica-Bold').fontSize(8.5).text(
    'THIS QUOTATION IS VALID FOR THIRTY DAYS FROM THE DATE HEREON\nAND IS SUBJECT TO THE CONDITIONS PRINTED OVERLEAF\nE&O.E.',
    pageLeft,
    totalsTop + 8,
    { width: 310, lineGap: 2 }
  );

  const totalLabelX = 360;
  const totalBoxX = 438;
  const totalBoxW = 123;
  const totalBoxH = 24;
  const totalRows = [
    ['TOTAL GOODS', totals.sellingPrice],
    ['VAT', totals.vatAmount],
    ['TOTAL', totals.finalTotal]
  ];
  doc.font('Helvetica').fontSize(12);
  totalRows.forEach(([label, value], index) => {
    const y = totalsTop + index * 35;
    doc.text(label, totalLabelX, y + 6, { width: 70, align: 'right' });
    doc.rect(totalBoxX, y, totalBoxW, totalBoxH).stroke();
    doc.font('Helvetica-Bold').fontSize(10).text(formatUGX(value), totalBoxX + 6, y + 7, { width: totalBoxW - 12, align: 'right' });
    doc.font('Helvetica').fontSize(12);
  });

  const footerTop = totalsTop + 118;
  doc.font('Helvetica').fontSize(11);
  doc.text('Delivery', pageLeft, footerTop);
  drawHorizontalLine(doc, pageLeft + 48, pageLeft + 358, footerTop + 14, 0.8);
  doc.text('from receipt of order at factory', pageLeft + 364, footerTop);
  doc.text('Terms', pageLeft, footerTop + 28);
  drawHorizontalLine(doc, pageLeft + 48, pageRight, footerTop + 42, 0.8);
  doc.text('Special conditions', pageLeft, footerTop + 56);
  drawHorizontalLine(doc, pageLeft + 111, pageRight, footerTop + 70, 0.8);
  drawHorizontalLine(doc, pageLeft, pageRight, footerTop + 94, 0.8);
  doc.text('Yours faithfully,', pageLeft, footerTop + 118);
  doc.text('for UGANDA PRINTING AND PUBLISHING CORPORATION', pageLeft, footerTop + 143);
}

// Submit comprehensive costing
router.post('/', authenticateToken, async (req, res) => {
  console.log('[COSTING] POST /api/costing - Request received');

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
        const bindingCost = toNumber(bind.cost);
        await clientConn.query(
          'INSERT INTO job_bindings (job_id, binding_id, copies, cost, cost_per_copy, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
          [jobId, bind.binding_id, 1, bindingCost, bindingCost, bindingCost]
        );
      }
      console.log('[COSTING] Inserted bindings:', binding.bindings.length);
    }

    // 7. Insert additional costs
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
      const optionalAdditionalColumns = ['ctp_cost', 'commission_cost', 'overhead_percent', 'overhead_cost', 'special_processes_total'];

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
router.get('/quotation/:jobId', authenticateToken, async (req, res) => {
  const { jobId } = req.params;

  try {
    const data = await getQuotationData(jobId);

    if (!data) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 0
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation_${jobId}.pdf`);
    doc.pipe(res);
    drawQuotationPdf(doc, jobId, data);
    doc.end();

  } catch (err) {
    console.error('[QUOTATION] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
