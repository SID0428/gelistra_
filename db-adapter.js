// ─── Gelistra DB Adapter ─────────────────────────────────────────────────────
// Thin wrapper around the MySQL adapter.
// All database communication goes through the Node.js/Express backend.
// ─────────────────────────────────────────────────────────────────────────────

let _adapter = null;

function getStoredAuthToken() {
  if (typeof localStorage === 'undefined') return null;
  const parse = (raw) => {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      return obj?.token || null;
    } catch {
      return null;
    }
  };
  // This adapter is used by the client-facing flows (login/account/forms),
  // so prioritize end-user token to avoid hitting user-only endpoints as admin.
  return parse(localStorage.getItem('gelistra_user')) || parse(localStorage.getItem('gelistra_admin'));
}

async function getAdapter() {
  if (_adapter) return _adapter;
  const mod = await import('./mysql-adapter.js');
  _adapter = mod.MysqlAdapter;
  if (typeof mod.setAuthToken === 'function') {
    mod.setAuthToken(getStoredAuthToken());
  }
  return _adapter;
}

export async function login(email, password) {
  const db = await getAdapter();
  return db.login(email, password);
}

export async function signup(name, email, password) {
  const db = await getAdapter();
  return db.signup(name, email, password);
}

export async function saveInquiry(data) {
  const db = await getAdapter();
  return db.saveInquiry(data);
}

export async function saveRequirements(data) {
  const db = await getAdapter();
  return db.saveRequirements(data);
}

export async function getSubmissions(filter = {}) {
  const db = await getAdapter();
  return db.getSubmissions(filter);
}

// colName: 'inquiries' | 'requirements'  — tells the adapter which table
export async function updateStatus(id, status, colName) {
  const db = await getAdapter();
  return db.updateStatus(id, status, colName);
}

export async function respondToQuote(id, colName, decision, message = '') {
  const db = await getAdapter();
  return db.respondToQuote(id, colName, decision, message);
}

export async function getSubmissionById(id, colName) {
  const db = await getAdapter();
  return db.getSubmissionById(id, colName);
}
