// Internal "how did we get this price" document for one job: every material,
// machine, binding, process, and additional cost that fed into the total,
// unlike the client-facing quotation which only shows the final price.
const { toNumber, formatUGX, getLogoPath, calculateItemTotals } = require('./quotationPdf');

const PAGE_LEFT = 40;
const PAGE_RIGHT = 555;
const PAGE_BOTTOM = 780;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;

function ensureSpace(doc, y, needed) {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return 40;
  }
  return y;
}

function sectionHeading(doc, y, text) {
  y = ensureSpace(doc, y, 30);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1d1d1b').text(text, PAGE_LEFT, y);
  doc.moveTo(PAGE_LEFT, y + 16).lineTo(PAGE_RIGHT, y + 16).lineWidth(0.8).strokeColor('#ccc').stroke();
  return y + 24;
}

// Draws a simple table with automatic page-break handling per row.
// columns: [{ label, width, align, key, format }]
function drawTable(doc, y, columns, rows, totalLabel, totalValue) {
  const rowHeight = 18;
  y = ensureSpace(doc, y, rowHeight * 2);

  let x = PAGE_LEFT;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#555');
  columns.forEach(col => {
    doc.text(col.label, x, y, { width: col.width, align: col.align || 'left' });
    x += col.width;
  });
  y += rowHeight;
  doc.moveTo(PAGE_LEFT, y - 4).lineTo(PAGE_RIGHT, y - 4).lineWidth(0.5).strokeColor('#ddd').stroke();

  doc.font('Helvetica').fontSize(9.5).fillColor('#1d1d1b');
  rows.forEach(row => {
    y = ensureSpace(doc, y, rowHeight);
    x = PAGE_LEFT;
    columns.forEach(col => {
      const raw = row[col.key];
      const text = col.format ? col.format(raw, row) : (raw ?? '');
      doc.text(String(text), x, y, { width: col.width, align: col.align || 'left' });
      x += col.width;
    });
    y += rowHeight;
  });

  y = ensureSpace(doc, y, rowHeight + 4);
  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).lineWidth(0.5).strokeColor('#ddd').stroke();
  y += 4;
  doc.font('Helvetica-Bold').fontSize(9.5);
  doc.text(totalLabel, PAGE_LEFT, y, { width: PAGE_WIDTH - 110, align: 'right' });
  doc.text(`UGX ${formatUGX(totalValue)}`, PAGE_RIGHT - 110, y, { width: 110, align: 'right' });
  return y + 22;
}

function summaryLine(doc, y, label, value, { bold = false, indent = 0 } = {}) {
  y = ensureSpace(doc, y, 18);
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10.5).fillColor('#1d1d1b');
  doc.text(label, PAGE_LEFT + indent, y, { width: PAGE_WIDTH - 130 - indent });
  doc.text(`UGX ${formatUGX(value)}`, PAGE_RIGHT - 130, y, { width: 130, align: 'right' });
  return y + 18;
}

function drawCostSheetPdf(doc, data) {
  const { job, materials, machines, bindings, additionalCosts } = data;
  const totals = calculateItemTotals(data);
  const logoPath = getLogoPath();

  let y = 40;

  if (logoPath) {
    doc.image(logoPath, PAGE_LEFT, y, { fit: [130, 47], align: 'left' });
  }
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1d1d1b').text('COST SHEET', PAGE_LEFT, y, { width: PAGE_WIDTH, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#666').text('Internal working document — not for client distribution', PAGE_LEFT, y + 20, { width: PAGE_WIDTH, align: 'right' });
  y += 60;

  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).lineWidth(1.2).strokeColor('#1d1d1b').stroke();
  y += 14;

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1d1d1b').text(job.name, PAGE_LEFT, y);
  y += 16;
  const infoPairs = [
    ['Client', job.client_name],
    ['Job ID', `#${job.id}`],
    ['Quotation', `#${job.quotation_id}`],
    ['Quantity', formatUGX(job.quantity)],
    ['Margin Tier', job.tier_name ? `${job.tier_name} (${job.margin_percentage}%)` : 'N/A'],
    ['Pricing Mode', job.pricing_mode === 'fixed' ? 'Fixed price' : 'Calculated'],
    ['Generated', new Date().toLocaleDateString('en-GB')]
  ];
  doc.font('Helvetica').fontSize(9.5).fillColor('#333');
  infoPairs.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE_LEFT + col * (PAGE_WIDTH / 2);
    doc.text(`${label}: `, x, y + row * 15, { continued: true, width: PAGE_WIDTH / 2 });
    doc.font('Helvetica-Bold').text(String(value), { width: PAGE_WIDTH / 2 - 60 });
    doc.font('Helvetica');
  });
  y += Math.ceil(infoPairs.length / 2) * 15 + 16;

  if (job.description) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555').text(job.description, PAGE_LEFT, y, { width: PAGE_WIDTH });
    y += doc.heightOfString(job.description, { width: PAGE_WIDTH }) + 10;
  }

  if (job.pricing_mode === 'fixed') {
    y = sectionHeading(doc, y, 'Fixed Price');
    doc.font('Helvetica').fontSize(10).fillColor('#333').text(
      'This item was priced directly instead of built up from materials, machines, and processes.',
      PAGE_LEFT, y, { width: PAGE_WIDTH }
    );
    y += 30;
    y = summaryLine(doc, y, 'Unit Price', toNumber(job.fixed_price));
    doc.font('Helvetica').fontSize(9.5).fillColor('#666').text(
      job.vat_option === 'inclusive'
        ? 'VAT basis: unit price already includes 18% VAT (backed out below).'
        : 'VAT basis: 18% VAT is added on top of the unit price below.',
      PAGE_LEFT, y, { width: PAGE_WIDTH }
    );
    y += 22;
  } else {
    if (materials.length > 0) {
      y = sectionHeading(doc, y, 'Materials');
      const materialsTotal = materials.reduce((sum, m) => sum + toNumber(m.quantity) * toNumber(m.unit_cost), 0);
      y = drawTable(doc, y, [
        { key: 'material_name', label: 'Material', width: 220 },
        { key: 'quantity', label: 'Qty', width: 80, align: 'right', format: v => formatUGX(v) },
        { key: 'unit_cost', label: 'Unit Cost', width: 100, align: 'right', format: v => formatUGX(v) },
        { key: '_subtotal', label: 'Subtotal', width: 115, align: 'right', format: (_, row) => formatUGX(toNumber(row.quantity) * toNumber(row.unit_cost)) }
      ], materials, 'Materials Total', materialsTotal);
    }

    if (machines.length > 0) {
      y = sectionHeading(doc, y, 'Machines');
      const machinesTotal = machines.reduce((sum, m) => sum + toNumber(m.impressions) * toNumber(m.cost_per_impression) + toNumber(m.setup_cost), 0);
      y = drawTable(doc, y, [
        { key: 'machine_name', label: 'Machine', width: 160 },
        { key: 'impressions', label: 'Impressions', width: 90, align: 'right', format: v => formatUGX(v) },
        { key: 'cost_per_impression', label: 'Rate', width: 85, align: 'right', format: v => formatUGX(v) },
        { key: 'setup_cost', label: 'Setup', width: 85, align: 'right', format: v => formatUGX(v) },
        { key: '_subtotal', label: 'Subtotal', width: 95, align: 'right', format: (_, row) => formatUGX(toNumber(row.impressions) * toNumber(row.cost_per_impression) + toNumber(row.setup_cost)) }
      ], machines, 'Machines Total', machinesTotal);
    }

    if (bindings.length > 0) {
      y = sectionHeading(doc, y, 'Binding');
      const bindingCost = row => (row.cost !== null && row.cost !== undefined ? toNumber(row.cost) : toNumber(row.copies) * toNumber(row.cost_per_copy));
      const bindingTotal = bindings.reduce((sum, b) => sum + bindingCost(b), 0);
      y = drawTable(doc, y, [
        { key: 'binding_name', label: 'Method', width: 220 },
        { key: 'copies', label: 'Copies', width: 80, align: 'right', format: v => (v == null ? '-' : formatUGX(v)) },
        { key: 'cost_per_copy', label: 'Rate/Copy', width: 100, align: 'right', format: v => (v == null ? '-' : formatUGX(v)) },
        { key: '_subtotal', label: 'Subtotal', width: 115, align: 'right', format: (_, row) => formatUGX(bindingCost(row)) }
      ], bindings, 'Binding Total', bindingTotal);
    }

    const extra = additionalCosts[0] || {};
    const designSubtotal = toNumber(extra.design_pages) * toNumber(extra.design_rate);
    const typesettingSubtotal = toNumber(extra.typesetting_pages) * toNumber(extra.typesetting_rate);
    const extraRows = [
      designSubtotal > 0 && ['Design', `${formatUGX(extra.design_pages)} pages x UGX ${formatUGX(extra.design_rate)}`, designSubtotal],
      typesettingSubtotal > 0 && ['Typesetting', `${formatUGX(extra.typesetting_pages)} pages x UGX ${formatUGX(extra.typesetting_rate)}`, typesettingSubtotal],
      toNumber(extra.ctp_cost) > 0 && ['CTP (plates output)', '', toNumber(extra.ctp_cost)],
      toNumber(extra.wastage_cost) > 0 && ['Wastage', `${extra.wastage_percent || 0}% of materials`, toNumber(extra.wastage_cost)],
      toNumber(extra.subcontract_cost) > 0 && ['Subcontract', extra.subcontract_description || '', toNumber(extra.subcontract_cost)],
      toNumber(extra.storage_cost) > 0 && ['Storage', `${extra.storage_percent || 0}% of production cost`, toNumber(extra.storage_cost)],
      toNumber(extra.transport_cost) > 0 && ['Transport', `${extra.transport_percent || 0}% of production cost`, toNumber(extra.transport_cost)],
      toNumber(extra.overhead_cost) > 0 && ['Overhead', `${extra.overhead_percent || 0}% of production cost`, toNumber(extra.overhead_cost)],
      toNumber(extra.special_processes_total) > 0 && ['Special Processes', 'Lamination, folding, cutting, etc.', toNumber(extra.special_processes_total)]
    ].filter(Boolean);

    if (extraRows.length > 0) {
      y = sectionHeading(doc, y, 'Pre-press & Additional Costs');
      y = drawTable(doc, y, [
        { key: '0', label: 'Item', width: 140 },
        { key: '1', label: 'Basis', width: 235 },
        { key: '2', label: 'Amount', width: 140, align: 'right', format: v => formatUGX(v) }
      ], extraRows.map(([label, basis, amount]) => ({ 0: label, 1: basis, 2: amount })),
      'Additional Costs Total', extraRows.reduce((sum, [, , amount]) => sum + amount, 0));
    }
  }

  y += 10;
  y = sectionHeading(doc, y, 'How the Final Price Was Reached');
  if (job.pricing_mode !== 'fixed') {
    y = summaryLine(doc, y, 'Total Cost of Production', totals.productionTotal, { bold: true });
    if (totals.commissionAmount > 0) {
      y = summaryLine(doc, y, 'Commission', totals.commissionAmount, { indent: 10 });
    }
    y = summaryLine(doc, y, `Margin (${job.margin_percentage || 0}%)`, totals.marginAmount, { indent: 10 });
  }
  y = summaryLine(doc, y, 'Selling Price', totals.sellingPrice, { bold: true });
  y = summaryLine(doc, y, 'VAT (18%)', totals.vatAmount, { indent: 10 });
  y = ensureSpace(doc, y, 22);
  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).lineWidth(1).strokeColor('#1d1d1b').stroke();
  y += 6;
  y = summaryLine(doc, y, 'Final Total (Invoice Amount)', totals.finalTotal, { bold: true });
}

module.exports = { drawCostSheetPdf };
