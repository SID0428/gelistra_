// ─── Gelistra Admin Portal Logic ─────────────────────────────────────────────
// Handles: Admin login/logout via backend API, loading & displaying submissions,
//          filter/search, status updates, detail drawer, PDF downloads,
//          CSV export, and cost calculator.
//
// Imported by admin.html as: <script type="module" src="admin.js"></script>
// Depends on: Backend API (http://localhost:3000/api)
// ──────────────────────────────────────────────────────────────────────────────

function resolveApiBase() {
  if (typeof window !== 'undefined' && window.GELISTRA_API_BASE) {
    return String(window.GELISTRA_API_BASE).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000/api';
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  }
  return 'http://localhost:3000/api';
}
const API_BASE = resolveApiBase();

// ── State ──────────────────────────────────────────────────────────────────────
let allSubmissions = [];  // full list from DB
let activeFilter   = 'all';
let searchQuery    = '';
let activeDrawerId = null;
let activeDrawerCol= null;
let adminUser      = null;

// ── DOM refs ───────────────────────────────────────────────────────────────────
const loginScreen   = document.getElementById('login-screen');
const adminShell    = document.getElementById('admin-shell');
const loginBtn      = document.getElementById('login-btn');
const logoutBtn     = document.getElementById('logout-btn');
const loginError    = document.getElementById('login-error');
const emailInput    = document.getElementById('admin-email');
const passInput     = document.getElementById('admin-password');
const tbody         = document.getElementById('submissions-tbody');
const searchBox     = document.getElementById('search-box');
const drawer        = document.getElementById('detail-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose   = document.getElementById('drawer-close');
const drawerCloseBtn= document.getElementById('drawer-close-btn');
const drawerTitle   = document.getElementById('drawer-title');
const drawerSub     = document.getElementById('drawer-sub');
const drawerBody    = document.getElementById('drawer-body');
const drawerPdfBtn  = document.getElementById('drawer-pdf-btn');
const exportCsvBtn  = document.getElementById('export-csv-btn');
const refreshBtn    = document.getElementById('refresh-btn');
const adminEmail    = document.getElementById('admin-email-display');

// ── API helper ─────────────────────────────────────────────────────────────────
function getAdminToken() {
  if (adminUser?.token) return adminUser.token;
  const saved = localStorage.getItem('gelistra_admin');
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `API error ${res.status}`);
  }
  return res.json();
}

function parseMaybeJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return [];
  const text = val.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return text
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
}

function normalizeSubmission(raw) {
  const s = { ...raw };

  // Normalize snake_case DB fields to the keys used by the admin UI.
  s.createdAt = s.createdAt || s.created_at || null;
  s.updatedAt = s.updatedAt || s.updated_at || null;
  s.decisionMaker = s.decisionMaker || s.decision_maker || '';
  s.currentSite = s.currentSite || s.current_site || '';
  s.pageCount = s.pageCount || s.page_count || '';
  s.pageList = s.pageList || s.page_list || '';
  s.contentStatus = s.contentStatus || s.content_status || '';
  s.brandAssets = s.brandAssets || s.brand_assets || '';
  s.references = s.references || s.references_text || '';
  s.productCount = s.productCount || s.product_count || '';
  s.paymentGateway = s.paymentGateway || s.payment_gateway || '';
  s.domainHosting = s.domainHosting || s.domain_hosting || '';
  s.launchDate = s.launchDate || s.launch_date || '';
  s.assetsLink = s.assetsLink || s.assets_link || '';
  s.estimateRange = s.estimateRange || s.estimate_range || '';
  s.final_quote = s.final_quote || s.finalQuote || '';
  s.discount_percent = Number.isFinite(Number(s.discount_percent)) ? Number(s.discount_percent) : 0;
  s.newStageAt = s.newStageAt || s.new_stage_at || null;
  s.inReviewAt = s.inReviewAt || s.in_review_at || null;
  s.proposalSentAt = s.proposalSentAt || s.proposal_sent_at || null;
  s.closedAt = s.closedAt || s.closed_at || null;
  s.workStatus = s.workStatus || s.work_status || '';
  s.workStatusUpdatedAt = s.workStatusUpdatedAt || s.work_status_updated_at || null;
  s.workQueuedAt = s.workQueuedAt || s.work_queued_at || null;
  s.workOngoingAt = s.workOngoingAt || s.work_ongoing_at || null;
  s.workTestingAt = s.workTestingAt || s.work_testing_at || null;
  s.workRevisionAt = s.workRevisionAt || s.work_revision_at || null;
  s.workCompletedAt = s.workCompletedAt || s.work_completed_at || null;
  s.workOnHoldAt = s.workOnHoldAt || s.work_on_hold_at || null;

  s.goals = parseMaybeJsonArray(s.goals);
  s.features = parseMaybeJsonArray(s.features);

  return s;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

function checkSession() {
  const saved = localStorage.getItem('gelistra_admin');
  if (saved) {
    try {
      adminUser = JSON.parse(saved);
      if (!adminUser?.token) {
        localStorage.removeItem('gelistra_admin');
        showLogin();
        return;
      }
      showAdmin();
    } catch {
      localStorage.removeItem('gelistra_admin');
      showLogin();
    }
  } else {
    showLogin();
  }
}

function showAdmin() {
  loginScreen.style.display = 'none';
  adminShell.classList.add('active');
  if (adminEmail) adminEmail.textContent = adminUser?.email || '';
  loadSubmissions();
}

function showLogin() {
  loginScreen.style.display = 'flex';
  adminShell.classList.remove('active');
  allSubmissions = [];
  adminUser = null;
}

loginBtn?.addEventListener('click', handleLogin);
passInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('gelistra_admin');
  adminUser = null;
  showLogin();
});

async function handleLogin() {
  loginError.textContent = '';
  loginBtn.textContent   = 'Signing in…';
  loginBtn.disabled      = true;
  try {
    const user = await apiRequest('POST', '/admin/login', {
      email: emailInput.value.trim(),
      password: passInput.value,
    });
    adminUser = user;
    localStorage.setItem('gelistra_admin', JSON.stringify(user));
    showAdmin();
  } catch (err) {
    loginError.textContent = err.message || 'Invalid email or password. Please try again.';
  } finally {
    loginBtn.textContent = 'Sign In';
    loginBtn.disabled    = false;
  }
}

// Initialize
checkSession();

// ── Load submissions ───────────────────────────────────────────────────────────

async function loadSubmissions() {
  setTableLoading(true);
  try {
    const payload = await apiRequest('GET', '/submissions');
    allSubmissions = Array.isArray(payload) ? payload.map(normalizeSubmission) : [];
    renderTable();
    renderStats();
  } catch (err) {
    setTableError(err.message);
  }
}

refreshBtn?.addEventListener('click', loadSubmissions);

function setTableLoading(on) {
  if (on) tbody.innerHTML = `<tr><td colspan="7" class="loading-state">
    <span class="spinner"></span> Loading submissions…
  </td></tr>`;
}

function setTableError(msg) {
  tbody.innerHTML = `<tr><td colspan="7" class="loading-state" style="color:#d93025;">
    ⚠ Failed to load: ${msg} — <a href="#" onclick="location.reload()">retry</a>
  </td></tr>`;
}

// ── Stats ──────────────────────────────────────────────────────────────────────

function renderStats() {
  setText('stat-total',    allSubmissions.length);
  setText('stat-new',      allSubmissions.filter(s => s.status === 'new').length);
  setText('stat-review',   allSubmissions.filter(s => s.status === 'in-review').length);
  setText('stat-proposal', allSubmissions.filter(s => s.status === 'proposal').length);
  setText('stat-closed',   allSubmissions.filter(s => s.status === 'closed').length);

  const inquiries = allSubmissions.filter(s => s.type === 'inquiry').length;
  const reqs      = allSubmissions.filter(s => s.type === 'requirements').length;
  setText('stat-inquiries',    inquiries);
  setText('stat-requirements', reqs);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Filter / search ────────────────────────────────────────────────────────────

function getFiltered() {
  let list = [...allSubmissions];

  if (activeFilter !== 'all') {
    const [key, val] = activeFilter.split(':');
    list = list.filter(s => (s[key] || '') === val);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(s =>
      (s.name    || '').toLowerCase().includes(q) ||
      (s.email   || '').toLowerCase().includes(q) ||
      (s.company || '').toLowerCase().includes(q) ||
      (s.phone   || '').toLowerCase().includes(q)
    );
  }

  return list;
}

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderTable();
  });
});

searchBox?.addEventListener('input', () => {
  searchQuery = searchBox.value.trim();
  renderTable();
});

// ── Table rendering ────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function colOf(s) {
  return s.type === 'requirements' ? 'requirements' : 'inquiries';
}

function renderTable() {
  const list = getFiltered();

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 12h6M9 16h4M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/>
      </svg>
      <p>No submissions match the current filter.</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(s => {
    const col    = colOf(s);
    const status = s.status || 'new';
    return `
    <tr data-id="${s.id}" data-col="${col}" tabindex="0" role="button" aria-label="View ${s.name || 'submission'}">
      <td>
        <strong>${esc(s.name || '—')}</strong>
        <br><small style="color:var(--muted)">${esc(s.email || '')}</small>
      </td>
      <td>${esc(s.company || '—')}</td>
      <td>
        <span class="type-badge ${s.type === 'requirements' ? 'requirements' : 'inquiry'}">
          ${s.type === 'requirements' ? 'Requirements' : 'Inquiry'}
        </span>
      </td>
      <td>${esc(s.package || s.service || '—')}</td>
      <td>${esc(s.budget || '—')}</td>
      <td>${fmtDate(s.createdAt)}</td>
      <td>
        <select class="status-select ${status}"
                data-id="${s.id}" data-col="${col}"
                aria-label="Status for ${esc(s.name || 'submission')}">
          <option value="new"       ${status==='new'       ?'selected':''}>🔵 New</option>
          <option value="in-review" ${status==='in-review' ?'selected':''}>🟣 In Review</option>
          <option value="proposal"  ${status==='proposal'  ?'selected':''}>🟢 Proposal Sent</option>
          <option value="closed"    ${status==='closed'    ?'selected':''}>✅ Closed</option>
        </select>
      </td>
    </tr>`;
  }).join('');

  // Row click → open drawer (but not on status select)
  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
      openDrawer(row.dataset.id, row.dataset.col);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openDrawer(row.dataset.id, row.dataset.col);
    });
  });

  // Status dropdown change
  tbody.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      const { id, col } = sel.dataset;
      const status       = sel.value;
      sel.className      = `status-select ${status}`;
      try {
        const endpoint = col === 'requirements'
          ? `/requirements/${id}/status`
          : `/inquiries/${id}/status`;
        await apiRequest('PATCH', endpoint, { status });
        const s = allSubmissions.find(x => x.id === id);
        if (s) s.status = status;
        renderStats();
      } catch (err) {
        console.error('Status update failed:', err);
        sel.className = `status-select ${sel.dataset.prevStatus || 'new'}`;
      }
    });
    // store prev value for rollback
    sel.addEventListener('focus', () => { sel.dataset.prevStatus = sel.value; });
  });
}

// Safe HTML escape
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Detail drawer ──────────────────────────────────────────────────────────────

function df(label, value, full = false) {
  const v = Array.isArray(value) ? value.join(', ') : value;
  if (!v || String(v).trim() === '') return '';
  return `<div class="detail-field ${full ? 'full' : ''}">
    <label>${label}</label>
    <span>${esc(String(v))}</span>
  </div>`;
}

function tagList(arr, cls = '') {
  if (!arr || !arr.length) return '<span style="color:var(--muted);font-size:0.85rem">—</span>';
  return `<div class="tag-list">${arr.map(t => `<span class="tag ${cls}">${esc(t)}</span>`).join('')}</div>`;
}

function fieldLabel(key) {
  const labels = {
    name: 'Full Name',
    email: 'Email',
    phone: 'Phone',
    company: 'Company',
    role: 'Role',
    decisionMaker: 'Decision Maker',
    package: 'Selected Package',
    service: 'Service',
    industry: 'Industry',
    audience: 'Target Audience',
    goals: 'Goals',
    currentSite: 'Current Website',
    pageCount: 'Page Count',
    pageList: 'Page List',
    contentStatus: 'Content Status',
    brandAssets: 'Brand Assets',
    references: 'References / Competitors',
    features: 'Features',
    productCount: 'Product Count',
    paymentGateway: 'Payment Gateway',
    integrations: 'Integrations',
    domainHosting: 'Domain & Hosting',
    launchDate: 'Preferred Launch Date',
    budget: 'Budget',
    support: 'Support',
    assetsLink: 'Assets Link',
    notes: 'Notes',
    timeline: 'Timeline',
    details: 'Project Brief',
    website: 'Website',
  };
  if (labels[key]) return labels[key];
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function snapshotValue(val) {
  if (val == null) return '';
  if (Array.isArray(val)) return val.filter(Boolean).join(', ');
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val).trim();
}

function buildClientSnapshotHTML(s) {
  const excluded = new Set([
    'id', 'type', 'status', 'createdAt', 'updatedAt', 'created_at', 'updated_at',
    'customer_id', 'discount_percent', 'final_quote', 'quote_response', 'quote_message',
    'quote_response_at', 'estimate_range', 'estimateRange',
  ]);

  const preferredOrder = [
    'name', 'email', 'phone', 'company', 'website', 'role', 'decisionMaker',
    'package', 'service', 'industry', 'audience', 'goals',
    'currentSite', 'pageCount', 'pageList', 'contentStatus', 'brandAssets', 'references',
    'features', 'productCount', 'paymentGateway', 'integrations',
    'domainHosting', 'launchDate', 'timeline', 'budget', 'support',
    'assetsLink', 'details', 'notes',
  ];

  const keys = Object.keys(s).filter((k) => !excluded.has(k));
  const ordered = [
    ...preferredOrder.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferredOrder.includes(k)).sort(),
  ];

  const rows = ordered
    .map((k) => ({ key: k, value: snapshotValue(s[k]) }))
    .filter((item) => item.value);

  if (!rows.length) return '';

  return `
    <div class="drawer-section">
      <div class="drawer-section-title">Client Details (PDF-Style Form Snapshot)</div>
      <div class="detail-grid">
        ${rows.map((item) => {
          const isLong = item.value.length > 120 || item.value.includes('\n');
          return `<div class="detail-field ${isLong ? 'full' : ''}">
            <label>${esc(fieldLabel(item.key))}</label>
            <span>${esc(item.value)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function parsePageCountSeed(raw) {
  const text = String(raw || '');
  const matches = text.match(/\d+/g);
  if (!matches || !matches.length) return 5;
  const nums = matches.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
  if (!nums.length) return 5;
  if (nums.length === 1) return nums[0];
  return Math.round((nums[0] + nums[1]) / 2);
}

function baseQuoteSeed(s) {
  const hint = `${s.package || ''} ${s.service || ''}`.toLowerCase();
  if (hint.includes('e-commerce') || hint.includes('ecommerce') || hint.includes('store')) return 8400;
  if (hint.includes('web app') || hint.includes('application')) return 12600;
  if (hint.includes('landing')) return 1400;
  if (hint.includes('portfolio') || hint.includes('static')) return 2100;
  if (hint.includes('blog') || hint.includes('magazine')) return 2800;
  if (hint.includes('starter')) return 2100;
  if (hint.includes('growth')) return 3500;
  if (hint.includes('pro') || hint.includes('premium')) return 5600;
  return 3500;
}

function featureQuoteSeed(s) {
  if (Array.isArray(s.features) && s.features.length) {
    return s.features.length * 1400;
  }
  return s.type === 'requirements' ? 2800 : 1400;
}

function supportQuoteSeed(s) {
  const raw = String(s.support || '').toLowerCase();
  if (!raw || raw.includes('none') || raw.includes('one-time')) return 0;
  if (raw.includes('ongoing') || raw.includes('monthly')) return 4200;
  if (raw.includes('6 month')) return 4200;
  if (raw.includes('12 month') || raw.includes('year')) return 7000;
  return 2100;
}

function rushQuoteSeed(s) {
  const raw = String(s.timeline || '').toLowerCase();
  if (!raw) return 1;
  if (raw.includes('urgent') || raw.includes('asap') || raw.includes('1 week')) return 1.5;
  if (raw.includes('2 week') || raw.includes('fast')) return 1.2;
  return 1;
}

const QUOTE_PAGE_RANGE_PRESETS = {
  '1-5': { pages: 3, rate: 350 },
  '6-10': { pages: 8, rate: 350 },
  '11-20': { pages: 15, rate: 315 },
  '21-35': { pages: 28, rate: 280 },
  '36-50': { pages: 43, rate: 265 },
  '51-100': { pages: 75, rate: 240 },
  '100+': { pages: 110, rate: 220 },
};

const QUOTE_PRESET_COSTS = {
  contentStatus: {
    ready: 0,
    partial: 2100,
    draft_edit: 3500,
    copy_support: 5600,
    strategy_copy: 8400,
    other: 4200,
  },
  supportPlan: {
    ongoing: 4200,
    quarterly: 2800,
    annual: 7000,
    ondemand: 2100,
    one_time: 0,
    undecided: 0,
    other: 2100,
  },
  brandAssets: {
    full_brand: 0,
    logo_palette: 700,
    logo_only: 1400,
    moodboard: 2100,
    rebrand_upgrade: 2800,
    no_assets: 4200,
    other: 2100,
  },
  domainHosting: {
    active: 0,
    managed_setup: 700,
    setup_required: 1050,
    migration: 2100,
    both_support: 2800,
    recommendation: 1400,
    cloud: 3500,
    headless: 2800,
    other: 1750,
  },
  performanceTarget: {
    cwv: 700,
    lcp_25: 1050,
    lh_85: 700,
    lh_90: 1400,
    lh_95: 2450,
    other: 1400,
  },
  accessibilityLevel: {
    standard: 700,
    wcag_aa: 2100,
    wcag_audit: 3500,
    legal_statement: 2800,
    other: 1750,
  },
  feedbackCycle: {
    weekly: 700,
    biweekly: 350,
    async: 0,
    daily_critical: 1400,
    milestone_single: 350,
    other: 700,
  },
  supportSla: {
    business_hours: 1400,
    response_24h: 2100,
    critical_4_8h: 3500,
    incidents_24_7: 5600,
    dedicated_manager: 4200,
    other: 2100,
  },
  training: {
    cms_session: 700,
    docs_only: 350,
    videos: 1050,
    role_based: 1400,
    none: 0,
    other: 700,
  },
  paymentTerms: {
    split_50_50: 0,
    split_40_30_30: 0,
    split_30_40_30: 0,
    monthly_invoice: 350,
    milestone_custom: 700,
    recommendation: 0,
    other: 350,
  },
  redirectPlan: {
    mapping: 1050,
    legacy_seo: 2100,
    none_new: 0,
    unsure: 700,
    other: 1050,
  },
  designSystem: {
    basic: 700,
    full: 2800,
    audit_extend: 3500,
    not_required: 0,
    other: 1400,
  },
};

const QUOTE_INTEGRATION_CATEGORY_COSTS = {
  crm: 700,
  marketing: 700,
  analytics: 350,
  payments: 700,
  logistics: 700,
  support: 700,
  sso: 1050,
  erp: 1400,
  other: 700,
};

function inferPageRangePreset(raw) {
  const text = String(raw || '').toLowerCase();
  if (text.includes('1-5')) return '1-5';
  if (text.includes('6-10')) return '6-10';
  if (text.includes('11-20')) return '11-20';
  if (text.includes('21-35')) return '21-35';
  if (text.includes('36-50')) return '36-50';
  if (text.includes('51-100')) return '51-100';
  if (text.includes('100+')) return '100+';
  return '';
}

function inferContentPreset(raw) {
  const text = String(raw || '').toLowerCase();
  if (!text) return '';
  if (text.includes('final copy') || text.includes('content ready')) return 'ready';
  if (text.includes('partially ready') || text.includes('partially')) return 'partial';
  if (text.includes('draft')) return 'draft_edit';
  if (text.includes('copywriting')) return 'copy_support';
  if (text.includes('strategy')) return 'strategy_copy';
  if (text.includes('other')) return 'other';
  return '';
}

function inferSupportPreset(raw) {
  const text = String(raw || '').toLowerCase();
  if (!text) return '';
  if (text.includes('ongoing') || text.includes('monthly')) return 'ongoing';
  if (text.includes('quarterly')) return 'quarterly';
  if (text.includes('annual') || text.includes('year')) return 'annual';
  if (text.includes('on-demand')) return 'ondemand';
  if (text.includes('one-time')) return 'one_time';
  if (text.includes('undecided')) return 'undecided';
  if (text.includes('other')) return 'other';
  return '';
}

function inferBrandPreset(raw) {
  const text = String(raw || '').toLowerCase();
  if (!text) return '';
  if (text.includes('full brand')) return 'full_brand';
  if (text.includes('logo and color')) return 'logo_palette';
  if (text.includes('logo only')) return 'logo_only';
  if (text.includes('moodboard')) return 'moodboard';
  if (text.includes('rebrand')) return 'rebrand_upgrade';
  if (text.includes('no brand assets')) return 'no_assets';
  if (text.includes('other')) return 'other';
  return '';
}

function inferDomainPreset(raw) {
  const text = String(raw || '').toLowerCase();
  if (!text) return '';
  if (text.includes('active')) return 'active';
  if (text.includes('managed')) return 'managed_setup';
  if (text.includes('setup required')) return 'setup_required';
  if (text.includes('migration')) return 'migration';
  if (text.includes('both domain and hosting')) return 'both_support';
  if (text.includes('recommendation')) return 'recommendation';
  if (text.includes('cloud')) return 'cloud';
  if (text.includes('headless')) return 'headless';
  if (text.includes('other')) return 'other';
  return '';
}

function buildSubmissionDetailsHTML(s) {
  if (s.type === 'requirements') {
    return `
      <div class="drawer-section">
        <div class="drawer-section-title">Contact &amp; Ownership</div>
        <div class="detail-grid">
          ${df('Full Name', s.name)}
          ${df('Work Email', s.email)}
          ${df('Phone / WhatsApp', s.phone)}
          ${df('Company / Brand', s.company)}
          ${df('Role', s.role)}
          ${df('Decision Maker', s.decisionMaker)}
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Business Context</div>
        <div class="detail-grid">
          ${df('Selected Package', s.package)}
          ${df('Business Type', s.industry)}
          ${df('Target Audience', s.audience, true)}
        </div>
        <p class="drawer-micro-label">Goals</p>
        ${tagList(s.goals)}
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Website Scope &amp; Content</div>
        <div class="detail-grid">
          ${df('Current Website', s.currentSite || '—')}
          ${df('Expected Pages', s.pageCount)}
          ${df('Page List', s.pageList, true)}
          ${df('Content Status', s.contentStatus)}
          ${df('Brand Assets', s.brandAssets)}
          ${df('References / Competitors', s.references, true)}
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Features &amp; Integrations</div>
        <p class="drawer-micro-label">Selected Features</p>
        ${tagList(s.features, 'teal')}
        <div class="detail-grid" style="margin-top:0.85rem">
          ${df('Approx Product Count', s.productCount)}
          ${df('Payment Gateway', s.paymentGateway)}
          ${df('Third-Party Integrations', s.integrations, true)}
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Timeline, Budget &amp; Operations</div>
        <div class="detail-grid">
          ${df('Domain &amp; Hosting', s.domainHosting)}
          ${df('Preferred Launch Date', s.launchDate)}
          ${df('Budget Range', s.budget)}
          ${df('Post-Launch Support', s.support)}
          ${df('Asset Sharing Link', s.assetsLink, true)}
          ${df('Additional Notes', s.notes, true)}
        </div>
      </div>

      ${buildClientSnapshotHTML(s)}

      <div class="drawer-section">
        <div class="drawer-section-title">Submission Info</div>
        <div class="detail-grid">
          ${df('Submitted On', fmtDate(s.createdAt))}
          ${df('Last Updated', fmtDate(s.updatedAt))}
          ${df('New Stage Date', fmtDate(s.newStageAt || s.new_stage_at))}
          ${df('In Review Date', fmtDate(s.inReviewAt || s.in_review_at))}
          ${df('Proposal Sent Date', fmtDate(s.proposalSentAt || s.proposal_sent_at))}
          ${df('Closed Date', fmtDate(s.closedAt || s.closed_at))}
          ${df('Work Status', s.workStatus || s.work_status)}
          ${df('Work Status Updated', fmtDate(s.workStatusUpdatedAt || s.work_status_updated_at))}
          ${df('Quote Response', s.quote_response ? String(s.quote_response).toUpperCase() : '')}
          ${df('Client Message', s.quote_message, true)}
          ${df('Response Date', fmtDate(s.quote_response_at))}
          ${df('Record ID', s.id, true)}
        </div>
      </div>`;
  }

  return `
    <div class="drawer-section">
      <div class="drawer-section-title">Contact Details</div>
      <div class="detail-grid">
        ${df('Full Name', s.name)}
        ${df('Email', s.email)}
        ${df('Company / Brand', s.company)}
        ${df('Current Website', s.website)}
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Project Details</div>
      <div class="detail-grid">
        ${df('Required Service', s.service)}
        ${df('Budget Range', s.budget)}
        ${df('Preferred Timeline', s.timeline)}
        ${df('Project Brief', s.details, true)}
      </div>
    </div>

    ${buildClientSnapshotHTML(s)}

    <div class="drawer-section">
      <div class="drawer-section-title">Submission Info</div>
      <div class="detail-grid">
        ${df('Submitted On', fmtDate(s.createdAt))}
        ${df('Last Updated', fmtDate(s.updatedAt))}
        ${df('Quote Response', s.quote_response ? String(s.quote_response).toUpperCase() : '')}
        ${df('Client Message', s.quote_message, true)}
        ${df('Response Date', fmtDate(s.quote_response_at))}
        ${df('Record ID', s.id, true)}
      </div>
    </div>`;
}

function buildQuoteWorkspaceHTML(s) {
  const id = String(s.id);
  const base = baseQuoteSeed(s);
  const pages = parsePageCountSeed(s.pageCount || s.page_count);
  const pageRate = s.type === 'requirements' ? 350 : 280;
  const features = featureQuoteSeed(s);
  const support = supportQuoteSeed(s);
  const rush = rushQuoteSeed(s);
  const discount = Number(s.discount_percent || 0);
  const prefilledQuote = String(s.final_quote || '').trim();
  const pageRangePreset = inferPageRangePreset(s.pageCount || s.page_count);
  const contentPreset = inferContentPreset(s.contentStatus || s.content_status);
  const supportPreset = inferSupportPreset(s.support);
  const brandPreset = inferBrandPreset(s.brandAssets || s.brand_assets);
  const domainPreset = inferDomainPreset(s.domainHosting || s.domain_hosting);
  const workStatus = String(s.workStatus || s.work_status || 'queued').trim().toLowerCase() || 'queued';
  const workStatusDateRaw = s.workStatusUpdatedAt || s.work_status_updated_at || '';
  const workStatusDateText = workStatusDateRaw ? fmtDate(workStatusDateRaw) : '';

  return `
    <div class="quote-lab">
      <h4>Live Quote Calculator</h4>
      <p>This quote model is pre-filled from the selected submission. Adjust values and send directly to the client.</p>

      <div class="quote-grid">
        <div class="quote-field">
          <label for="quote-base-${id}">Base Cost (INR)</label>
          <input type="number" id="quote-base-${id}" value="${base}" min="0" step="100">
        </div>
        <div class="quote-field">
          <label for="quote-pages-${id}">Pages</label>
          <input type="number" id="quote-pages-${id}" value="${pages}" min="1" step="1">
        </div>
        <div class="quote-field">
          <label for="quote-page-rate-${id}">Per-Page Rate (INR)</label>
          <input type="number" id="quote-page-rate-${id}" value="${pageRate}" min="0" step="50">
        </div>
        <div class="quote-field">
          <label for="quote-features-${id}">Feature Add-ons (INR)</label>
          <input type="number" id="quote-features-${id}" value="${features}" min="0" step="100">
        </div>
        <div class="quote-field">
          <label for="quote-support-${id}">Support Cost (INR)</label>
          <input type="number" id="quote-support-${id}" value="${support}" min="0" step="100">
        </div>
        <div class="quote-field">
          <label for="quote-custom-${id}">Custom Line Item (INR)</label>
          <input type="number" id="quote-custom-${id}" value="0" min="0" step="100">
        </div>
        <div class="quote-field">
          <label for="quote-custom-label-${id}">Custom Line Label</label>
          <input type="text" id="quote-custom-label-${id}" placeholder="e.g. API Integration, Data Cleanup">
        </div>
        <div class="quote-field full">
          <label for="quote-page-range-${id}">Page Range Preset</label>
          <select id="quote-page-range-${id}">
            <option value="">Select from requirement options</option>
            <option value="1-5" ${pageRangePreset === '1-5' ? 'selected' : ''}>1-5 pages</option>
            <option value="6-10" ${pageRangePreset === '6-10' ? 'selected' : ''}>6-10 pages</option>
            <option value="11-20" ${pageRangePreset === '11-20' ? 'selected' : ''}>11-20 pages</option>
            <option value="21-35" ${pageRangePreset === '21-35' ? 'selected' : ''}>21-35 pages</option>
            <option value="36-50" ${pageRangePreset === '36-50' ? 'selected' : ''}>36-50 pages</option>
            <option value="51-100" ${pageRangePreset === '51-100' ? 'selected' : ''}>51-100 pages</option>
            <option value="100+" ${pageRangePreset === '100+' ? 'selected' : ''}>100+ pages</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-content-status-${id}">Content Readiness</label>
          <select id="quote-content-status-${id}">
            <option value="">Select one</option>
            <option value="ready" ${contentPreset === 'ready' ? 'selected' : ''}>Content ready (final copy)</option>
            <option value="partial" ${contentPreset === 'partial' ? 'selected' : ''}>Content partially ready</option>
            <option value="draft_edit" ${contentPreset === 'draft_edit' ? 'selected' : ''}>Draft exists, editing needed</option>
            <option value="copy_support" ${contentPreset === 'copy_support' ? 'selected' : ''}>Need copywriting support</option>
            <option value="strategy_copy" ${contentPreset === 'strategy_copy' ? 'selected' : ''}>Need content strategy + copy</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-support-plan-${id}">Support Preference</label>
          <select id="quote-support-plan-${id}">
            <option value="">Select one</option>
            <option value="ongoing" ${supportPreset === 'ongoing' ? 'selected' : ''}>Ongoing monthly support</option>
            <option value="quarterly" ${supportPreset === 'quarterly' ? 'selected' : ''}>Quarterly retainer</option>
            <option value="annual" ${supportPreset === 'annual' ? 'selected' : ''}>Annual support contract</option>
            <option value="ondemand" ${supportPreset === 'ondemand' ? 'selected' : ''}>On-demand support</option>
            <option value="one_time" ${supportPreset === 'one_time' ? 'selected' : ''}>One-time build only</option>
            <option value="undecided" ${supportPreset === 'undecided' ? 'selected' : ''}>Undecided</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-brand-assets-${id}">Brand Assets</label>
          <select id="quote-brand-assets-${id}">
            <option value="">Select one</option>
            <option value="full_brand" ${brandPreset === 'full_brand' ? 'selected' : ''}>Full brand system</option>
            <option value="logo_palette" ${brandPreset === 'logo_palette' ? 'selected' : ''}>Logo + color palette</option>
            <option value="logo_only" ${brandPreset === 'logo_only' ? 'selected' : ''}>Logo only</option>
            <option value="moodboard" ${brandPreset === 'moodboard' ? 'selected' : ''}>Moodboard / references only</option>
            <option value="rebrand_upgrade" ${brandPreset === 'rebrand_upgrade' ? 'selected' : ''}>Rebrand upgrade needed</option>
            <option value="no_assets" ${brandPreset === 'no_assets' ? 'selected' : ''}>No assets yet</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-domain-hosting-${id}">Domain / Hosting Readiness</label>
          <select id="quote-domain-hosting-${id}">
            <option value="">Select one</option>
            <option value="active" ${domainPreset === 'active' ? 'selected' : ''}>Domain + hosting active</option>
            <option value="managed_setup" ${domainPreset === 'managed_setup' ? 'selected' : ''}>Managed hosting setup needed</option>
            <option value="setup_required" ${domainPreset === 'setup_required' ? 'selected' : ''}>Domain available; setup required</option>
            <option value="migration" ${domainPreset === 'migration' ? 'selected' : ''}>Hosting migration / optimization</option>
            <option value="both_support" ${domainPreset === 'both_support' ? 'selected' : ''}>Support for domain + hosting</option>
            <option value="recommendation" ${domainPreset === 'recommendation' ? 'selected' : ''}>Need infrastructure recommendation</option>
            <option value="cloud">Cloud infra (AWS/GCP/Azure)</option>
            <option value="headless">Headless deployment stack</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-performance-target-${id}">Performance Target</label>
          <select id="quote-performance-target-${id}">
            <option value="">Select one</option>
            <option value="cwv">Core Web Vitals pass</option>
            <option value="lcp_25">LCP under 2.5s mobile</option>
            <option value="lh_85">Lighthouse 85+</option>
            <option value="lh_90">Lighthouse 90+</option>
            <option value="lh_95">Lighthouse 95+</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-accessibility-level-${id}">Accessibility</label>
          <select id="quote-accessibility-level-${id}">
            <option value="">Select one</option>
            <option value="standard">Standard best practices</option>
            <option value="wcag_aa">WCAG 2.1 AA</option>
            <option value="wcag_audit">WCAG audit + remediation</option>
            <option value="legal_statement">Accessibility statement + legal review</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-feedback-cycle-${id}">Feedback Cycle</label>
          <select id="quote-feedback-cycle-${id}">
            <option value="">Select one</option>
            <option value="weekly">Weekly review calls</option>
            <option value="biweekly">Bi-weekly review calls</option>
            <option value="async">Async review</option>
            <option value="daily_critical">Daily sync for critical milestones</option>
            <option value="milestone_single">Single review per milestone</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-support-sla-${id}">Support SLA</label>
          <select id="quote-support-sla-${id}">
            <option value="">Select one</option>
            <option value="business_hours">Business-hours SLA</option>
            <option value="response_24h">Response within 24 hours</option>
            <option value="critical_4_8h">Critical response in 4-8 hours</option>
            <option value="incidents_24_7">24x7 critical incident SLA</option>
            <option value="dedicated_manager">Dedicated manager + escalation matrix</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-training-${id}">Training Requirement</label>
          <select id="quote-training-${id}">
            <option value="">Select one</option>
            <option value="cms_session">CMS training session</option>
            <option value="docs_only">Documentation only</option>
            <option value="videos">Recorded walkthrough videos</option>
            <option value="role_based">Admin + editor role-based training</option>
            <option value="none">No training required</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-payment-terms-${id}">Payment Terms</label>
          <select id="quote-payment-terms-${id}">
            <option value="">Select one</option>
            <option value="split_50_50">50% upfront / 50% on launch</option>
            <option value="split_40_30_30">40% / 30% / 30%</option>
            <option value="split_30_40_30">30% / 40% / 30%</option>
            <option value="monthly_invoice">Monthly invoice cycle</option>
            <option value="milestone_custom">Milestone-based custom split</option>
            <option value="recommendation">Need recommendation</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-redirect-plan-${id}">Redirect Plan</label>
          <select id="quote-redirect-plan-${id}">
            <option value="">Select one</option>
            <option value="mapping">Old → new URL mapping</option>
            <option value="legacy_seo">Legacy SEO + backlink mapping</option>
            <option value="none_new">No redirect needed (new structure)</option>
            <option value="unsure">Unsure</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-design-system-${id}">Design System Requirement</label>
          <select id="quote-design-system-${id}">
            <option value="">Select one</option>
            <option value="basic">Basic component styling</option>
            <option value="full">Full reusable design system</option>
            <option value="audit_extend">Design-system audit + extension</option>
            <option value="not_required">Not required</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field full">
          <label for="quote-integration-categories-${id}">Integration Categories (multi-select)</label>
          <select id="quote-integration-categories-${id}" multiple size="5">
            <option value="crm">CRM / Sales Ops</option>
            <option value="marketing">Marketing Automation</option>
            <option value="analytics">Analytics / Tracking</option>
            <option value="payments">Payments / Finance</option>
            <option value="logistics">Logistics / Fulfilment</option>
            <option value="support">Support / Helpdesk</option>
            <option value="sso">Auth / SSO</option>
            <option value="erp">ERP / Inventory</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-design-${id}">Design Multiplier</label>
          <select id="quote-design-${id}">
            <option value="1">Standard (1.0x)</option>
            <option value="1.2">Premium (1.2x)</option>
            <option value="1.5">High-End (1.5x)</option>
            <option value="2">Bespoke (2.0x)</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-rush-${id}">Timeline Multiplier</label>
          <select id="quote-rush-${id}">
            <option value="1" ${rush === 1 ? 'selected' : ''}>Standard (1.0x)</option>
            <option value="1.2" ${rush === 1.2 ? 'selected' : ''}>Fast Track (1.2x)</option>
            <option value="1.5" ${rush === 1.5 ? 'selected' : ''}>Urgent (1.5x)</option>
          </select>
        </div>
        <div class="quote-field">
          <label for="quote-discount-${id}">Discount (%)</label>
          <input type="number" id="quote-discount-${id}" value="${discount}" min="0" max="100" step="1">
        </div>
        <div class="quote-field">
          <label for="quote-tax-${id}">Tax / GST (%)</label>
          <input type="number" id="quote-tax-${id}" value="0" min="0" max="100" step="1">
        </div>
        <div class="quote-field full">
          <label for="quote-note-${id}">Quote Notes (for PDF)</label>
          <textarea id="quote-note-${id}" rows="2" placeholder="Optional notes, payment terms, delivery milestones…"></textarea>
        </div>
        ${s.type === 'requirements' ? `
        <div class="quote-field full">
          <label for="quote-work-status-${id}">Website Work Status</label>
          <select id="quote-work-status-${id}">
            <option value="queued" ${workStatus === 'queued' ? 'selected' : ''}>Queued</option>
            <option value="ongoing" ${workStatus === 'ongoing' ? 'selected' : ''}>Ongoing</option>
            <option value="testing" ${workStatus === 'testing' ? 'selected' : ''}>Testing</option>
            <option value="revision" ${workStatus === 'revision' ? 'selected' : ''}>Revision</option>
            <option value="completed" ${workStatus === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="on-hold" ${workStatus === 'on-hold' ? 'selected' : ''}>On Hold</option>
          </select>
          <small id="quote-work-status-meta-${id}" style="color:var(--muted);font-size:0.72rem;">${workStatusDateText ? `Last updated: ${esc(workStatusDateText)}` : 'Not updated yet'}</small>
        </div>` : ''}
      </div>

      <div class="quote-lines" id="quote-lines-${id}"></div>

      <div class="quote-total-box">
        <small>Client Quote</small>
        <strong id="final-quote-${id}">${esc(prefilledQuote || '₹0')}</strong>
        <em id="quote-total-sub-${id}">Ready to send</em>
      </div>

      <input type="hidden" id="quote-input-${id}" value="${esc(prefilledQuote)}">

      <div class="quote-actions">
        ${s.type === 'requirements' ? `
        <button
          id="save-work-status-${id}"
          data-default-label="Update Work Status"
          class="btn-ghost"
          onclick="window.__saveWorkStatus('${id}','${s.type || 'requirements'}')"
        >
          Update Work Status
        </button>` : ''}
        <button
          id="save-discount-${id}"
          data-default-label="Save Quote"
          class="btn-ghost"
          onclick="window.__saveDiscount('${id}','${s.type || 'requirements'}')"
        >
          Save Quote
        </button>
        <button
          id="send-quote-${id}"
          data-default-label="Send Quote to Client"
          class="btn-primary"
          onclick="window.__sendQuote('${id}','${s.type || 'requirements'}')"
        >
          Send Quote to Client
        </button>
        <button
          id="download-quote-${id}"
          class="btn-ghost"
          onclick="window.__downloadQuotePdf('${id}','${s.type || 'requirements'}')"
        >
          Download Quote PDF
        </button>
      </div>
    </div>`;
}

function buildDrawerHTML(s) {
  return `
    <div class="drawer-workspace">
      <div class="drawer-pane left">
        ${buildSubmissionDetailsHTML(s)}
      </div>
      <div class="drawer-pane right">
        ${buildQuoteWorkspaceHTML(s)}
      </div>
    </div>`;
}

function openDrawer(id, col) {
  const s = allSubmissions.find(x => x.id === id);
  if (!s) return;

  activeDrawerId  = id;
  activeDrawerCol = col;

  drawerTitle.textContent = s.name || 'Unnamed';
  drawerSub.textContent   = `${s.type === 'requirements' ? 'Requirements Form' : 'Project Inquiry'} · ${fmtDate(s.createdAt)}`;
  drawerBody.innerHTML    = buildDrawerHTML(s);

  drawer.classList.add('open');
  drawerOverlay.classList.add('open');
  drawerBody.scrollTop = 0;

  // Trap focus inside drawer
  drawer.querySelector('[tabindex="0"], button, a')?.focus();

  // ── Init quote workspace ──────────────────────────────────────────────────
  initQuoteWorkspace(s);
}

// ── Discount calculator helpers ─────────────────────────────────────────────

const fmtINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

function readQuoteNumber(id, key, fallback = 0) {
  const el = document.getElementById(`quote-${key}-${id}`);
  if (!el) return fallback;
  const val = Number(el.value);
  return Number.isFinite(val) ? val : fallback;
}

function readQuoteValue(id, key, fallback = '') {
  const el = document.getElementById(`quote-${key}-${id}`);
  if (!el) return fallback;
  return String(el.value || '').trim();
}

function readQuoteMultiValues(id, key) {
  const el = document.getElementById(`quote-${key}-${id}`);
  if (!el || !el.multiple) return [];
  return [...el.selectedOptions]
    .map((opt) => String(opt.value || '').trim())
    .filter(Boolean);
}

function computeDrawerQuote(id) {
  const base = Math.max(0, readQuoteNumber(id, 'base', 3500));
  const pages = Math.max(1, readQuoteNumber(id, 'pages', 5));
  const pageRate = Math.max(0, readQuoteNumber(id, 'page-rate', 350));
  const features = Math.max(0, readQuoteNumber(id, 'features', 0));
  const support = Math.max(0, readQuoteNumber(id, 'support', 0));
  const custom = Math.max(0, readQuoteNumber(id, 'custom', 0));
  const customLabel = readQuoteValue(id, 'custom-label', 'Custom Line Item') || 'Custom Line Item';
  const design = Math.max(1, readQuoteNumber(id, 'design', 1));
  const rush = Math.max(1, readQuoteNumber(id, 'rush', 1));
  const discountPct = Math.min(100, Math.max(0, readQuoteNumber(id, 'discount', 0)));
  const taxPct = Math.min(100, Math.max(0, readQuoteNumber(id, 'tax', 0)));

  const presetFields = [
    { key: 'content-status', mapKey: 'contentStatus', label: 'Content Readiness' },
    { key: 'support-plan', mapKey: 'supportPlan', label: 'Support Preference' },
    { key: 'brand-assets', mapKey: 'brandAssets', label: 'Brand Assets' },
    { key: 'domain-hosting', mapKey: 'domainHosting', label: 'Domain / Hosting' },
    { key: 'performance-target', mapKey: 'performanceTarget', label: 'Performance Target' },
    { key: 'accessibility-level', mapKey: 'accessibilityLevel', label: 'Accessibility' },
    { key: 'feedback-cycle', mapKey: 'feedbackCycle', label: 'Feedback Cycle' },
    { key: 'support-sla', mapKey: 'supportSla', label: 'Support SLA' },
    { key: 'training', mapKey: 'training', label: 'Training Requirement' },
    { key: 'payment-terms', mapKey: 'paymentTerms', label: 'Payment Terms Preference' },
    { key: 'redirect-plan', mapKey: 'redirectPlan', label: 'Redirect Plan' },
    { key: 'design-system', mapKey: 'designSystem', label: 'Design System Requirement' },
  ];

  const presetLines = [];
  let presetTotal = 0;
  presetFields.forEach((preset) => {
    const code = readQuoteValue(id, preset.key, '');
    if (!code) return;
    const amount = QUOTE_PRESET_COSTS[preset.mapKey]?.[code] || 0;
    if (amount <= 0) return;
    presetTotal += amount;
    presetLines.push({ label: preset.label, value: fmtINR(amount) });
  });

  const integrationCodes = readQuoteMultiValues(id, 'integration-categories');
  const integrationCost = integrationCodes.reduce(
    (sum, code) => sum + (QUOTE_INTEGRATION_CATEGORY_COSTS[code] || 0),
    0
  );
  if (integrationCost > 0) {
    presetTotal += integrationCost;
    presetLines.push({
      label: `Integration Categories (${integrationCodes.length})`,
      value: fmtINR(integrationCost),
    });
  }

  const pageCost = Math.round(pages * pageRate);
  const preDesign = base + pageCost + features + support + custom + presetTotal;
  const afterDesign = Math.round(preDesign * design);
  const afterRush = Math.round(afterDesign * rush);
  const discountAmt = Math.round(afterRush * (discountPct / 100));
  const afterDiscount = Math.max(0, afterRush - discountAmt);
  const taxAmt = Math.round(afterDiscount * (taxPct / 100));
  const grandTotal = afterDiscount + taxAmt;

  const lines = [
    { label: 'Base Cost', value: fmtINR(base) },
    { label: `Pages (${pages} × ${fmtINR(pageRate)})`, value: fmtINR(pageCost) },
    { label: 'Feature Add-ons', value: fmtINR(features) },
    { label: 'Support', value: fmtINR(support) },
  ];
  lines.push(...presetLines);
  if (custom > 0) lines.push({ label: customLabel, value: fmtINR(custom) });
  if (design !== 1) lines.push({ label: `Design Multiplier (${design.toFixed(2)}x)`, value: fmtINR(afterDesign - preDesign) });
  if (rush !== 1) lines.push({ label: `Timeline Multiplier (${rush.toFixed(2)}x)`, value: fmtINR(afterRush - afterDesign) });
  if (discountPct > 0) lines.push({ label: `Discount (${discountPct}%)`, value: `-${fmtINR(discountAmt)}` });
  if (taxPct > 0) lines.push({ label: `Tax / GST (${taxPct}%)`, value: `+${fmtINR(taxAmt)}` });

  return {
    lines,
    grandTotal,
    discountPct,
    taxPct,
    formattedTotal: fmtINR(grandTotal),
  };
}

function renderDrawerQuote(id) {
  const model = computeDrawerQuote(id);
  const linesEl = document.getElementById(`quote-lines-${id}`);
  const finalEl = document.getElementById(`final-quote-${id}`);
  const quoteInput = document.getElementById(`quote-input-${id}`);
  const totalSubEl = document.getElementById(`quote-total-sub-${id}`);

  if (linesEl) {
    linesEl.innerHTML = [
      ...model.lines.map((line) => `<div class="quote-line"><span>${esc(line.label)}</span><span>${esc(line.value)}</span></div>`),
      `<div class="quote-line total"><span>Final Client Quote</span><span>${esc(model.formattedTotal)}</span></div>`,
    ].join('');
  }
  if (finalEl) finalEl.textContent = model.formattedTotal;
  if (quoteInput) quoteInput.value = model.formattedTotal;
  if (totalSubEl) {
    totalSubEl.textContent = model.taxPct > 0
      ? `Includes ${model.taxPct}% tax`
      : 'Before tax';
  }
  return model;
}

function initQuoteWorkspace(s) {
  const id = String(s.id);
  const watchedKeys = [
    'base',
    'pages',
    'page-rate',
    'features',
    'support',
    'custom',
    'custom-label',
    'design',
    'rush',
    'discount',
    'tax',
    'page-range',
    'content-status',
    'support-plan',
    'brand-assets',
    'domain-hosting',
    'performance-target',
    'accessibility-level',
    'feedback-cycle',
    'support-sla',
    'training',
    'payment-terms',
    'redirect-plan',
    'design-system',
  ];

  watchedKeys.forEach((key) => {
    const el = document.getElementById(`quote-${key}-${id}`);
    if (!el) return;
    el.addEventListener('input', () => renderDrawerQuote(id));
    el.addEventListener('change', () => renderDrawerQuote(id));
  });

  const integrationEl = document.getElementById(`quote-integration-categories-${id}`);
  if (integrationEl) {
    integrationEl.addEventListener('change', () => renderDrawerQuote(id));
    integrationEl.addEventListener('input', () => renderDrawerQuote(id));
  }

  const pagePresetEl = document.getElementById(`quote-page-range-${id}`);
  if (pagePresetEl) {
    pagePresetEl.addEventListener('change', () => {
      const preset = QUOTE_PAGE_RANGE_PRESETS[pagePresetEl.value];
      if (preset) {
        const pagesEl = document.getElementById(`quote-pages-${id}`);
        const pageRateEl = document.getElementById(`quote-page-rate-${id}`);
        if (pagesEl) pagesEl.value = String(preset.pages);
        if (pageRateEl) pageRateEl.value = String(preset.rate);
      }
      renderDrawerQuote(id);
    });
    if (pagePresetEl.value && QUOTE_PAGE_RANGE_PRESETS[pagePresetEl.value]) {
      const preset = QUOTE_PAGE_RANGE_PRESETS[pagePresetEl.value];
      const pagesEl = document.getElementById(`quote-pages-${id}`);
      const pageRateEl = document.getElementById(`quote-page-rate-${id}`);
      if (pagesEl) pagesEl.value = String(preset.pages);
      if (pageRateEl) pageRateEl.value = String(preset.rate);
    }
  }

  renderDrawerQuote(id);
}

// Global handlers (called from inline onclick in drawer HTML)
window.__saveWorkStatus = async function(id, type) {
  if (type !== 'requirements') return;
  const statusEl = document.getElementById(`quote-work-status-${id}`);
  const metaEl = document.getElementById(`quote-work-status-meta-${id}`);
  const saveBtn = document.getElementById(`save-work-status-${id}`);
  if (!statusEl) return;

  const workStatus = String(statusEl.value || '').trim().toLowerCase();
  if (!workStatus) return;

  if (saveBtn) {
    saveBtn.textContent = 'Updating...';
    saveBtn.disabled = true;
  }

  try {
    await apiRequest('PATCH', `/requirements/${id}/work-status`, { workStatus });
    const submission = allSubmissions.find(x => x.id === id);
    if (submission) {
      submission.work_status = workStatus;
      submission.workStatus = workStatus;
      const nowIso = new Date().toISOString();
      submission.work_status_updated_at = nowIso;
      submission.workStatusUpdatedAt = nowIso;
    }
    if (metaEl) {
      metaEl.textContent = `Last updated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (saveBtn) {
      const defaultLabel = saveBtn.dataset.defaultLabel || 'Update Work Status';
      saveBtn.textContent = '✓ Updated';
      setTimeout(() => {
        saveBtn.textContent = defaultLabel;
        saveBtn.disabled = false;
      }, 1400);
    }
  } catch (err) {
    console.error('Failed to update work status:', err);
    if (saveBtn) {
      saveBtn.textContent = '❌ Error';
      saveBtn.disabled = false;
    }
    alert(err?.message || 'Failed to update work status.');
  }
};

window.__saveDiscount = async function(id, type, skipSuccessMsg = false, options = {}) {
  const { requireQuote = false } = options || {};
  const slider = document.getElementById(`discount-slider-${id}`);
  const discountInput = document.getElementById(`quote-discount-${id}`);
  const quoteInput = document.getElementById(`quote-input-${id}`);
  const finalDisplay = document.getElementById(`final-quote-${id}`);
  const saveBtn = document.getElementById(`save-discount-${id}`);
  if (!slider && !quoteInput && !finalDisplay && !discountInput) return;

  const submission = allSubmissions.find(x => x.id === id);
  const discountPercent = slider
    ? (parseInt(slider.value, 10) || 0)
    : discountInput
      ? (parseInt(discountInput.value, 10) || 0)
      : Number(submission?.discount_percent || 0);
  let finalQuote = quoteInput
    ? quoteInput.value.trim()
    : (finalDisplay?.textContent?.trim() || '');

  if ((!finalQuote || finalQuote === '—') && document.getElementById(`quote-base-${id}`)) {
    const model = renderDrawerQuote(String(id));
    finalQuote = model?.formattedTotal || '';
  }

  if (requireQuote && !finalQuote) {
    if (quoteInput) quoteInput.focus();
    throw new Error('Please enter a final quote before sending it to the client.');
  }

  const col = type === 'requirements' ? 'requirements' : 'inquiries';

  if (saveBtn && !skipSuccessMsg) {
    saveBtn.textContent = 'Saving…';
    saveBtn.disabled = true;
  }

  try {
    await apiRequest('PATCH', `/${col}/${id}/discount`, { discountPercent, finalQuote });
    // Update local state
    if (submission) {
      submission.discount_percent = discountPercent;
      submission.final_quote = finalQuote;
    }
    if (saveBtn && !skipSuccessMsg) {
      const defaultLabel = saveBtn.dataset.defaultLabel || 'Save Quote';
      saveBtn.textContent = '✓ Saved!';
      setTimeout(() => {
        saveBtn.textContent = defaultLabel;
        saveBtn.disabled = false;
      }, 1500);
    }
  } catch (err) {
    console.error('Failed to save discount:', err);
    if (saveBtn && !skipSuccessMsg) {
      saveBtn.textContent = '❌ Error';
      saveBtn.disabled = false;
    }
    throw err;
  }
};

window.__sendQuote = async function(id, type) {
  const sendBtn = document.getElementById(`send-quote-${id}`);
  const quoteInput = document.getElementById(`quote-input-${id}`);
  const finalDisplay = document.getElementById(`final-quote-${id}`);
  let finalQuote = quoteInput?.value?.trim() || finalDisplay?.textContent?.trim() || '';
  if (!finalQuote && document.getElementById(`quote-base-${id}`)) {
    const model = renderDrawerQuote(String(id));
    finalQuote = model?.formattedTotal || '';
  }
  if (!finalQuote) {
    alert('Please finalize the quote before sending it to the client.');
    return;
  }

  if (sendBtn) { sendBtn.textContent = 'Sending...'; sendBtn.disabled = true; }
  
  try {
    // First save the discount
    await window.__saveDiscount(id, type, true, { requireQuote: true });

    // Then update status to 'proposal'
    const col = type === 'requirements' ? 'requirements' : 'inquiries';
    await apiRequest('PATCH', `/${col}/${id}/status`, { status: 'proposal' });
    
    // Update local state
    const s = allSubmissions.find(x => x.id === id);
    if (s) s.status = 'proposal';
    renderStats();
    
    // Update the UI select dropdown in the table
    const sel = document.querySelector(`.status-select[data-id="${id}"]`);
    if (sel) {
      sel.value = 'proposal';
      sel.className = `status-select proposal`;
    }
    
    if (sendBtn) { 
      sendBtn.textContent = '✓ Quote Sent!'; 
      setTimeout(() => {
        sendBtn.textContent = sendBtn.dataset.defaultLabel || 'Send Quote to Client';
        sendBtn.disabled = false;
      }, 2000); 
    }
  } catch (err) {
    console.error('Failed to send quote:', err);
    if (err?.message) alert(err.message);
    if (sendBtn) { sendBtn.textContent = '❌ Error'; sendBtn.disabled = false; }
  }
};

window.__downloadQuotePdf = function(id, type) {
  const submission = allSubmissions.find(x => x.id === id);
  if (!submission) return;
  if (!window.jspdf) {
    alert('PDF library not loaded. Please refresh and try again.');
    return;
  }

  const model = renderDrawerQuote(String(id));
  const note = document.getElementById(`quote-note-${id}`)?.value?.trim() || '';
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageWidth = 190;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(31, 39, 55);
  doc.text('Gelistra', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Official Project Quote', 15, y + 7);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth - 35, y + 7);
  y += 16;

  doc.setDrawColor(220);
  doc.setLineWidth(0.4);
  doc.line(15, y, pageWidth + 5, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 39, 55);
  doc.text('Prepared For', 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70);
  doc.text(`Name: ${submission.name || 'Client'}`, 15, y); y += 5;
  if (submission.company) { doc.text(`Company: ${submission.company}`, 15, y); y += 5; }
  if (submission.email) { doc.text(`Email: ${submission.email}`, 15, y); y += 5; }
  if (submission.phone) { doc.text(`Phone: ${submission.phone}`, 15, y); y += 5; }
  if (submission.package || submission.service) {
    doc.text(`Project: ${submission.package || submission.service}`, 15, y);
    y += 5;
  }
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 39, 55);
  doc.text('Quote Breakdown', 15, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  model.lines.forEach((line) => {
    doc.text(line.label, 17, y);
    doc.text(line.value, pageWidth - 2, y, { align: 'right' });
    y += 5;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  y += 2;
  doc.setDrawColor(220);
  doc.line(15, y, pageWidth + 5, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(239, 91, 55);
  doc.text('Final Client Quote', 15, y);
  doc.text(model.formattedTotal, pageWidth - 2, y, { align: 'right' });
  y += 8;

  if (note) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(31, 39, 55);
    doc.text('Notes', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    const noteLines = doc.splitTextToSize(note, pageWidth - 15);
    doc.text(noteLines, 15, y);
    y += noteLines.length * 4 + 4;
  }

  y = Math.max(y + 8, 266);
  if (y > 280) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(140);
  doc.text('This quote is valid for 30 days. Final scope confirmation may affect pricing.', 15, y);
  doc.text('© Gelistra · gelistra.com', 15, y + 4);

  const safeName = String(submission.name || 'Client').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  doc.save(`Gelistra-Quote-${safeName || 'Client'}-${id}.pdf`);
};

window.__resetDiscount = function(id) {
  const slider = document.getElementById(`discount-slider-${id}`);
  const discountInput = document.getElementById(`quote-discount-${id}`);
  const taxInput = document.getElementById(`quote-tax-${id}`);
  const customInput = document.getElementById(`quote-custom-${id}`);
  const customLabelInput = document.getElementById(`quote-custom-label-${id}`);
  const quoteInput = document.getElementById(`quote-input-${id}`);
  const presetKeys = [
    'page-range',
    'content-status',
    'support-plan',
    'brand-assets',
    'domain-hosting',
    'performance-target',
    'accessibility-level',
    'feedback-cycle',
    'support-sla',
    'training',
    'payment-terms',
    'redirect-plan',
    'design-system',
  ];
  if (slider) {
    slider.value = 0;
    slider.dispatchEvent(new Event('input'));
  }
  if (discountInput) discountInput.value = 0;
  if (taxInput) taxInput.value = 0;
  if (customInput) customInput.value = 0;
  if (customLabelInput) customLabelInput.value = '';
  presetKeys.forEach((key) => {
    const el = document.getElementById(`quote-${key}-${id}`);
    if (el) el.value = '';
  });
  const integrationEl = document.getElementById(`quote-integration-categories-${id}`);
  if (integrationEl) [...integrationEl.options].forEach((opt) => { opt.selected = false; });
  if (quoteInput && !document.getElementById(`quote-base-${id}`)) quoteInput.value = '';
  if (document.getElementById(`quote-base-${id}`)) renderDrawerQuote(String(id));
};

function closeDrawer() {
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  activeDrawerId  = null;
  activeDrawerCol = null;
}

drawerClose?.addEventListener('click', closeDrawer);
drawerCloseBtn?.addEventListener('click', closeDrawer);
drawerOverlay?.addEventListener('click', closeDrawer);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

// ── PDF download (from drawer) ─────────────────────────────────────────────────

drawerPdfBtn?.addEventListener('click', () => {
  if (!activeDrawerId) return;
  const s = allSubmissions.find(x => x.id === activeDrawerId);
  if (!s) return;
  downloadPDF(s);
});

async function downloadPDF(s) {
  try {
    const { generateInquiryPDF, generateRequirementsPDF } = await import('./pdf-generator.js');
    const safeName = (s.name || 'Client').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    const filename  = `Gelistra-${s.type === 'requirements' ? 'Requirements' : 'Inquiry'}-${safeName}.pdf`;
    const doc       = s.type === 'requirements'
      ? generateRequirementsPDF(s)
      : generateInquiryPDF(s);
    doc.save(filename);
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('Failed to generate PDF. Please try again.');
  }
}

// ── CSV export ─────────────────────────────────────────────────────────────────

exportCsvBtn?.addEventListener('click', () => {
  const list = getFiltered();
  if (!list.length) { alert('No submissions to export.'); return; }

  const headers = [
    'Type','Status','Name','Email','Phone','Company','Role',
    'Package/Service','Industry','Budget','Timeline','Launch Date',
    'Page Count','Goals','Features','Notes','Submitted On'
  ];

  const rows = list.map(s => [
    s.type, s.status, s.name, s.email, s.phone || '', s.company, s.role || '',
    s.package || s.service || '', s.industry || '', s.budget, s.timeline || '', s.launchDate || '',
    s.pageCount || '', (s.goals || []).join(' | '), (s.features || []).join(' | '),
    (s.notes || '').replace(/\n/g, ' '),
    fmtDate(s.createdAt)
  ].map(v => `"${String(v || '').replace(/"/g, '""')}"`));

  const csv  = [headers.map(h => `"${h}"`), ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `Gelistra-Submissions-${new Date().toISOString().slice(0,10)}.csv`
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Tab switching (Submissions ↔ Calculator) ──────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-admin-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-admin-tab]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${tab.dataset.adminTab}`);
    if (target) target.classList.add('active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Admin Cost Calculator ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const calcView = document.getElementById('view-calculator');
if (calcView) {
  const fmtINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

  // DOM refs
  const calcType       = document.getElementById('calc-type');
  const calcCustomWrap = document.getElementById('calc-custom-base-wrap');
  const calcCustomBase = document.getElementById('calc-custom-base');
  const calcPages      = document.getElementById('calc-pages');
  const calcPageRate   = document.getElementById('calc-page-rate');
  const calcDesign     = document.getElementById('calc-design');
  const calcRush       = document.getElementById('calc-rush');
  const calcSupport    = document.getElementById('calc-support');
  const calcDiscount   = document.getElementById('calc-discount');
  const calcTax        = document.getElementById('calc-tax');
  const calcCustomDesc = document.getElementById('calc-custom-desc');
  const calcCustomCost = document.getElementById('calc-custom-cost');
  const grandTotalEl   = document.getElementById('calc-grand-total');
  const totalSubEl     = document.getElementById('calc-total-sub');
  const lineItemsList  = document.getElementById('calc-line-items-list');
  const calcPdfBtn     = document.getElementById('calc-pdf-btn');
  const calcResetBtn   = document.getElementById('calc-reset-btn');

  // Toggle custom base price field
  calcType?.addEventListener('change', () => {
    if (calcCustomWrap) {
      calcCustomWrap.style.display = calcType.value === 'custom' ? '' : 'none';
    }
    recalcAdmin();
  });

  // Feature checkbox toggle visual
  document.querySelectorAll('#calc-features .calc-check input').forEach(cb => {
    const label = cb.closest('.calc-check');
    if (cb.checked) label.classList.add('checked');
    cb.addEventListener('change', () => {
      label.classList.toggle('checked', cb.checked);
      recalcAdmin();
    });
  });

  // Recalculate on any input change
  const allCalcInputs = [calcPages, calcPageRate, calcDesign, calcRush, calcSupport, calcDiscount, calcTax, calcCustomBase, calcCustomCost, calcCustomDesc];
  allCalcInputs.forEach(el => {
    el?.addEventListener('input', recalcAdmin);
    el?.addEventListener('change', recalcAdmin);
  });

  function recalcAdmin() {
    // Base price
    let baseCost = calcType.value === 'custom'
      ? Number(calcCustomBase?.value || 0)
      : Number(calcType.value || 3500);

    const typeLabel = calcType.value === 'custom'
      ? 'Custom Base'
      : calcType.options[calcType.selectedIndex]?.text.split('—')[0].trim() || 'Website';

    // Pages
    const pages    = Number(calcPages?.value || 5);
    const pageRate = Number(calcPageRate?.value || 350);
    const pageCost = pages * pageRate;

    // Design multiplier
    const designMult  = Number(calcDesign?.value || 1);
    const designLabel = calcDesign?.options[calcDesign.selectedIndex]?.text || 'Standard';

    // Features
    const featureCbs = [...document.querySelectorAll('#calc-features .calc-check input')];
    let featureCost = 0;
    const activeFeatures = [];
    featureCbs.forEach(cb => {
      if (cb.checked) {
        const cost = Number(cb.dataset.cost || 0);
        featureCost += cost;
        const name = cb.closest('.calc-check')?.querySelector('.calc-check-info span:first-child')?.textContent || 'Feature';
        activeFeatures.push({ name, cost });
      }
    });

    // Custom line item
    const customDesc = calcCustomDesc?.value.trim() || '';
    const customCost = Number(calcCustomCost?.value || 0);

    // Rush
    const rushMult  = Number(calcRush?.value || 1);
    const rushLabel = calcRush?.options[calcRush.selectedIndex]?.text || 'Standard';

    // Support
    const supportCost  = Number(calcSupport?.value || 0);
    const supportLabel = calcSupport?.options[calcSupport.selectedIndex]?.text.split('—')[0].trim() || 'None';

    // Calculations
    const baseAndPages = baseCost + pageCost;
    const designed     = Math.round(baseAndPages * designMult);
    const beforeRush   = designed + featureCost + customCost + supportCost;
    const afterRush    = Math.round(beforeRush * rushMult);

    // Discount
    const discountPct = Number(calcDiscount?.value || 0);
    const discountAmt = Math.round(afterRush * (discountPct / 100));
    const afterDiscount = afterRush - discountAmt;

    // Tax
    const taxPct = Number(calcTax?.value || 0);
    const taxAmt = Math.round(afterDiscount * (taxPct / 100));
    const grandTotal = afterDiscount + taxAmt;

    // Update grand total display
    if (grandTotalEl) grandTotalEl.textContent = fmtINR(grandTotal);
    if (totalSubEl) {
      if (taxPct > 0) totalSubEl.textContent = `Including ${taxPct}% GST`;
      else totalSubEl.textContent = 'Before tax';
    }

    // Build line items
    let html = '';
    html += lineHTML(`Base: ${typeLabel}`, fmtINR(baseCost));
    html += lineHTML(`${pages} pages × ${fmtINR(pageRate)}`, fmtINR(pageCost), true);

    if (designMult !== 1) {
      html += lineHTML(`Design: ${designLabel}`, `×${designMult}`);
      html += lineHTML(`Subtotal after design`, fmtINR(designed), true);
    }

    if (activeFeatures.length) {
      html += '<div class="calc-line-divider"></div>';
      activeFeatures.forEach(f => {
        html += lineHTML(f.name, fmtINR(f.cost), true);
      });
      html += lineHTML(`Features total`, fmtINR(featureCost));
    }

    if (customCost > 0 && customDesc) {
      html += '<div class="calc-line-divider"></div>';
      html += lineHTML(customDesc, fmtINR(customCost));
    }

    if (supportCost > 0) {
      html += lineHTML(`Support: ${supportLabel}`, fmtINR(supportCost));
    }

    if (rushMult > 1) {
      html += '<div class="calc-line-divider"></div>';
      html += lineHTML(`Rush: ${rushLabel.split('—')[0].trim()}`, `+${Math.round((rushMult - 1) * 100)}%`);
      html += lineHTML(`After rush premium`, fmtINR(afterRush), true);
    }

    if (discountPct > 0) {
      html += '<div class="calc-line-divider"></div>';
      html += lineHTML(`Discount (${discountPct}%)`, `−${fmtINR(discountAmt)}`);
    }

    if (taxPct > 0) {
      html += lineHTML(`GST (${taxPct}%)`, `+${fmtINR(taxAmt)}`);
    }

    html += '<div class="calc-line-divider"></div>';
    html += `<div class="calc-line total-line"><span>Grand Total</span><span>${fmtINR(grandTotal)}</span></div>`;

    if (lineItemsList) lineItemsList.innerHTML = html;
  }

  function lineHTML(label, value, sub = false) {
    return `<div class="calc-line ${sub ? 'sub-line' : ''}"><span>${label}</span><span>${value}</span></div>`;
  }

  // ── Quote PDF ────────────────────────────────────────────────────────────────
  calcPdfBtn?.addEventListener('click', () => {
    if (!window.jspdf) { alert('PDF library not loaded. Please reload the page.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const clientName    = document.getElementById('calc-client-name')?.value.trim() || 'Client';
    const clientCompany = document.getElementById('calc-client-company')?.value.trim() || '';
    const clientEmail   = document.getElementById('calc-client-email')?.value.trim() || '';
    const clientPhone   = document.getElementById('calc-client-phone')?.value.trim() || '';
    const clientNotes   = document.getElementById('calc-client-notes')?.value.trim() || '';

    const pw = 190;
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 39, 55);
    doc.text('Gelistra', 15, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Project Cost Quote', 15, y + 7);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, pw - 65, y + 7);
    y += 17;

    // Divider
    doc.setDrawColor(220);
    doc.setLineWidth(0.4);
    doc.line(15, y, pw + 5, y);
    y += 8;

    // Client info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 39, 55);
    doc.text('Prepared For', 15, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    if (clientName)    { doc.text(`Name: ${clientName}`, 15, y); y += 5; }
    if (clientCompany) { doc.text(`Company: ${clientCompany}`, 15, y); y += 5; }
    if (clientEmail)   { doc.text(`Email: ${clientEmail}`, 15, y); y += 5; }
    if (clientPhone)   { doc.text(`Phone: ${clientPhone}`, 15, y); y += 5; }
    y += 5;

    // Line items from summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 39, 55);
    doc.text('Cost Breakdown', 15, y);
    y += 7;

    const lines = lineItemsList?.querySelectorAll('.calc-line') || [];
    lines.forEach(line => {
      const spans = line.querySelectorAll('span');
      if (spans.length < 2) return;
      const label = spans[0].textContent;
      const value = spans[1].textContent;
      const isTotal = line.classList.contains('total-line');

      if (isTotal) {
        doc.setDrawColor(220);
        doc.line(15, y - 1, pw + 5, y - 1);
        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(239, 91, 55);
      } else if (line.classList.contains('sub-line')) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(120);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60);
      }

      doc.text(label, 17, y);
      doc.text(value, pw - 2, y, { align: 'right' });
      y += isTotal ? 7 : 5;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    // Notes
    if (clientNotes) {
      y += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 39, 55);
      doc.text('Notes', 15, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80);
      const noteLines = doc.splitTextToSize(clientNotes, pw - 15);
      doc.text(noteLines, 15, y);
      y += noteLines.length * 4 + 5;
    }

    // Footer
    y = Math.max(y + 10, 260);
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text('This quote is valid for 30 days from the date of generation. Prices are in INR.', 15, y);
    doc.text('© Gelistra · gelistra.com', 15, y + 4);

    const safeName = clientName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '') || 'Client';
    doc.save(`Gelistra-Quote-${safeName}-${new Date().toISOString().slice(0,10)}.pdf`);
  });

  // ── Reset ────────────────────────────────────────────────────────────────────
  calcResetBtn?.addEventListener('click', () => {
    if (calcType) { calcType.value = '3500'; }
    if (calcCustomWrap) calcCustomWrap.style.display = 'none';
    if (calcCustomBase) calcCustomBase.value = '3500';
    if (calcPages) calcPages.value = '5';
    if (calcPageRate) calcPageRate.value = '350';
    if (calcDesign) calcDesign.value = '1';
    if (calcRush) calcRush.value = '1';
    if (calcSupport) calcSupport.value = '0';
    if (calcDiscount) calcDiscount.value = '0';
    if (calcTax) calcTax.value = '0';
    if (calcCustomDesc) calcCustomDesc.value = '';
    if (calcCustomCost) calcCustomCost.value = '0';
    document.getElementById('calc-client-name').value = '';
    document.getElementById('calc-client-company').value = '';
    document.getElementById('calc-client-email').value = '';
    document.getElementById('calc-client-phone').value = '';
    document.getElementById('calc-client-notes').value = '';

    // Reset features: only CMS and SEO checked
    document.querySelectorAll('#calc-features .calc-check').forEach((label, i) => {
      const cb = label.querySelector('input');
      cb.checked = i < 2;
      label.classList.toggle('checked', cb.checked);
    });

    recalcAdmin();
  });

  // Initial calculation
  recalcAdmin();
}
