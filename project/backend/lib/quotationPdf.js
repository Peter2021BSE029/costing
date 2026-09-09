// Shared helpers for building a quotation PDF from one or more job (line item) rows.
const fs = require('fs');
const path = require('path');

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatUGX(value) {
  // Cap at 2 decimals — without this, VAT-inclusive back-calculated amounts
  // (division results) can show 3+ decimal digits from floating point.
  return toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getLogoPath() {
  const logoPath = path.join(__dirname, '..', '..', 'images', 'UPPC_NEW_LOGO_2026.png');
  return fs.existsSync(logoPath) ? logoPath : null;
}

// Fetches the cost-breakdown rows (materials, machines, bindings, processes,
// additional costs) for one job. `job.margin_percentage` must already be set.
// Fixed-price jobs have no breakdown to fetch — they're just qty x unit price.
async function fetchJobCostBreakdown(pool, job) {
  if (job.pricing_mode === 'fixed') {
    return { job, materials: [], machines: [], bindings: [], processes: [], additionalCosts: [] };
  }

  const [materials, machines, bindings, processes, additionalCosts] = await Promise.all([
    pool.query(`
      SELECT jm.*, m.name as material_name, m.category as material_category, m.unit_of_measure as unit
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
}

// Fetches a quotation, its client, and every job (line item) attached to it,
// each with the cost-breakdown rows needed to total a 'calculated' item.
async function getQuotationItemsData(pool, quotationId) {
  const quotationQuery = `
    SELECT q.*, c.name as client_name, c.type as client_type, c.address as client_address,
           c.contact as client_contact, c.email as client_email, mt.margin_percentage,
           u.full_name as costed_by_full_name, u.username as costed_by_username
    FROM quotations q
    JOIN clients c ON q.client_id = c.id
    JOIN margin_tiers mt ON c.margin_tier_id = mt.id
    LEFT JOIN users u ON q.created_by = u.id
    WHERE q.id = $1
  `;
  const quotationResult = await pool.query(quotationQuery, [quotationId]);

  if (quotationResult.rows.length === 0) {
    return null;
  }

  const quotation = quotationResult.rows[0];
  const jobsResult = await pool.query('SELECT * FROM jobs WHERE quotation_id = $1 ORDER BY id', [quotationId]);
  const contactsResult = await pool.query(
    'SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY id',
    [quotation.client_id]
  );
  quotation.contacts = contactsResult.rows;

  const items = await Promise.all(jobsResult.rows.map(async (job) => {
    job.margin_percentage = quotation.margin_percentage;
    return fetchJobCostBreakdown(pool, job);
  }));

  return { quotation, items };
}

// Fetches one job with its client/margin info and full cost breakdown, for
// the internal Cost Sheet PDF (shows how the price was actually reached).
async function getJobCostSheetData(pool, jobId) {
  const jobQuery = `
    SELECT j.*, c.name as client_name, c.type as client_type,
           mt.tier_name, mt.margin_percentage
    FROM jobs j
    JOIN clients c ON j.client_id = c.id
    LEFT JOIN margin_tiers mt ON c.margin_tier_id = mt.id
    WHERE j.id = $1
  `;
  const jobResult = await pool.query(jobQuery, [jobId]);

  if (jobResult.rows.length === 0) {
    return null;
  }

  return fetchJobCostBreakdown(pool, jobResult.rows[0]);
}

// Totals for a single line item (fixed-price or fully-costed).
function calculateItemTotals(item) {
  const { job, materials, machines, bindings, processes, additionalCosts } = item;

  if (job.pricing_mode === 'fixed') {
    const unitPrice = toNumber(job.fixed_price);
    const quantity = toNumber(job.quantity);
    let sellingPrice;
    let vatAmount;

    if (job.vat_option === 'inclusive') {
      // The entered price already has 18% VAT baked in, so back it out
      // instead of adding it again on top.
      const grossTotal = unitPrice * quantity;
      sellingPrice = grossTotal / 1.18;
      vatAmount = grossTotal - sellingPrice;
    } else {
      sellingPrice = unitPrice * quantity;
      vatAmount = sellingPrice * 0.18;
    }

    return {
      productionTotal: sellingPrice,
      commissionAmount: 0,
      marginAmount: 0,
      sellingPrice,
      vatAmount,
      finalTotal: sellingPrice + vatAmount,
      rate: quantity > 0 ? sellingPrice / quantity : sellingPrice
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

function drawUnderlineField(doc, label, value, x, y, labelWidth, fieldWidth, valueColor = 'black') {
  doc.font('Helvetica').fontSize(10).fillColor('black').text(label, x, y);
  doc.fillColor(valueColor).text(value || '', x + labelWidth, y, { width: fieldWidth, height: 14 });
  doc.fillColor('black');
  drawHorizontalLine(doc, x + labelWidth, x + labelWidth + fieldWidth, y + 14, 0.8);
}

// One line listing every contact person for the client, starting from the
// left margin. Falls back to the client's legacy single contact/email
// (pre-dating multi-contact support) when it has no client_contacts rows.
function formatContactsLine(quotation) {
  const contacts = Array.isArray(quotation.contacts) ? quotation.contacts : [];
  const formatted = contacts
    .map(c => [c.name, c.phone, c.email].filter(Boolean).join(' - '))
    .filter(Boolean);
  if (formatted.length > 0) {
    return formatted.join('; ');
  }
  return [quotation.client_contact, quotation.client_email].filter(Boolean).join(' - ');
}

// A material row counts as "paper" using the same category heuristic the
// costing wizard already uses client-side (app.js `isPaperMaterial`) to tell
// paper stock apart from plates/envelopes in the same job.
function isPaperMaterial(material) {
  const category = (material.material_category || material.category || '').toString().toLowerCase();
  const excluded = ['plate', 'plates', 'envelope', 'envelopes'];
  if (excluded.some(word => category.includes(word))) return false;
  return ['paper', 'stock', 'card', 'cardstock', 'board'].some(word => category.includes(word));
}

// Drafts one job's spec clause from real job data (page size, pages, paper
// stock, binding, finishing processes). Anything not tracked in the data
// model (e.g. cover/text colour) is left for the agent to add by hand.
function buildItemSpecClause(item) {
  const { job, materials = [], bindings = [], processes = [] } = item;
  const parts = [];

  if (job.page_size) parts.push(`${job.page_size} size`);
  if (job.pages_per_copy) parts.push(`${job.pages_per_copy}Pgs`);

  const paperNames = materials.filter(isPaperMaterial).map(m => m.material_name).filter(Boolean);
  if (paperNames.length > 0) parts.push(`Printed on ${paperNames.join(', ')}`);

  const bindingNames = bindings.map(b => b.binding_name).filter(Boolean);
  if (bindingNames.length > 0) parts.push(bindingNames.join(', '));

  const processNames = processes.map(p => p.process_name).filter(Boolean);
  if (processNames.length > 0) parts.push(processNames.join(', '));

  return parts.join(', ');
}

// Drafts a full job-specification summary across every line item on a
// quotation, for the agent to review/edit before it's saved and printed.
function buildJobSpecSummary(items) {
  const clauses = items
    .map((item, index) => {
      const clause = buildItemSpecClause(item);
      if (!clause) return null;
      return items.length > 1 ? `Item ${index + 1} (${item.job.name}): ${clause}` : clause;
    })
    .filter(Boolean);
  return clauses.join('; ');
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

  // The logo image already carries the full wordmark ("UGANDA PRINTING AND
  // PUBLISHING CORPORATION" + "UNDER THE OFFICE OF THE PRESIDENT"), so it's
  // shown large and centered here instead of redrawing that text separately.
  // Kept compact so quotations with many line items have more room above the footer.
  const logoBoxWidth = 260;
  const logoBoxHeight = 94;
  const logoX = pageLeft + (pageWidth - logoBoxWidth) / 2;
  const logoTop = 12;
  if (logoPath) {
    doc.image(logoPath, logoX, logoTop, { fit: [logoBoxWidth, logoBoxHeight], align: 'center' });
  }

  const contactTop = logoTop + logoBoxHeight + 4;
  doc.font('Helvetica').fontSize(7.5).text(
    'P.O. Box 33, Entebbe, Uganda\n' +
    'Tel: 0326520250 | Toll-Free: 0800205520 | WhatsApp: +256 783 914 332\n' +
    'Email: info@uppc.go.ug | Web: www.uppc.go.ug',
    pageLeft,
    contactTop,
    { width: pageWidth, align: 'center', lineGap: 1 }
  );

  // Everything below the header hangs off this one line's position, so the
  // rest of the layout shifts down automatically when the header grows.
  const headerRuleY = contactTop + 34;
  const headerShift = headerRuleY - 181;
  drawHorizontalLine(doc, pageLeft, pageRight, headerRuleY, 1.4);

  doc.font('Helvetica-Bold').fontSize(18).text('QUOTATION', pageLeft, 190 + headerShift, { width: pageWidth, align: 'center' });
  drawHorizontalLine(doc, pageLeft, pageRight, 215 + headerShift, 1.4);

  drawUnderlineField(doc, 'To:', quotation.client_name, pageLeft, 230 + headerShift, 24, 300);
  drawUnderlineField(doc, 'Enquiry Ref:', quoteNo, 350, 230 + headerShift, 70, 130, '#b41414');
  drawUnderlineField(doc, '', quotation.client_address || '', pageLeft + 24, 254 + headerShift, 0, pageWidth - 24);
  drawUnderlineField(doc, 'Contact:', formatContactsLine(quotation), pageLeft, 278 + headerShift, 46, pageWidth - 46);
  drawHorizontalLine(doc, pageLeft, pageRight, 304 + headerShift, 1.4);

  // The job specification block wraps to however many lines it needs, so
  // everything below it (intro paragraph, item table, totals, footer) is
  // positioned from a running cursor instead of fixed offsets.
  let cursorY = 304 + headerShift + 11;
  if (quotation.job_spec_summary) {
    doc.font('Helvetica-Bold').fontSize(9).text('Job Specification:', pageLeft, cursorY);
    const specBodyY = cursorY + 12;
    doc.font('Helvetica').fontSize(9);
    const specHeight = doc.heightOfString(quotation.job_spec_summary, { width: pageWidth, lineGap: 1 });
    doc.text(quotation.job_spec_summary, pageLeft, specBodyY, { width: pageWidth, lineGap: 1 });
    cursorY = specBodyY + specHeight + 10;
  }

  const dearSirY = cursorY;
  doc.font('Helvetica').fontSize(11).text('Dear Sir/Madam,', pageLeft, dearSirY);
  drawUnderlineField(doc, 'Date:', quoteDate, 392, dearSirY, 34, 125);
  doc.text('Thank you for your valued enquiry for which we have pleasure in quoting as follows:', pageLeft, dearSirY + 22);

  const tableTop = dearSirY + 43;
  const tableLeft = pageLeft;
  const colWidths = [105, 215, 80, 125];
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  const colX = [
    tableLeft,
    tableLeft + colWidths[0],
    tableLeft + colWidths[0] + colWidths[1],
    tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
    tableLeft + tableWidth
  ];
  // Bottom margin every page (including continuation pages) stops drawing
  // above, so a row/block is never sliced in half by a page boundary.
  const pageBottomLimit = doc.page.height - 40;
  const headerRowHeight = 26;

  function drawRowFrame(y, height) {
    doc.lineWidth(1.1).rect(tableLeft, y, tableWidth, height).stroke();
    for (let i = 1; i < colX.length - 1; i++) {
      doc.moveTo(colX[i], y).lineTo(colX[i], y + height).stroke();
    }
  }

  function drawTableHeaderRow(y) {
    drawRowFrame(y, headerRowHeight);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black');
    doc.text('Quantity', colX[0], y + 7, { width: colWidths[0], align: 'center' });
    doc.text('Description', colX[1], y + 7, { width: colWidths[1], align: 'center' });
    doc.text('Rate', colX[2], y + 7, { width: colWidths[2], align: 'center' });
    doc.text('Price', colX[3], y + 7, { width: colWidths[3], align: 'center' });
    return y + headerRowHeight;
  }

  // A fresh page for when the item table itself runs past one page — a
  // light continuation heading plus a repeated column header, not the full
  // logo block (that only ever prints once, on the first page).
  function startContinuationPage() {
    doc.addPage();
    doc.fillColor('black');
    doc.font('Helvetica-Bold').fontSize(12).text(`QUOTATION ${quoteNo} (continued)`, pageLeft, 28, { width: pageWidth, align: 'center' });
    doc.font('Helvetica').fontSize(9).text(quotation.client_name || '', pageLeft, 46, { width: pageWidth, align: 'center' });
    return drawTableHeaderRow(70);
  }

  cursorY = drawTableHeaderRow(tableTop);
  const grandTotals = { sellingPrice: 0, vatAmount: 0, finalTotal: 0 };
  const minRowHeight = 23;

  items.forEach((item) => {
    const totals = calculateItemTotals(item);
    grandTotals.sellingPrice += totals.sellingPrice;
    grandTotals.vatAmount += totals.vatAmount;
    grandTotals.finalTotal += totals.finalTotal;

    const description = [item.job.name, item.job.description].filter(Boolean).join(' - ') || 'Printing services';
    doc.font('Helvetica').fontSize(10);
    const descHeight = doc.heightOfString(description, { width: colWidths[1] - 12, lineGap: 1 });
    const rowHeight = Math.max(minRowHeight, descHeight + 8);

    // Keep the whole row together on one page — an item's description never
    // gets split across a page break, even if that leaves blank space below
    // the last row on the page before it.
    if (cursorY + rowHeight > pageBottomLimit) {
      cursorY = startContinuationPage();
    }

    drawRowFrame(cursorY, rowHeight);
    const singleLineY = cursorY + (rowHeight - 12) / 2;
    doc.font('Helvetica').fontSize(10).fillColor('black');
    doc.text(formatUGX(item.job.quantity), colX[0] + 4, singleLineY, { width: colWidths[0] - 8, align: 'center' });
    doc.text(description, colX[1] + 6, cursorY + 5, { width: colWidths[1] - 12, lineGap: 1 });
    doc.text(formatUGX(totals.rate), colX[2] + 4, singleLineY, { width: colWidths[2] - 8, align: 'right' });
    doc.text(formatUGX(totals.sellingPrice), colX[3] + 4, singleLineY, { width: colWidths[3] - 8, align: 'right' });

    cursorY += rowHeight;
  });

  // The totals box (validity note + TOTAL GOODS/VAT/TOTAL) stays with the
  // item table whenever it fits — only the longer footer below it (Delivery
  // onward: terms, special conditions, signature, costed-by) moves to a
  // fresh page on its own if there isn't room, rather than dragging the
  // totals along with it unnecessarily.
  const TOTALS_BLOCK_HEIGHT = 115;
  if (cursorY + TOTALS_BLOCK_HEIGHT > pageBottomLimit) {
    doc.addPage();
    doc.fillColor('black');
    cursorY = 40;
  }

  const totalsTop = cursorY + 10;
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

  // The footer (Delivery through the "Costed by" line) is its own atomic
  // block — pushed to a fresh page as a whole if it can't fit below the
  // totals box, instead of splitting partway through.
  const FOOTER_BLOCK_HEIGHT = 180;
  let footerTop = totalsTop + 118;
  if (footerTop + FOOTER_BLOCK_HEIGHT > pageBottomLimit) {
    doc.addPage();
    doc.fillColor('black');
    footerTop = 40;
  }
  doc.font('Helvetica').fontSize(11);

  // Blank space between the label and the fixed trailing phrase is where the
  // entered delivery timeframe (e.g. "2 weeks") goes, same as the original
  // hand-filled layout.
  doc.text('Delivery', pageLeft, footerTop);
  if (quotation.delivery_text) {
    doc.fontSize(10).text(quotation.delivery_text, pageLeft + 52, footerTop + 1, { width: 300, height: 13, ellipsis: true });
  }
  doc.fontSize(11).text('from receipt of order at factory', pageLeft + 364, footerTop);

  doc.fontSize(11).text('Terms', pageLeft, footerTop + 28);
  if (quotation.terms_text) {
    doc.fontSize(10).text(quotation.terms_text, pageLeft + 48, footerTop + 29, { width: pageRight - pageLeft - 48, height: 13, ellipsis: true });
  }

  doc.fontSize(11).text('Special conditions', pageLeft, footerTop + 56);
  if (quotation.special_conditions_text) {
    doc.fontSize(10).text(quotation.special_conditions_text, pageLeft + 111, footerTop + 57, { width: pageRight - pageLeft - 111, height: 13, ellipsis: true });
  }

  drawHorizontalLine(doc, pageLeft + 48, pageLeft + 358, footerTop + 14, 0.8);
  drawHorizontalLine(doc, pageLeft + 48, pageRight, footerTop + 42, 0.8);
  drawHorizontalLine(doc, pageLeft + 111, pageRight, footerTop + 70, 0.8);
  drawHorizontalLine(doc, pageLeft, pageRight, footerTop + 94, 0.8);

  doc.font('Helvetica').fontSize(11);
  doc.text('Yours faithfully,', pageLeft, footerTop + 118);
  doc.text('for UGANDA PRINTING AND PUBLISHING CORPORATION', pageLeft, footerTop + 143);

  // The manually-typed name takes priority for now — most accounts are still
  // shared logins, so it's the more reliable source until this is wired up
  // to pick the name from the logged-in account automatically.
  const costedByName = quotation.costing_agent_name || quotation.costed_by_full_name || quotation.costed_by_username;
  if (costedByName) {
    doc.fontSize(9).text(`Costed by: ${costedByName}`, pageLeft, footerTop + 161);
  }
}

module.exports = {
  toNumber,
  formatUGX,
  getLogoPath,
  getQuotationItemsData,
  getJobCostSheetData,
  calculateItemTotals,
  calculateGrandTotals,
  buildJobSpecSummary,
  drawHorizontalLine,
  drawUnderlineField,
  drawQuotationPdf
};
