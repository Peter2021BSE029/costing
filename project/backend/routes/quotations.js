// Quotation routes - a quotation groups one or more costed/fixed-price jobs for one client
const express = require('express');
const router = express.Router();
const pool = require('../server').pool;
const PDFDocument = require('pdfkit');
const { authenticateToken } = require('./auth');
const { getQuotationItemsData, calculateGrandTotals, drawQuotationPdf } = require('../lib/quotationPdf');

// List quotations with client, item count, and grand total
router.get('/', authenticateToken, async (req, res) => {
  try {
    const quotationsResult = await pool.query(`
      SELECT q.id, q.name, q.status, q.created_at, q.client_id, c.name as client_name,
             mt.tier_name, mt.margin_percentage
      FROM quotations q
      JOIN clients c ON q.client_id = c.id
      LEFT JOIN margin_tiers mt ON c.margin_tier_id = mt.id
      ORDER BY q.created_at DESC
    `);

    const quotations = await Promise.all(quotationsResult.rows.map(async (quotation) => {
      const data = await getQuotationItemsData(pool, quotation.id);
      const grandTotals = data ? calculateGrandTotals(data.items) : { sellingPrice: 0, vatAmount: 0, finalTotal: 0 };
      return {
        ...quotation,
        item_count: data ? data.items.length : 0,
        grand_total: grandTotals.finalTotal
      };
    }));

    res.json(quotations);
  } catch (err) {
    console.error('[QUOTATIONS] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get a single quotation with all its items and totals
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const data = await getQuotationItemsData(pool, req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    res.json({
      ...data.quotation,
      items: data.items.map(item => item.job),
      grand_totals: calculateGrandTotals(data.items)
    });
  } catch (err) {
    console.error('[QUOTATIONS] Detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Rename a quotation (e.g. "August Print Run for Ministry of Health")
router.put('/:id', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE quotations SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name',
      [(name || '').trim() || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[QUOTATIONS] Rename error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generate the combined PDF for a quotation
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  const quotationId = req.params.id;

  try {
    const data = await getQuotationItemsData(pool, quotationId);
    if (!data) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation_${quotationId}.pdf`);
    doc.pipe(res);
    drawQuotationPdf(doc, quotationId, data);
    doc.end();
  } catch (err) {
    console.error('[QUOTATIONS] PDF error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
