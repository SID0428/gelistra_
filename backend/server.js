const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-only-change-this-secret';
const USER_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const frontendRoot = path.resolve(__dirname, '..');

const STATUS_STAGE_COLUMN_BY_STATUS = {
  new: 'new_stage_at',
  'in-review': 'in_review_at',
  proposal: 'proposal_sent_at',
  closed: 'closed_at',
};

const WORK_STAGE_COLUMN_BY_STATUS = {
  queued: 'work_queued_at',
  ongoing: 'work_ongoing_at',
  testing: 'work_testing_at',
  revision: 'work_revision_at',
  completed: 'work_completed_at',
  'on-hold': 'work_on_hold_at',
};

function getStatusStageColumn(status) {
  return STATUS_STAGE_COLUMN_BY_STATUS[String(status || '').trim().toLowerCase()] || null;
}

function getWorkStageColumn(workStatus) {
  return WORK_STAGE_COLUMN_BY_STATUS[String(workStatus || '').trim().toLowerCase()] || null;
}

// Enable CORS so the static frontend can connect to this API
app.use(cors());
app.use(bodyParser.json());

// Initialize MySQL Pool
const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'localhost',
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'gelistraDB',
  waitForConnections: true,
  connectionLimit: 10,
});

// Ensure quote-related columns exist for older databases.
async function ensureQuoteColumns() {
  const requiredColumns = [
    { table: 'requirements', column: 'discount_percent', definition: 'DECIMAL(5,2) DEFAULT 0' },
    { table: 'requirements', column: 'final_quote', definition: 'TEXT' },
    { table: 'requirements', column: 'quote_response', definition: 'VARCHAR(20) NULL' },
    { table: 'requirements', column: 'quote_message', definition: 'TEXT' },
    { table: 'requirements', column: 'quote_response_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'new_stage_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'in_review_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'proposal_sent_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'closed_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'work_status', definition: 'VARCHAR(30) NULL' },
    { table: 'requirements', column: 'work_status_updated_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'work_queued_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'work_ongoing_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'work_testing_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'work_revision_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'work_completed_at', definition: 'DATETIME NULL' },
    { table: 'requirements', column: 'work_on_hold_at', definition: 'DATETIME NULL' },
    { table: 'inquiries', column: 'discount_percent', definition: 'DECIMAL(5,2) DEFAULT 0' },
    { table: 'inquiries', column: 'final_quote', definition: 'TEXT' },
    { table: 'inquiries', column: 'quote_response', definition: 'VARCHAR(20) NULL' },
    { table: 'inquiries', column: 'quote_message', definition: 'TEXT' },
    { table: 'inquiries', column: 'quote_response_at', definition: 'DATETIME NULL' },
    { table: 'inquiries', column: 'new_stage_at', definition: 'DATETIME NULL' },
    { table: 'inquiries', column: 'in_review_at', definition: 'DATETIME NULL' },
    { table: 'inquiries', column: 'proposal_sent_at', definition: 'DATETIME NULL' },
    { table: 'inquiries', column: 'closed_at', definition: 'DATETIME NULL' },
  ];

  for (const item of requiredColumns) {
    const [rows] = await pool.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
       LIMIT 1`,
      [item.table, item.column]
    );

    if (rows.length === 0) {
      await pool.query(`ALTER TABLE ${item.table} ADD COLUMN ${item.column} ${item.definition}`);
      console.log(`Added missing column: ${item.table}.${item.column}`);
    }
  }
}

// ── Auth Token Helpers ───────────────────────────────────────────────────────

function toBase64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(str.length / 4) * 4, '=');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function signTokenPayload(encodedPayload) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('hex');
}

function createAuthToken(payload, ttlMs) {
  const tokenPayload = {
    ...payload,
    exp: Date.now() + ttlMs,
  };
  const encoded = toBase64Url(JSON.stringify(tokenPayload));
  const signature = signTokenPayload(encoded);
  return `${encoded}.${signature}`;
}

function verifyAuthToken(token) {
  try {
    if (!token) return null;
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const expected = signTokenPayload(encoded);
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const payload = JSON.parse(fromBase64Url(encoded));
    if (!payload || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

function getAuthPayloadFromRequest(req) {
  return verifyAuthToken(getBearerToken(req));
}

function requireAuth(roles = []) {
  return (req, res, next) => {
    const payload = verifyAuthToken(getBearerToken(req));
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });
    if (roles.length && !roles.includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });
    req.auth = payload;
    next();
  };
}

// ── Auth API ──────────────────────────────────────────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'User already exists' });

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    const customer_id = 'CUST-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    const [result] = await pool.query(
      'INSERT INTO users (customer_id, name, email, password_hash) VALUES (?, ?, ?, ?)',
      [customer_id, name, email, password_hash]
    );

    const token = createAuthToken({ role: 'user', customerId: customer_id, email }, USER_TOKEN_TTL_MS);
    res.status(201).json({ customerId: customer_id, name, email, token });
  } catch (error) {
    console.error('Signup error', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const [rows] = await pool.query(
      'SELECT customer_id AS customerId, name, email, password_hash FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    delete user.password_hash;
    const token = createAuthToken({ role: 'user', customerId: user.customerId, email: user.email }, USER_TOKEN_TTL_MS);
    res.json({ ...user, token });
  } catch (error) {
    console.error('Login error', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Admin Login ───────────────────────────────────────────────────────────────

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash FROM admins WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [normalizedEmail]
    );
    const admin = rows[0];

    if (!admin) return res.status(401).json({ error: 'Invalid email or password' });

    let match = false;
    const stored = String(admin.password_hash || '');

    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      match = await bcrypt.compare(password, stored);
    } else {
      // Legacy fallback: allow a one-time plaintext match and upgrade to bcrypt hash.
      match = password === stored;
      if (match) {
        const upgradedHash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [upgradedHash, admin.id]);
      }
    }

    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    delete admin.password_hash;
    const token = createAuthToken({ role: 'admin', adminId: admin.id, email: admin.email }, ADMIN_TOKEN_TTL_MS);
    res.json({ ...admin, token });
  } catch (error) {
    console.error('Admin login error', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Admin Create (first-time setup) ───────────────────────────────────────────

app.post('/api/admin/create', async (req, res) => {
  const { name, email, password, setupKey } = req.body;
  const expectedSetupKey = process.env.ADMIN_SETUP_KEY;
  if (!expectedSetupKey) {
    return res.status(503).json({ error: 'Admin setup is disabled. Configure ADMIN_SETUP_KEY first.' });
  }
  if (setupKey !== expectedSetupKey) {
    return res.status(403).json({ error: 'Invalid setup key' });
  }
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const [existing] = await pool.query('SELECT id FROM admins WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Admin already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)',
      [name || 'Admin', email, password_hash]
    );

    res.status(201).json({ success: true, message: 'Admin account created' });
  } catch (error) {
    console.error('Admin create error', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Inquiries API ─────────────────────────────────────────────────────────────

app.post('/api/inquiries', async (req, res) => {
  const { name, email, company, website, service, budget, timeline, details, customerId } = req.body;
  const type = 'inquiry';
  const status = 'new';
  const authPayload = getAuthPayloadFromRequest(req);
  const effectiveCustomerId = authPayload?.role === 'user' ? authPayload.customerId : (customerId || null);

  try {
    const [result] = await pool.query(
      `INSERT INTO inquiries (type, status, name, email, company, website, service, budget, timeline, details, customer_id, new_stage_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [type, status, name, email, company, website, service, budget, timeline, details, effectiveCustomerId]
    );
    res.status(201).json({ id: result.insertId, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error inserting inquiry', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/inquiries/:id/status', requireAuth(['admin']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const statusStageColumn = getStatusStageColumn(status);
  if (!statusStageColumn) return res.status(400).json({ error: 'Invalid status' });
  try {
    await pool.query(
      `UPDATE inquiries SET status = ?, ${statusStageColumn} = NOW() WHERE id = ?`,
      [status, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Requirements API ──────────────────────────────────────────────────────────

app.post('/api/requirements', async (req, res) => {
  const {
    name, email, phone, company, role, decisionMaker,
    package: pkg, industry, audience, goals, currentSite,
    pageCount, pageList, contentStatus, brandAssets, references,
    features, productCount, paymentGateway, integrations,
    domainHosting, launchDate, budget, support, assetsLink, notes, customerId,
    estimateRange
  } = req.body;

  const type = 'requirements';
  const status = 'new';
  const authPayload = getAuthPayloadFromRequest(req);
  const effectiveCustomerId = authPayload?.role === 'user' ? authPayload.customerId : (customerId || null);

  try {
    const [result] = await pool.query(
      `INSERT INTO requirements (
        type, status, name, email, phone, company, role, decision_maker, package,
        industry, audience, goals, current_site, page_count, page_list, content_status,
        brand_assets, references_text, features, product_count, payment_gateway,
        integrations, domain_hosting, launch_date, budget, support, assets_link, notes, customer_id,
        estimate_range, new_stage_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, NOW()
      )`,
      [
        type, status, name, email, phone, company, role, decisionMaker, pkg,
        industry, audience, JSON.stringify(goals || []), currentSite, pageCount, pageList, contentStatus,
        brandAssets, references, JSON.stringify(features || []), productCount, paymentGateway,
        integrations, domainHosting, launchDate || null, budget, support, assetsLink, notes, effectiveCustomerId,
        estimateRange || null
      ]
    );
    res.status(201).json({ id: result.insertId, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error inserting requirement', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/requirements/:id/status', requireAuth(['admin']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const statusStageColumn = getStatusStageColumn(status);
  if (!statusStageColumn) return res.status(400).json({ error: 'Invalid status' });
  try {
    await pool.query(
      `UPDATE requirements SET status = ?, ${statusStageColumn} = NOW() WHERE id = ?`,
      [status, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Save discount on a submission ─────────────────────────────────────────────

app.patch('/api/requirements/:id/discount', requireAuth(['admin']), async (req, res) => {
  const { id } = req.params;
  const { discountPercent, finalQuote } = req.body;
  try {
    await pool.query(
      'UPDATE requirements SET discount_percent = ?, final_quote = ? WHERE id = ?',
      [discountPercent || 0, finalQuote || null, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/inquiries/:id/discount', requireAuth(['admin']), async (req, res) => {
  const { id } = req.params;
  const { discountPercent, finalQuote } = req.body;
  try {
    await pool.query(
      'UPDATE inquiries SET discount_percent = ?, final_quote = ? WHERE id = ?',
      [discountPercent || 0, finalQuote || null, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Client Quote Response APIs (accept / reject with message) ────────────────

app.patch('/api/requirements/:id/quote-response', requireAuth(['user']), async (req, res) => {
  const { id } = req.params;
  const customerId = req.auth?.customerId;
  const decision = String(req.body?.decision || '').trim().toLowerCase();
  const message = String(req.body?.message || '').trim();

  if (!customerId) return res.status(403).json({ error: 'Customer context missing' });
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be accepted or rejected' });
  }

  // Keep existing status taxonomy to avoid breaking current admin filters.
  const mappedStatus = decision === 'accepted' ? 'closed' : 'in-review';
  const statusStageColumn = getStatusStageColumn(mappedStatus);
  if (!statusStageColumn) return res.status(400).json({ error: 'Invalid mapped status' });

  const setClauses = [
    'quote_response = ?',
    'quote_message = ?',
    'quote_response_at = NOW()',
    'status = ?',
    `${statusStageColumn} = NOW()`,
  ];
  const params = [decision, message || null, mappedStatus];

  if (decision === 'accepted') {
    setClauses.push("work_status = COALESCE(work_status, 'queued')");
    setClauses.push('work_status_updated_at = NOW()');
    setClauses.push('work_queued_at = COALESCE(work_queued_at, NOW())');
  }

  try {
    const [result] = await pool.query(
      `UPDATE requirements
       SET ${setClauses.join(', ')}
       WHERE id = ? AND customer_id = ?`,
      [...params, id, customerId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Submission not found' });
    res.json({ success: true, decision, status: mappedStatus });
  } catch (error) {
    console.error('Quote response update error (requirements):', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/inquiries/:id/quote-response', requireAuth(['user']), async (req, res) => {
  const { id } = req.params;
  const customerId = req.auth?.customerId;
  const decision = String(req.body?.decision || '').trim().toLowerCase();
  const message = String(req.body?.message || '').trim();

  if (!customerId) return res.status(403).json({ error: 'Customer context missing' });
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be accepted or rejected' });
  }

  const mappedStatus = decision === 'accepted' ? 'closed' : 'in-review';
  const statusStageColumn = getStatusStageColumn(mappedStatus);
  if (!statusStageColumn) return res.status(400).json({ error: 'Invalid mapped status' });

  try {
    const [result] = await pool.query(
      `UPDATE inquiries
       SET quote_response = ?, quote_message = ?, quote_response_at = NOW(), status = ?, ${statusStageColumn} = NOW()
       WHERE id = ? AND customer_id = ?`,
      [decision, message || null, mappedStatus, id, customerId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Submission not found' });
    res.json({ success: true, decision, status: mappedStatus });
  } catch (error) {
    console.error('Quote response update error (inquiries):', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Website Work Status API (admin) ───────────────────────────────────────────

app.patch('/api/requirements/:id/work-status', requireAuth(['admin']), async (req, res) => {
  const { id } = req.params;
  const workStatus = String(req.body?.workStatus || '').trim().toLowerCase();
  const workStageColumn = getWorkStageColumn(workStatus);
  if (!workStageColumn) {
    return res.status(400).json({ error: 'Invalid work status' });
  }

  try {
    await pool.query(
      `UPDATE requirements
       SET work_status = ?, work_status_updated_at = NOW(), ${workStageColumn} = NOW()
       WHERE id = ?`,
      [workStatus, id]
    );
    res.json({ success: true, workStatus });
  } catch (error) {
    console.error('Work status update error (requirements):', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Shared Submissions API ────────────────────────────────────────────────────

app.get('/api/submissions', requireAuth(['admin', 'user']), async (req, res) => {
  let { type, status, package: pkg, customerId } = req.query;
  const isAdmin = req.auth.role === 'admin';
  if (!isAdmin) {
    customerId = req.auth.customerId;
    if (!customerId) return res.status(403).json({ error: 'Customer context missing' });
  }

  try {
    let reqs = [];
    let inqs = [];

    if (!type || type === 'requirements') {
      let q = 'SELECT *, CAST(id AS CHAR) AS id, created_at AS createdAt FROM requirements WHERE 1=1';
      const params = [];
      if (status) { params.push(status); q += ' AND status = ?'; }
      if (pkg) { params.push(pkg); q += ' AND package = ?'; }
      if (customerId) { params.push(customerId); q += ' AND customer_id = ?'; }

      const [rows] = await pool.query(q, params);
      reqs = rows.map(r => ({
        ...r,
        goals: typeof r.goals === 'string' ? JSON.parse(r.goals) : (r.goals || []),
        features: typeof r.features === 'string' ? JSON.parse(r.features) : (r.features || []),
      }));
    }

    if (!type || type === 'inquiry') {
      let q = 'SELECT *, CAST(id AS CHAR) AS id, created_at AS createdAt FROM inquiries WHERE 1=1';
      const params = [];
      if (status) { params.push(status); q += ' AND status = ?'; }
      if (customerId) { params.push(customerId); q += ' AND customer_id = ?'; }

      const [rows] = await pool.query(q, params);
      inqs = rows;
    }

    // Combine and sort by createdAt DESC
    const submissions = [...reqs, ...inqs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(submissions);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── User Profile API (for account page) ───────────────────────────────────────

app.get('/api/profile', requireAuth(['admin', 'user']), async (req, res) => {
  const requestedCustomerId = req.query.customerId;
  const customerId = req.auth.role === 'admin' ? requestedCustomerId : req.auth.customerId;
  if (!customerId) return res.status(400).json({ error: 'customerId required' });

  try {
    const [rows] = await pool.query(
      'SELECT customer_id AS customerId, name, email, created_at AS createdAt FROM users WHERE customer_id = ?',
      [customerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/profile', requireAuth(['admin', 'user']), async (req, res) => {
  const { customerId, name, email } = req.body;
  const targetCustomerId = req.auth.role === 'admin' ? customerId : req.auth.customerId;
  if (!targetCustomerId) return res.status(400).json({ error: 'customerId required' });

  try {
    await pool.query('UPDATE users SET name = ?, email = ? WHERE customer_id = ?', [name, email, targetCustomerId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Test DB Connection ────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS time');
    res.json({ connected: true, database: 'MySQL', time: rows[0].time });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// ── Frontend Static Hosting (single-process local run) ──────────────────────

app.use('/backend', (_req, res) => res.status(404).send('Not found'));
app.use('/node_modules', (_req, res) => res.status(404).send('Not found'));
app.use(express.static(frontendRoot, { dotfiles: 'ignore', index: 'index.html' }));

async function startServer() {
  try {
    await ensureQuoteColumns();
  } catch (err) {
    console.warn('Quote column check skipped:', err?.code || err?.message || err);
  }

  app.listen(port, () => {
    console.log(`Backend API live at http://localhost:${port} (MySQL)`);
  });
}

startServer();
