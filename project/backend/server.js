const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

console.log('[STARTUP] Environment variables:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER
});

const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

module.exports.pool = pool;

pool.on('connect', () => {
  console.log('[POOL] Connected to database');
});

const PORT = parseInt(process.env.PORT) || 3000;

app.get('/', (req, res) => {
  console.log('[HANDLER] Root endpoint called');
  res.json({ message: 'Server is running' });
});

app.get('/api/test', async (req, res) => {
  console.log('[HANDLER] Test endpoint called');
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Database connected', time: result.rows[0] });
  } catch (err) {
    console.error('[DB ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Routes
const clientsRouter = require('./routes/clients');
app.use('/api/clients', clientsRouter);

const jobsRouter = require('./routes/jobs');
app.use('/api/jobs', jobsRouter);

const materialsRouter = require('./routes/materials');
app.use('/api/materials', materialsRouter);

const machinesRouter = require('./routes/machines');
app.use('/api/machines', machinesRouter);

const bindingsRouter = require('./routes/bindings');
app.use('/api/bindings', bindingsRouter);

const specialProcessesRouter = require('./routes/special-processes');
app.use('/api/special-processes', specialProcessesRouter);

const costingRouter = require('./routes/costing');
app.use('/api/costing', costingRouter);

const systemSettingsRouter = require('./routes/system-settings');
app.use('/api/system-settings', systemSettingsRouter);

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[STARTUP] Server running on http://127.0.0.1:${PORT}`);
  console.log(`[STARTUP] Ready to accept connections`);
});

server.on('error', (err) => {
  console.error('[SERVER ERROR]', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});