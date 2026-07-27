// Shared helpers for building a quotation PDF from one or more job (line item) rows.
const fs = require('fs');
const path = require('path');

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

// Fetches a quotation, its client, and every job (line item) attached to it,
// each with the cost-breakdown rows needed to total a 'calculated' item.
async function getQuotationItemsData(pool, quotationId) {
  const quotationQuery = `
    SELECT q.*, c.name as client_name, c.type as client_type, c.address as client_address,
           c.contact as client_contact, c.email as client_email, mt.margin_percentage
    FROM quotations q
    JOIN clients c ON q.client_id = c.id
    JOIN margin_tiers mt ON c.margin_tier_id = mt.id
    WHERE q.id = $1
  `;
  const quotationResult = await pool.query(quotationQuery, [quotationId]);

  if (quotationResult.rows.length === 0) {
    return null;
  }

  const quotation = quotationResult.rows[0];
  const jobsResult = await pool.query('SELECT * FROM jobs WHERE quotation_id = $1 ORDER BY id', [quotationId]);

  const items = await Promise.all(jobsResult.rows.map(async (job) => {
    job.margin_percentage = quotation.margin_percentage;

    if (job.pricing_mode === 'fixed') {
      return { job, materials: [], machines: [], bindings: [], processes: [], additionalCosts: [] };
    }

    const [materials, machines, bindings, processes, additionalCosts] = await Promise.all([
      pool.query(`
        SELECT jm.*, m.name as material_name, m.unit_of_measure as unit
        FROM job_materials jm JOIN materials m ON jm.material_id = m.id WHERE jm.job_id = $1
      `, [job.id]),
      pool.query(`
        SELECT jm.*, m.name as machine_name
        FROM job_machines jm JOIN machines m ON jm.machine_id = m.id WHERE jm.job_id = $1
      `, [job.id]),
      pool.query(`
        SELECT jb.*, b.method as binding_name
        FROM job_bindings jb JOIN bindings b ON jb.binding_id = b.id WHERE jb.job_id = $1
      `, [job.id]),
      pool.query(`
        SELECT jsp.*, sp.name as process_name
        FROM job_special_processes jsp JOIN special_processes sp ON jsp.special_process_id = sp.id WHERE jsp.job_id = $1
      `, [job.id]),
      pool.query('SELECT * FROM job_additional_costs WHERE job_id = $1', [job.id])
    ]);

    return {
      job,
      materials: materials.rows,
      machines: machines.rows,
      bindings: bindings.rows,
      processes: processes.rows,
      additionalCosts: additionalCosts.rows
    };
  }));

  return { quotation, items };
}

// Totals for a single line item (fixed-price or fully-costed).
function calculateItemTotals(item) {
  const { job, materials, machines, bindings, processes, additionalCosts } = item;

  if (job.pricing_mode === 'fixed') {
    const unitPrice = toNumber(job.fixed_price);
    const sellingPrice = unitPrice * toNumber(job.quantity);
    const vatAmount = sellingPrice * 0.18;
    return {
      productionTotal: sellingPrice,
      commissionAmount: 0,
      marginAmount: 0,
      sellingPrice,
      vatAmount,
      finalTotal: sellingPrice + vatAmount,
      rate: unitPrice
    };
  }

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

function calculateGrandTotals(items) {
  return items.reduce((acc, item) => {
    const totals = calculateItemTotals(item);
    acc.sellingPrice += totals.sellingPrice;
    acc.vatAmount += totals.vatAmount;
    acc.finalTotal += totals.finalTotal;
    return acc;
  }, { sellingPrice: 0, vatAmount: 0, finalTotal: 0 });
}

function drawHorizontalLine(doc, x1, x2, y, width = 1) {
  doc.lineWidth(width).moveTo(x1, y).lineTo(x2, y).stroke();
}

function drawUnderlineField(doc, label, value, x, y, labelWidth, fieldWidth) {
  doc.font('Helvetica').fontSize(10).fillColor('black').text(label, x, y);
  doc.text(value || '', x + labelWidth, y, { width: fieldWidth, height: 14 });
  drawHorizontalLine(doc, x + labelWidth, x + labelWidth + fieldWidth, y + 14, 0.8);
}

// Draws every item in `data.items` as its own row in the quotation table,
// with one combined TOTAL GOODS / VAT / TOTAL block for the whole quotation.
function drawQuotationPdf(doc, quotationId, data) {
  const { quotation, items } = data;
  const logoPath = getLogoPath();
  const quoteNo = String(quotationId).padStart(6, '0');
  const quoteDate = new Date().toLocaleDateString('en-GB');
  const pageLeft = 34;
  const pageRight = 561;
  const pageWidth = pageRight - pageLeft;

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

  drawUnderlineField(doc, 'To:', quotation.client_name, pageLeft, 230, 24, 300);
  drawUnderlineField(doc, 'Enquiry Ref:', '', 350, 230, 70, 130);
  drawUnderlineField(doc, '', quotation.client_address || '', pageLeft + 24, 254, 0, 300);
  drawUnderlineField(doc, '', quotation.client_contact || '', 350, 254, 0, 200);
  drawUnderlineField(doc, '', quotation.client_email || '', pageLeft + 24, 278, 0, 300);
  drawHorizontalLine(doc, pageLeft, pageRight, 304, 1.4);

  doc.font('Helvetica').fontSize(11).text('Dear Sir/Madam,', pageLeft, 315);
  drawUnderlineField(doc, 'Date:', quoteDate, 392, 315, 34, 125);
  doc.text('Thank you for your valued enquiry for which we have pleasure in quoting as follows:', pageLeft, 337);

  const tableTop = 358;
  const tableLeft = pageLeft;
  const colWidths = [105, 215, 80, 125];
  const rowHeight = 23;
  const tableRows = Math.max(items.length, 1);
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
  const grandTotals = { sellingPrice: 0, vatAmount: 0, finalTotal: 0 };

  items.forEach((item, index) => {
    const totals = calculateItemTotals(item);
    grandTotals.sellingPrice += totals.sellingPrice;
    grandTotals.vatAmount += totals.vatAmount;
    grandTotals.finalTotal += totals.finalTotal;

    const description = [item.job.name, item.job.description].filter(Boolean).join(' - ');
    const itemY = tableTop + rowHeight * (index + 1) + 6;
    doc.text(formatUGX(item.job.quantity), colX[0] + 4, itemY, { width: colWidths[0] - 8, align: 'center' });
    doc.text(description || 'Printing services', colX[1] + 6, itemY, { width: colWidths[1] - 12, height: rowHeight - 4 });
    doc.text(formatUGX(totals.rate), colX[2] + 4, itemY, { width: colWidths[2] - 8, align: 'right' });
    doc.text(formatUGX(totals.sellingPrice), colX[3] + 4, itemY, { width: colWidths[3] - 8, align: 'right' });
  });

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
    ['TOTAL GOODS', grandTotals.sellingPrice],
    ['VAT', grandTotals.vatAmount],
    ['TOTAL', grandTotals.finalTotal]
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

module.exports = {
  toNumber,
  formatUGX,
  getLogoPath,
  getQuotationItemsData,
  calculateItemTotals,
  calculateGrandTotals,
  drawHorizontalLine,
  drawUnderlineField,
  drawQuotationPdf
};
