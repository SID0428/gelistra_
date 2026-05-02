// ─── Gelistra MySQL Adapter ──────────────────────────────────────────────────
// Communicates with the Node.js/Express backend REST API.
// The backend handles the actual MySQL queries.
//
// Set API_BASE_URL to your deployed backend URL.
// See SETUP.md for backend setup + SQL schema.
// ─────────────────────────────────────────────────────────────────────────────

// ── YOUR BACKEND API URL ─────────────────────────────────────────────────────
// Local development:  'http://localhost:3000/api'
// Production:         'https://api.gelistra.com/api'  ← replace with your URL
function resolveApiBaseUrl() {
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
const API_BASE_URL = resolveApiBaseUrl();
// ─────────────────────────────────────────────────────────────────────────────

// Admin auth token — set this after logging in via your backend auth system
let _authToken = null;

export function setAuthToken(token) {
  _authToken = token;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE_URL}${path}`, options);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `API error ${res.status}`);
  }

  return res.json();
}

// ── Public API ───────────────────────────────────────────────────────────────

export const MysqlAdapter = {

  async login(email, password) {
    const result = await request('POST', '/auth/login', { email, password });
    if (result?.token) _authToken = result.token;
    return result;
  },

  async signup(name, email, password) {
    const result = await request('POST', '/auth/signup', { name, email, password });
    if (result?.token) _authToken = result.token;
    return result;
  },

  async saveInquiry(data) {
    return request('POST', '/inquiries', { ...data, type: 'inquiry', status: 'new' });
  },

  async saveRequirements(data) {
    return request('POST', '/requirements', { ...data, type: 'requirements', status: 'new' });
  },

  async getSubmissions(filter = {}) {
    const params = new URLSearchParams();
    if (filter.type) params.set('type', filter.type);
    if (filter.status) params.set('status', filter.status);
    if (filter.package) params.set('package', filter.package);
    if (filter.customerId) params.set('customerId', filter.customerId);
    const qs = params.toString() ? `?${params}` : '';
    return request('GET', `/submissions${qs}`);
  },

  async updateStatus(id, status, colName) {
    const endpoint = colName === 'requirements'
      ? `/requirements/${id}/status`
      : `/inquiries/${id}/status`;
    return request('PATCH', endpoint, { status });
  },

  async respondToQuote(id, colName, decision, message = '') {
    const endpoint = colName === 'requirements'
      ? `/requirements/${id}/quote-response`
      : `/inquiries/${id}/quote-response`;
    return request('PATCH', endpoint, { decision, message });
  },

  async getSubmissionById(id, colName) {
    const endpoint = colName === 'requirements'
      ? `/requirements/${id}`
      : `/inquiries/${id}`;
    return request('GET', endpoint);
  },
};
