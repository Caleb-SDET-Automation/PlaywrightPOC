'use strict';
/**
 * DemoERP — Synthetic Monitoring Demo Application
 *
 * Routes:
 *   GET  /                       → redirect to /dashboard or /login
 *   GET  /login                  → login page
 *   POST /login                  → authenticate, set session cookie
 *   POST /logout                 → clear session
 *   GET  /dashboard              → KPI cards + recent items        (auth)
 *   GET  /inventory              → full inventory table            (auth)
 *   GET  /inventory/new          → create item form                (auth)
 *   POST /inventory/new          → save new item                   (auth)
 *   GET  /inventory/:id/edit     → pre-filled edit form            (auth)
 *   POST /inventory/:id/edit     → save updated item               (auth)
 *   POST /inventory/:id/delete   → delete item                     (auth)
 *   GET  /reports                → category & status reports       (auth)
 *   GET  /health                 → JSON health probe
 *   GET  /api/inventory          → JSON full list
 *   GET  /api/inventory/:id      → JSON single item
 *   GET  /api/stats              → JSON KPI totals
 */

const http        = require('http');
const crypto      = require('crypto');
const { URL }     = require('url');

const PORT     = parseInt(process.env.DEMO_PORT     || '3333', 10);
const USERNAME = process.env.DEMO_USERNAME           || 'admin';
const PASSWORD = process.env.DEMO_PASSWORD           || 'demo1234';

// ── Session store ─────────────────────────────────────────────────────────────
const sessions = new Map();

// ── Mutable inventory (supports full CRUD) ────────────────────────────────────
let nextId = 11;
let INVENTORY = [
  { id:  1, sku: 'PRD-001', name: 'Widget Alpha',    category: 'Widgets',    qty: 142, price:  29.99, status: 'in-stock'     },
  { id:  2, sku: 'PRD-002', name: 'Gadget Beta',     category: 'Gadgets',    qty:  87, price:  49.99, status: 'in-stock'     },
  { id:  3, sku: 'PRD-003', name: 'Component Gamma', category: 'Components', qty:   0, price:  12.50, status: 'out-of-stock' },
  { id:  4, sku: 'PRD-004', name: 'Module Delta',    category: 'Modules',    qty:  34, price:  89.00, status: 'in-stock'     },
  { id:  5, sku: 'PRD-005', name: 'Unit Epsilon',    category: 'Units',      qty:   5, price: 199.99, status: 'low-stock'    },
  { id:  6, sku: 'PRD-006', name: 'Part Zeta',       category: 'Parts',      qty: 210, price:   8.75, status: 'in-stock'     },
  { id:  7, sku: 'PRD-007', name: 'Device Eta',      category: 'Devices',    qty:   0, price: 349.00, status: 'out-of-stock' },
  { id:  8, sku: 'PRD-008', name: 'System Theta',    category: 'Systems',    qty:  19, price: 599.99, status: 'in-stock'     },
  { id:  9, sku: 'PRD-009', name: 'Tool Iota',       category: 'Tools',      qty:  73, price:  24.99, status: 'in-stock'     },
  { id: 10, sku: 'PRD-010', name: 'Kit Kappa',       category: 'Kits',       qty:   2, price: 149.50, status: 'low-stock'    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseCookies(req) {
  const map = new Map();
  for (const part of (req.headers.cookie || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    map.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return map;
}

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Shared HTML shell ─────────────────────────────────────────────────────────
function layout(title, body, user) {
  const nav = user
    ? `<nav data-testid="main-nav">
        <span class="brand">DemoERP</span>
        <a href="/dashboard" data-testid="nav-dashboard">Dashboard</a>
        <a href="/inventory" data-testid="nav-inventory">Inventory</a>
        <a href="/reports"   data-testid="nav-reports">Reports</a>
        <span class="spacer"></span>
        <span class="nav-user" data-testid="nav-user">${esc(user)}</span>
        <form method="POST" action="/logout" style="display:inline">
          <button type="submit" class="nav-logout" data-testid="nav-logout">Logout</button>
        </form>
      </nav>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} | DemoERP</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f0f2f5;color:#1a1a2e;min-height:100vh}

    nav{background:#1a1a2e;padding:0 24px;height:52px;display:flex;align-items:center;gap:20px}
    .brand{color:#fff;font-weight:700;font-size:16px;margin-right:8px}
    nav a{color:#9ca3af;text-decoration:none;font-size:13px;transition:color .15s}
    nav a:hover{color:#fff}
    .spacer{flex:1}
    .nav-user{color:#9ca3af;font-size:12px}
    .nav-logout{background:transparent;border:1px solid #4b5563;color:#9ca3af;padding:4px 14px;
      cursor:pointer;border-radius:4px;font-size:12px;transition:all .15s}
    .nav-logout:hover{border-color:#9ca3af;color:#fff}

    .container{max-width:1200px;margin:0 auto;padding:28px 24px}
    .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
    .page-header h1{margin-bottom:0}
    h1{font-size:22px;font-weight:700;color:#111827}

    .card{background:#fff;border-radius:10px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}

    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
    .kpi{background:#fff;border-radius:10px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .kpi-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px}
    .kpi-value{font-size:30px;font-weight:700;color:#111827;line-height:1}
    .kpi-unit{font-size:11px;color:#9ca3af;margin-top:6px}

    table{width:100%;border-collapse:collapse}
    th{background:#f9fafb;text-align:left;padding:10px 14px;font-size:11px;text-transform:uppercase;
      letter-spacing:.5px;color:#6b7280;border-bottom:2px solid #e5e7eb;white-space:nowrap}
    td{padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tbody tr:hover td{background:#f9fafb}

    .badge{display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600}
    .badge-in-stock    {background:#d1fae5;color:#065f46}
    .badge-out-of-stock{background:#fee2e2;color:#991b1b}
    .badge-low-stock   {background:#fef3c7;color:#92400e}

    /* Action buttons in table rows */
    .btn-edit{display:inline-block;padding:4px 12px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;
      border-radius:5px;font-size:12px;font-weight:500;text-decoration:none;cursor:pointer;transition:all .15s}
    .btn-edit:hover{background:#dbeafe}
    .btn-delete{display:inline-block;padding:4px 12px;background:#fff1f2;color:#be123c;border:1px solid #fecdd3;
      border-radius:5px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;font-family:inherit}
    .btn-delete:hover{background:#ffe4e6}
    .action-group{display:flex;gap:6px;align-items:center}

    /* Primary button (New Item, Save) */
    .btn-primary{display:inline-block;padding:8px 18px;background:#4f46e5;color:#fff;border:none;
      border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:background .15s}
    .btn-primary:hover{background:#4338ca}

    /* CRUD form */
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .form-group{margin-bottom:0}
    .form-group-full{grid-column:1/-1}
    label{display:block;font-size:12px;font-weight:600;margin-bottom:5px;color:#374151;
      text-transform:uppercase;letter-spacing:.4px}
    input[type=text],input[type=number],select{width:100%;padding:9px 12px;border:1px solid #d1d5db;
      border-radius:7px;font-size:14px;color:#111827;background:#fff;transition:border-color .15s,box-shadow .15s}
    input:focus,select:focus{outline:none;border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .form-actions{display:flex;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6}
    .btn-cancel{display:inline-block;padding:9px 18px;background:#f3f4f6;color:#374151;border:none;
      border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:background .15s}
    .btn-cancel:hover{background:#e5e7eb}
    .form-error{background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:7px;
      font-size:13px;margin-bottom:20px;border:1px solid #fecaca}
    .form-success{background:#d1fae5;color:#065f46;padding:10px 14px;border-radius:7px;
      font-size:13px;margin-bottom:20px;border:1px solid #6ee7b7}

    /* Login */
    .login-wrapper{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1a1a2e}
    .login-box{background:#fff;border-radius:14px;padding:40px;width:380px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
    .login-title{font-size:24px;font-weight:800;text-align:center;margin-bottom:4px;color:#111827}
    .login-sub{font-size:13px;color:#6b7280;text-align:center;margin-bottom:32px}
    .login-form-group{margin-bottom:18px}
    .login-form-group label{display:block;font-size:12px;font-weight:600;margin-bottom:5px;
      color:#374151;text-transform:uppercase;letter-spacing:.4px}
    .login-form-group input{width:100%;padding:10px 13px;border:1px solid #d1d5db;border-radius:7px;
      font-size:14px;color:#111827}
    .login-form-group input:focus{outline:none;border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .btn-login{width:100%;padding:12px;background:#4f46e5;color:#fff;border:none;border-radius:7px;
      font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;transition:background .15s}
    .btn-login:hover{background:#4338ca}
    .login-error{background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:7px;
      font-size:13px;margin-bottom:18px;border:1px solid #fecaca}

    .report-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .section-title{font-size:14px;font-weight:600;margin-bottom:16px;color:#374151}

    @media(max-width:768px){
      .kpi-grid{grid-template-columns:1fr 1fr}
      .report-grid{grid-template-columns:1fr}
      .form-grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  ${nav}
  ${body}
</body>
</html>`;
}

// ── Page: Login ───────────────────────────────────────────────────────────────
function renderLogin(showError) {
  const errorHtml = showError
    ? '<div class="login-error" data-testid="login-error">Invalid username or password.</div>'
    : '';
  return layout('Sign In', `
    <div class="login-wrapper">
      <div class="login-box" data-testid="login-form-container">
        <div class="login-title">DemoERP</div>
        <div class="login-sub">Synthetic Monitoring Demo Application</div>
        ${errorHtml}
        <form method="POST" action="/login" data-testid="login-form">
          <div class="login-form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username"
              data-testid="username" autocomplete="username" placeholder="admin">
          </div>
          <div class="login-form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password"
              data-testid="password" autocomplete="current-password" placeholder="••••••••">
          </div>
          <button type="submit" class="btn-login" data-testid="login-btn">Sign In</button>
        </form>
      </div>
    </div>`);
}

// ── Page: Dashboard ───────────────────────────────────────────────────────────
function renderDashboard(user) {
  const totalItems = INVENTORY.length;
  const lowStock   = INVENTORY.filter(i => i.status === 'low-stock').length;
  const outOfStock = INVENTORY.filter(i => i.status === 'out-of-stock').length;
  const invValue   = INVENTORY.reduce((s, i) => s + i.price * i.qty, 0);

  const recentRows = INVENTORY.slice(0, 5).map(i => `
    <tr data-testid="recent-row">
      <td>${esc(i.sku)}</td><td>${esc(i.name)}</td><td>${i.qty}</td>
      <td>$${i.price.toFixed(2)}</td>
      <td><span class="badge badge-${i.status}">${i.status.replace(/-/g, ' ')}</span></td>
    </tr>`).join('');

  return layout('Dashboard', `
    <div class="container">
      <h1 data-testid="page-title">Dashboard</h1>
      <div class="kpi-grid">
        <div class="kpi" data-testid="kpi-total-items">
          <div class="kpi-label">Total Items</div>
          <div class="kpi-value" data-testid="kpi-value-total-items">${totalItems}</div>
          <div class="kpi-unit">products</div>
        </div>
        <div class="kpi" data-testid="kpi-low-stock">
          <div class="kpi-label">Low Stock</div>
          <div class="kpi-value" data-testid="kpi-value-low-stock">${lowStock}</div>
          <div class="kpi-unit">items</div>
        </div>
        <div class="kpi" data-testid="kpi-out-of-stock">
          <div class="kpi-label">Out of Stock</div>
          <div class="kpi-value" data-testid="kpi-value-out-of-stock">${outOfStock}</div>
          <div class="kpi-unit">items</div>
        </div>
        <div class="kpi" data-testid="kpi-inventory-value">
          <div class="kpi-label">Inventory Value</div>
          <div class="kpi-value" data-testid="kpi-value-inventory">$${Math.round(invValue).toLocaleString()}</div>
          <div class="kpi-unit">USD</div>
        </div>
      </div>
      <div class="card">
        <div class="section-title">Recent Items</div>
        <table data-testid="recent-items-table">
          <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Price</th><th>Status</th></tr></thead>
          <tbody data-testid="recent-items-body">${recentRows}</tbody>
        </table>
      </div>
    </div>`, user);
}

// ── Page: Inventory list ──────────────────────────────────────────────────────
function renderInventory(user, flash) {
  const flashHtml = flash
    ? `<div class="${flash.type === 'success' ? 'form-success' : 'form-error'}" data-testid="flash-message">${esc(flash.msg)}</div>`
    : '';

  const rows = INVENTORY.map(i => `
    <tr data-testid="inventory-row" data-sku="${esc(i.sku)}">
      <td data-testid="sku">${esc(i.sku)}</td>
      <td data-testid="name">${esc(i.name)}</td>
      <td data-testid="category">${esc(i.category)}</td>
      <td data-testid="qty">${i.qty}</td>
      <td data-testid="price">$${i.price.toFixed(2)}</td>
      <td data-testid="status"><span class="badge badge-${i.status}">${i.status.replace(/-/g, ' ')}</span></td>
      <td>
        <div class="action-group">
          <a href="/inventory/${i.id}/edit" class="btn-edit" data-testid="btn-edit">Edit</a>
          <form method="POST" action="/inventory/${i.id}/delete" style="display:inline">
            <button type="submit" class="btn-delete" data-testid="btn-delete">Delete</button>
          </form>
        </div>
      </td>
    </tr>`).join('');

  return layout('Inventory', `
    <div class="container">
      <div class="page-header">
        <h1 data-testid="page-title">Inventory</h1>
        <a href="/inventory/new" class="btn-primary" data-testid="btn-new-item">+ New Item</a>
      </div>
      ${flashHtml}
      <div class="card">
        <table data-testid="inventory-table">
          <thead>
            <tr><th>SKU</th><th>Name</th><th>Category</th><th>Qty</th><th>Price</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody data-testid="inventory-tbody">${rows}</tbody>
        </table>
      </div>
    </div>`, user);
}

// ── Page: Inventory form (create & edit) ──────────────────────────────────────
function renderInventoryForm(item, user, error) {
  const isEdit   = item !== null;
  const title    = isEdit ? 'Edit Item' : 'New Item';
  const action   = isEdit ? `/inventory/${item.id}/edit` : '/inventory/new';
  const v        = (field, fallback = '') => esc(isEdit ? String(item[field]) : fallback);

  const statusOpts = ['in-stock', 'low-stock', 'out-of-stock'].map(s => `
    <option value="${s}"${isEdit && item.status === s ? ' selected' : ''}>${s.replace(/-/g, ' ')}</option>`
  ).join('');

  const errorHtml = error
    ? `<div class="form-error" data-testid="form-error">${esc(error)}</div>`
    : '';

  return layout(title, `
    <div class="container">
      <div class="page-header">
        <h1 data-testid="page-title">${title}</h1>
      </div>
      <div class="card">
        ${errorHtml}
        <form method="POST" action="${action}" data-testid="inventory-form">
          <div class="form-grid">
            <div class="form-group">
              <label for="sku">SKU</label>
              <input type="text" id="sku" name="sku" value="${v('sku')}"
                data-testid="input-sku" placeholder="PRD-011" required>
            </div>
            <div class="form-group">
              <label for="name">Name</label>
              <input type="text" id="name" name="name" value="${v('name')}"
                data-testid="input-name" placeholder="Product Name" required>
            </div>
            <div class="form-group">
              <label for="category">Category</label>
              <input type="text" id="category" name="category" value="${v('category')}"
                data-testid="input-category" placeholder="Category" required>
            </div>
            <div class="form-group">
              <label for="status">Status</label>
              <select id="status" name="status" data-testid="input-status">
                ${statusOpts}
              </select>
            </div>
            <div class="form-group">
              <label for="qty">Quantity</label>
              <input type="number" id="qty" name="qty" value="${v('qty', '0')}"
                data-testid="input-qty" min="0" required>
            </div>
            <div class="form-group">
              <label for="price">Price (USD)</label>
              <input type="number" id="price" name="price" value="${v('price', '0')}"
                data-testid="input-price" step="0.01" min="0" required>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary" data-testid="btn-submit">
              ${isEdit ? 'Save Changes' : 'Create Item'}
            </button>
            <a href="/inventory" class="btn-cancel" data-testid="btn-cancel">Cancel</a>
          </div>
        </form>
      </div>
    </div>`, user);
}

// ── Page: Reports ─────────────────────────────────────────────────────────────
function renderReports(user) {
  const byCategory = {};
  for (const item of INVENTORY) {
    if (!byCategory[item.category]) byCategory[item.category] = { count: 0, totalQty: 0, totalValue: 0 };
    byCategory[item.category].count++;
    byCategory[item.category].totalQty   += item.qty;
    byCategory[item.category].totalValue += item.qty * item.price;
  }
  const catRows = Object.entries(byCategory).map(([cat, d]) => `
    <tr data-testid="category-row">
      <td>${esc(cat)}</td><td>${d.count}</td><td>${d.totalQty}</td>
      <td>$${d.totalValue.toFixed(2)}</td>
    </tr>`).join('');

  const statusOrder = ['in-stock', 'low-stock', 'out-of-stock'];
  const byStat = { 'in-stock': 0, 'low-stock': 0, 'out-of-stock': 0 };
  for (const i of INVENTORY) byStat[i.status]++;
  const statRows = statusOrder.map(s => `
    <tr data-testid="status-row">
      <td><span class="badge badge-${s}" data-testid="status-label">${s.replace(/-/g, ' ')}</span></td>
      <td data-testid="status-count">${byStat[s]}</td>
      <td>${((byStat[s] / INVENTORY.length) * 100).toFixed(0)}%</td>
    </tr>`).join('');

  return layout('Reports', `
    <div class="container">
      <h1 data-testid="page-title">Reports</h1>
      <div class="report-grid">
        <div class="card" data-testid="category-report">
          <div class="section-title">By Category</div>
          <table>
            <thead><tr><th>Category</th><th>Items</th><th>Total Qty</th><th>Value (USD)</th></tr></thead>
            <tbody data-testid="category-tbody">${catRows}</tbody>
          </table>
        </div>
        <div class="card" data-testid="status-report">
          <div class="section-title">By Stock Status</div>
          <table>
            <thead><tr><th>Status</th><th>Count</th><th>% of Total</th></tr></thead>
            <tbody data-testid="status-tbody">${statRows}</tbody>
          </table>
        </div>
      </div>
    </div>`, user);
}

// ── Request handler ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;
  const cookies  = parseCookies(req);
  const token    = cookies.get('demo_session');
  const session  = token ? sessions.get(token) : null;
  const user     = session ? session.username : null;

  // ── POST /login ─────────────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/login') {
    const params = Object.fromEntries(new URLSearchParams(await readBody(req)));
    if (params.username === USERNAME && params.password === PASSWORD) {
      const t = crypto.randomBytes(32).toString('hex');
      sessions.set(t, { username: params.username, createdAt: Date.now() });
      res.writeHead(302, { 'Set-Cookie': `demo_session=${t}; Path=/; HttpOnly; SameSite=Lax`, 'Location': '/dashboard' });
      return res.end();
    }
    res.writeHead(302, { 'Location': '/login?error=1' });
    return res.end();
  }

  // ── POST /logout ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/logout') {
    if (token) sessions.delete(token);
    res.writeHead(302, { 'Set-Cookie': 'demo_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'Location': '/login' });
    return res.end();
  }

  // ── GET /health ─────────────────────────────────────────────────────────────
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', items: INVENTORY.length, uptime: process.uptime() }));
  }

  // ── API (public) ────────────────────────────────────────────────────────────
  const jsonOk = (data) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

  if (pathname === '/api/inventory') return jsonOk(INVENTORY);

  const apiItemMatch = pathname.match(/^\/api\/inventory\/(\d+)$/);
  if (apiItemMatch) {
    const item = INVENTORY.find(i => i.id === parseInt(apiItemMatch[1], 10));
    if (!item) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Item not found' })); }
    return jsonOk(item);
  }

  if (pathname === '/api/stats') {
    const inStock = INVENTORY.filter(i => i.status === 'in-stock').length;
    const lowStock = INVENTORY.filter(i => i.status === 'low-stock').length;
    const outOfStock = INVENTORY.filter(i => i.status === 'out-of-stock').length;
    return jsonOk({ totalItems: INVENTORY.length, inStock, lowStock, outOfStock, inventoryValue: Math.round(INVENTORY.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100 });
  }

  // ── Public pages ────────────────────────────────────────────────────────────
  if (pathname === '/') { res.writeHead(302, { 'Location': user ? '/dashboard' : '/login' }); return res.end(); }
  if (pathname === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderLogin(parsed.searchParams.get('error') === '1'));
  }

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (!user) { res.writeHead(302, { 'Location': '/login' }); return res.end(); }

  const html = (content) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(content); };
  const redirect = (loc) => { res.writeHead(302, { 'Location': loc }); res.end(); };

  // ── Dashboard ───────────────────────────────────────────────────────────────
  if (pathname === '/dashboard') return html(renderDashboard(user));

  // ── Reports ─────────────────────────────────────────────────────────────────
  if (pathname === '/reports') return html(renderReports(user));

  // ── CREATE: GET /inventory/new ───────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/inventory/new') {
    return html(renderInventoryForm(null, user, null));
  }

  // ── CREATE: POST /inventory/new ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/inventory/new') {
    const p = Object.fromEntries(new URLSearchParams(await readBody(req)));
    if (INVENTORY.find(i => i.sku === p.sku)) {
      return html(renderInventoryForm(null, user, `SKU "${p.sku}" already exists.`));
    }
    INVENTORY.push({
      id:       nextId++,
      sku:      p.sku.trim(),
      name:     p.name.trim(),
      category: p.category.trim(),
      qty:      parseInt(p.qty, 10) || 0,
      price:    parseFloat(p.price) || 0,
      status:   p.status || 'in-stock',
    });
    return redirect('/inventory');
  }

  // ── EDIT: GET /inventory/:id/edit ────────────────────────────────────────────
  const editGetMatch = pathname.match(/^\/inventory\/(\d+)\/edit$/);
  if (req.method === 'GET' && editGetMatch) {
    const item = INVENTORY.find(i => i.id === parseInt(editGetMatch[1], 10));
    if (!item) return redirect('/inventory');
    return html(renderInventoryForm(item, user, null));
  }

  // ── EDIT: POST /inventory/:id/edit ───────────────────────────────────────────
  const editPostMatch = pathname.match(/^\/inventory\/(\d+)\/edit$/);
  if (req.method === 'POST' && editPostMatch) {
    const item = INVENTORY.find(i => i.id === parseInt(editPostMatch[1], 10));
    if (!item) return redirect('/inventory');
    const p = Object.fromEntries(new URLSearchParams(await readBody(req)));
    // SKU uniqueness: allow same SKU (own record), block if taken by another
    const conflict = INVENTORY.find(i => i.sku === p.sku.trim() && i.id !== item.id);
    if (conflict) return html(renderInventoryForm(item, user, `SKU "${p.sku}" is already used by another item.`));
    item.sku      = p.sku.trim();
    item.name     = p.name.trim();
    item.category = p.category.trim();
    item.qty      = parseInt(p.qty, 10) || 0;
    item.price    = parseFloat(p.price) || 0;
    item.status   = p.status || item.status;
    return redirect('/inventory');
  }

  // ── DELETE: POST /inventory/:id/delete ──────────────────────────────────────
  const deleteMatch = pathname.match(/^\/inventory\/(\d+)\/delete$/);
  if (req.method === 'POST' && deleteMatch) {
    const id = parseInt(deleteMatch[1], 10);
    INVENTORY = INVENTORY.filter(i => i.id !== id);
    return redirect('/inventory');
  }

  // ── Inventory list ───────────────────────────────────────────────────────────
  if (pathname === '/inventory') return html(renderInventory(user, null));

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[DemoERP] Listening on http://localhost:${PORT}`);
  console.log(`[DemoERP] Credentials: ${USERNAME} / ${PASSWORD}`);
  console.log(`[DemoERP] CRUD: /inventory/new  |  /inventory/:id/edit  |  POST /inventory/:id/delete`);
});
