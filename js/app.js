'use strict';
/* =====================================================================
   MFINANGA STATIONERY — app.js
   Core · UI kit · Router · Dashboard · POS
   ===================================================================== */

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const round2 = n => Math.round((num(n) + Number.EPSILON) * 100) / 100;
const ymd = d => d.toLocaleDateString('en-CA');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const locale = () => (LANG === 'sw' ? 'sw-TZ' : 'en-GB');
const fdt = iso => iso ? new Date(iso).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }) : '';
const fd = iso => iso ? new Date(iso).toLocaleDateString(locale(), { dateStyle: 'medium' }) : '';

let SET = { business_name: 'MFINANGA STATIONERY', currency: 'TZS', default_tax_rate: 18, receipt_footer: '', logo_url: null, phone: '', email: '', address: '', tin_vat: '', timezone: 'Africa/Dar_es_Salaam' };
const fmt = n => num(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const money = n => `${SET.currency} ${fmt(n)}`;
const compact = n => { n = num(n); const a = Math.abs(n); return a >= 1e6 ? `${+(n / 1e6).toFixed(2)}M` : a >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(Math.round(n)); };
const moneyK = n => `${SET.currency} ${compact(n)}`;

const ALL_ROLES = ['ADMIN', 'MANAGER', 'CASHIER', 'STOREKEEPER'];
const PM = ['CASH', 'MPESA', 'AIRTEL_MONEY', 'TIGO_PESA', 'BANK', 'OTHER'];
const UNITS = ['Piece', 'Box', 'Packet', 'Ream', 'Carton', 'Bottle', 'Dozen', 'Set', 'Other'];
const EXP_CATS = ['Rent', 'Salaries', 'Electricity', 'Water', 'Transport', 'Internet', 'Tax', 'Repairs', 'Marketing', 'Supplies', 'Other'];

function toast(msg, kind = '') {
  const e = $('#toast'); e.textContent = msg; e.className = 'show ' + kind;
  clearTimeout(toast._t); toast._t = setTimeout(() => { e.className = ''; }, 4000);
}
function fail(e) {
  console.error(e);
  let m = (e && e.message) ? e.message : String(e);
  if (e && e.code === '23505') m = t('errDuplicate');
  else if (e && (e.code === '42501' || /row-level security|not authorised/i.test(m))) m = t('errPermission');
  else if (e && e.code === '23503') m = t('errInUse');
  toast(m, 'err');
}
async function withBusy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { fail(e); } finally { if (btn) btn.disabled = false; }
}
const roleLabel = r => t('role_' + r);
const pmLabel = m => t('pm_' + m);

/* ---------- modal ---------- */
function openModal(title, body, opts = {}) {
  closeModal();
  const root = $('#modalRoot');
  root.innerHTML = `<div class="mback"><div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="mhead"><b>${title}</b><button class="x" aria-label="${esc(t('close'))}">✕</button></div><div class="mbody">${body}</div></div></div>`;
  $('.x', root).onclick = closeModal;
  $('.mback', root).addEventListener('mousedown', e => { if (e.target.classList.contains('mback')) closeModal(); });
  const first = $('input,select,textarea', root); if (first && !opts.noFocus) first.focus();
  return $('.modal', root);
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- form + table builders ---------- */
const F = (label, inner, cls = '') => `<label class="f ${cls}"><span>${label}</span>${inner}</label>`;
const inp = (name, val = '', attrs = '') => `<input name="${name}" value="${esc(val)}" ${attrs}>`;
const sel = (name, opts, val = '', attrs = '') => `<select name="${name}" ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const pmOpts = () => PM.map(p => [p, pmLabel(p)]);
const formVals = f => { const o = {}; new FormData(f).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; };
const empty2null = v => (v === '' || v === undefined ? null : v);

function tbl(heads, rows, cls = '') {
  if (!rows.length) return `<div class="empty">${t('noData')}</div>`;
  return `<div class="tw"><table class="${cls}"><thead><tr>${heads.map(h => typeof h === 'string' ? `<th>${h}</th>` : `<th class="${h.c || ''}">${h.h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function pagerHtml(total, page, size) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return '';
  const btn = (p, l, dis = false, on = false) => `<button class="btn ${on ? '' : 'ghost'} sm" data-pg="${p}" ${dis ? 'disabled' : ''}>${l}</button>`;
  let h = btn(page - 1, '‹', page <= 1);
  const lo = Math.max(1, page - 2), hi = Math.min(pages, page + 2);
  if (lo > 1) h += btn(1, '1') + (lo > 2 ? '<span>…</span>' : '');
  for (let p = lo; p <= hi; p++) h += btn(p, p, false, p === page);
  if (hi < pages) h += (hi < pages - 1 ? '<span>…</span>' : '') + btn(pages, pages);
  return h + btn(page + 1, '›', page >= pages) + `<span class="hint">${total} ${t('items')}</span>`;
}
function wirePager(el, cb) { $$('[data-pg]', el).forEach(b => b.onclick = () => cb(+b.dataset.pg)); }
const badge = (cls, text) => `<span class="badge ${cls}">${esc(text)}</span>`;

/* ---------- CSV ---------- */
function exportCSV(name, rows) {
  if (!rows || !rows.length) return toast(t('noData'), 'err');
  const cols = Object.keys(rows[0]);
  const q = v => {
    if (v === null || v === undefined) v = '';
    if (typeof v === 'object') v = JSON.stringify(v);
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@]/.test(s) && isNaN(s)) s = "'" + s;   // spreadsheet-formula guard
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${name}_${ymd(new Date())}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function parseCSV(text, delim) {
  text = text.replace(/^﻿/, '');
  if (!delim) { const first = text.split(/\r?\n/)[0] || ''; delim = (first.split(';').length > first.split(',').length) ? ';' : ','; }
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

/* ---------- date ranges ---------- */
const RS = {};
function getRange(name, def = 'today') { return RS[name] || (RS[name] = { key: def, from: ymd(new Date()), to: ymd(new Date()) }); }
function rangeDates(R) {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  let a, b;
  switch (R.key) {
    case 'yesterday': a = addDays(s, -1); b = s; break;
    case 'week': { const wd = (s.getDay() + 6) % 7; a = addDays(s, -wd); b = addDays(a, 7); break; }
    case 'month': a = new Date(s.getFullYear(), s.getMonth(), 1); b = new Date(s.getFullYear(), s.getMonth() + 1, 1); break;
    case 'year': a = new Date(s.getFullYear(), 0, 1); b = new Date(s.getFullYear() + 1, 0, 1); break;
    case 'custom': a = new Date((R.from || ymd(s)) + 'T00:00:00'); b = addDays(new Date((R.to || R.from || ymd(s)) + 'T00:00:00'), 1); break;
    default: a = s; b = addDays(s, 1);
  }
  return { a, b, from: a.toISOString(), to: b.toISOString(), fromD: ymd(a), toD: ymd(addDays(b, -1)) };
}
function rangeHtml(name) {
  const R = getRange(name);
  const keys = ['today', 'yesterday', 'week', 'month', 'year', 'custom'];
  return `<div class="rangebar"><select id="rkey_${name}" aria-label="${esc(t('period'))}">${keys.map(k => `<option value="${k}" ${R.key === k ? 'selected' : ''}>${t('r_' + k)}</option>`).join('')}</select>
  <span id="rcus_${name}" class="rangebar" ${R.key === 'custom' ? '' : 'hidden'}><input type="date" id="rfrom_${name}" value="${R.from}"><input type="date" id="rto_${name}" value="${R.to}"></span></div>`;
}
function wireRange(name, cb) {
  const R = getRange(name);
  $('#rkey_' + name).onchange = e => { R.key = e.target.value; $('#rcus_' + name).hidden = R.key !== 'custom'; if (R.key !== 'custom') cb(); };
  ['from', 'to'].forEach(k => { $(`#r${k}_${name}`).onchange = e => { R[k] = e.target.value; if (R.from && R.to && R.from <= R.to) cb(); }; });
}

/* ---------- charts (inline SVG) ---------- */
function barsSvg(data) {
  if (!data.length) return `<p class="mut">${t('noData')}</p>`;
  const H = 210, top = 10, bot = 26, left = 44, step = 44, W = Math.max(left + data.length * step + 10, 320), ch = H - top - bot;
  const max = Math.max(1, ...data.flatMap(d => [d.a, d.b])), y = v => top + ch - (v / max) * ch;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = y(v); g += `<line x1="${left - 4}" x2="${W}" y1="${yy}" y2="${yy}" stroke="currentColor" opacity=".12"/><text x="${left - 8}" y="${yy + 3}" text-anchor="end">${compact(v)}</text>`; }
  data.forEach((d, i) => {
    const x = left + i * step;
    g += `<g class="bargrp"><rect class="b1" x="${x}" y="${y(d.a)}" width="15" height="${Math.max(0, top + ch - y(d.a))}" rx="3"><title>${esc(d.l)} · ${esc(t('revenue'))}: ${money(d.a)}</title></rect>
      <rect class="b2" x="${x + 17}" y="${y(d.b)}" width="15" height="${Math.max(0, top + ch - y(d.b))}" rx="3"><title>${esc(d.l)} · ${esc(t('expenses'))}: ${money(d.b)}</title></rect>
      <text x="${x + 16}" y="${H - 8}" text-anchor="middle">${esc(d.l)}</text></g>`;
  });
  return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W, 900)}px" role="img" aria-label="${esc(t('revVsExp'))}">${g}</svg></div>
    <div class="legend"><span><i style="background:var(--c1)"></i>${t('revenue')}</span><span><i style="background:var(--c2)"></i>${t('expenses')}</span></div>`;
}
function lineSvg(data) {
  if (!data.length) return `<p class="mut">${t('noData')}</p>`;
  const H = 190, top = 12, bot = 26, left = 44, W = Math.max(left + data.length * 40 + 10, 320), ch = H - top - bot;
  const max = Math.max(1, ...data.map(d => d.a)), n = data.length;
  const X = i => left + (n === 1 ? 20 : i * ((W - left - 14) / (n - 1))), Y = v => top + ch - (v / max) * ch;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = Y(v); g += `<line x1="${left - 4}" x2="${W}" y1="${yy}" y2="${yy}" stroke="currentColor" opacity=".12"/><text x="${left - 8}" y="${yy + 3}" text-anchor="end">${compact(v)}</text>`; }
  const pts = data.map((d, i) => `${X(i)},${Y(d.a)}`).join(' ');
  g += `<polygon points="${X(0)},${top + ch} ${pts} ${X(n - 1)},${top + ch}" fill="var(--c2)" opacity=".15"/><polyline points="${pts}" fill="none" stroke="var(--c2)" stroke-width="2.5" stroke-linejoin="round"/>`;
  data.forEach((d, i) => { g += `<circle cx="${X(i)}" cy="${Y(d.a)}" r="4" fill="var(--c2)"><title>${esc(d.l)}: ${money(d.a)}</title></circle>`; if (n <= 16 || i % Math.ceil(n / 12) === 0) g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(d.l)}</text>`; });
  return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W, 900)}px" role="img" aria-label="${esc(t('salesTrend'))}">${g}</svg></div>`;
}
function donutSvg(items) {
  const tot = items.reduce((s, i) => s + i.v, 0);
  if (!tot) return `<p class="mut">${t('noData')}</p>`;
  const R = 52, C = 2 * Math.PI * R; let off = 0, g = '';
  items.forEach((it, i) => { const len = it.v / tot * C; g += `<circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--c${(i % 6) + 1})" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(it.l)}: ${money(it.v)} (${(it.v / tot * 100).toFixed(1)}%)</title></circle>`; off += len; });
  return `<div class="donutbox"><svg viewBox="0 0 140 140" role="img" aria-label="${esc(t('byCategory'))}">${g}</svg><div class="legend" style="flex-direction:column;gap:6px">${items.map((it, i) => `<span><i style="background:var(--c${(i % 6) + 1})"></i>${esc(it.l)} · ${(it.v / tot * 100).toFixed(0)}%</span>`).join('')}</div></div>`;
}

/* ---------- router + layout ---------- */
const VIEWS = {};
const NAV = [
  { id: 'dashboard', icon: '📊', roles: ['MANAGER'] },
  { id: 'pos', icon: '🛒', roles: ['MANAGER', 'CASHIER'] },
  { id: 'products', icon: '📦', roles: ALL_ROLES },
  { id: 'purchases', icon: '🚚', roles: ['MANAGER', 'STOREKEEPER'] },
  { id: 'suppliers', icon: '🏭', roles: ['MANAGER', 'STOREKEEPER'] },
  { id: 'sales', icon: '🧾', roles: ['MANAGER', 'CASHIER'] },
  { id: 'customers', icon: '👥', roles: ['MANAGER', 'CASHIER'] },
  { id: 'expenses', icon: '💸', roles: ['MANAGER'] },
  { id: 'budgets', icon: '🎯', roles: ['MANAGER'] },
  { id: 'finance', icon: '📈', roles: ['MANAGER'] },
  { id: 'reports', icon: '📑', roles: ['MANAGER'] },
  { id: 'audit', icon: '🛡️', roles: ['MANAGER'] },
  { id: 'settings', icon: '⚙️', roles: [] }
];
const navAllowed = n => !!ME && !!n && (ME.role === 'ADMIN' || n.roles.includes(ME.role));
let ROUTE_TOK = 0;
const live = () => { const k = ROUTE_TOK; return () => k === ROUTE_TOK; };

function buildNav() {
  $('#nav').innerHTML = NAV.filter(navAllowed).map(n => `<a href="#${n.id}" data-id="${n.id}" title="${esc(t('nav_' + n.id))}"><span class="ico">${n.icon}</span><span class="lbl">${esc(t('nav_' + n.id))}</span></a>`).join('');
}
function applyBranding() {
  const name = SET.business_name || 'MFINANGA STATIONERY';
  const parts = name.trim().split(/\s+/); const first = parts[0], rest = parts.slice(1).join(' ');
  $('#bizName').textContent = first; $('#bizSub').textContent = rest || ' ';
  $('#who').textContent = name; document.title = name;
  const logo = SET.logo_url ? `<img src="${esc(SET.logo_url)}" alt="">` : esc(first[0] || 'M').toUpperCase();
  $('#bizLogo').innerHTML = logo;
  try { localStorage.setItem('biz', JSON.stringify({ n: first, s: rest, l: SET.logo_url || '' })); } catch (e) { /* storage may be blocked */ }
}
function applyUserChip() {
  $('#chipName').textContent = ME.full_name || ''; $('#chipRole').textContent = roleLabel(ME.role);
  $('#chipAv').innerHTML = ME.avatar_url ? `<img src="${esc(ME.avatar_url)}" alt="">` : esc((ME.full_name || '?')[0].toUpperCase());
}
function applyLoginBrand() {
  try {
    const b = JSON.parse(localStorage.getItem('biz') || 'null'); if (!b) return;
    $('#loginName').textContent = b.n || 'MFINANGA'; $('#loginSub').textContent = b.s || ' ';
    $('#loginLogo').innerHTML = b.l ? `<img src="${esc(b.l)}" alt="">` : esc((b.n || 'M')[0]).toUpperCase();
  } catch (e) { /* ignore */ }
}

async function route() {
  if (!ME) return;
  let id = (location.hash || '').slice(1);
  const allowed = NAV.filter(navAllowed);
  if (!VIEWS[id] || !navAllowed(NAV.find(n => n.id === id))) id = allowed.length ? allowed[0].id : 'products';
  ROUTE_TOK++;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.id === id));
  document.body.classList.remove('drawer');
  window.POS_ACTIVE = id === 'pos';
  const v = $('#view'); v.innerHTML = `<div class="loading">…</div>`;
  try { await VIEWS[id](); updateLanguage(LANG); }
  catch (e) { fail(e); v.innerHTML = `<div class="card"><p class="err">${esc(e.message || e)}</p><button class="btn" id="retry">${t('retry')}</button></div>`; $('#retry').onclick = route; }
}

/* ---------- theme ---------- */
function applyTheme() {
  let th = 'dark', ac = 'orange';
  try { th = localStorage.getItem('theme') || 'dark'; ac = localStorage.getItem('accent') || 'orange'; } catch (e) { /* ignore */ }
  document.documentElement.dataset.theme = th; document.documentElement.dataset.accent = ac;
  $('#theme').value = th; $('#accent').value = ac;
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */
const kpi = (c, icon, label, value, sub = '') => `<div class="kpi ${c}"><small><span>${icon}</span>${label}</small><b>${value}</b><em>${sub}</em></div>`;
const DAYS_SHORT = d => d.toLocaleDateString(locale(), { day: '2-digit', month: 'short' });
const MONTH_SHORT = d => d.toLocaleDateString(locale(), { month: 'short' });

VIEWS.dashboard = async function () {
  const alive = live(), R = getRange('dash', 'today');
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_dashboard')}</h2>${rangeHtml('dash')}</div><div id="dbody"><div class="loading">…</div></div>`;
  wireRange('dash', load);
  await load();

  async function load() {
    const r = rangeDates(R), td = rangeDates({ key: 'today' }), wk = rangeDates({ key: 'week' }), mo = rangeDates({ key: 'month' });
    const P = x => ({ p_from: x.from, p_to: x.to });
    const unit = (r.b - r.a) / 864e5 > 45 ? 'month' : 'day';
    const [sT, sW, sM, sR, series, top, cats, low] = await Promise.all([
      rpc('get_financial_summary', P(td)), rpc('get_financial_summary', P(wk)), rpc('get_financial_summary', P(mo)), rpc('get_financial_summary', P(r)),
      rpc('get_series', { ...P(r), p_unit: unit }), rpc('get_top_products', { ...P(r), p_limit: 5 }), rpc('get_category_breakdown', P(r)),
      sb.from('low_stock_products').select('id,name,current_stock,minimum_stock,unit').order('current_stock').limit(8).then(must)
    ]);
    if (!alive()) return;
    const map = new Map(series.map(s => [s.bucket, s]));
    const pts = [];
    if (unit === 'day') for (let d = new Date(r.a); d < r.b; d = addDays(d, 1)) { const s = map.get(ymd(d)) || {}; pts.push({ l: DAYS_SHORT(d), a: num(s.revenue), b: num(s.spent) }); }
    else for (let d = new Date(r.a.getFullYear(), r.a.getMonth(), 1); d < r.b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) { const s = map.get(ymd(d)) || {}; pts.push({ l: MONTH_SHORT(d), a: num(s.revenue), b: num(s.spent) }); }
    const margin = sR.revenue > 0 ? (sR.gross_profit / sR.revenue * 100).toFixed(1) + '%' : '—';
    const maxTop = Math.max(1, ...top.map(p => num(p.revenue)));
    $('#dbody').innerHTML = `
      <div class="banner"><div><small>${t('welcome')} 👋</small><h2>${esc(ME.full_name)}</h2><p>${roleLabel(ME.role)} · ${esc(SET.business_name)}</p></div>
        <div class="bstats"><div><b>${sT.sales_count}</b><span>${t('salesToday')}</span></div><div><b>${moneyK(sT.revenue)}</b><span>${t('revenue')}</span></div><div><b>${moneyK(sT.net_profit)}</b><span>${t('netProfit')}</span></div><div><b>${moneyK(sR.credit_outstanding)}</b><span>${t('custCredit')}</span></div></div></div>
      <div class="kpis">
        ${kpi('k1', '📅', t('todaySales'), moneyK(sT.revenue), `${sT.sales_count} ${t('salesWord')}`)}
        ${kpi('k4', '🗓️', t('weekSales'), moneyK(sW.revenue), `${sW.sales_count} ${t('salesWord')}`)}
        ${kpi('k6', '📆', t('monthSales'), moneyK(sM.revenue), `${sM.sales_count} ${t('salesWord')}`)}
        ${kpi('k8', '💵', t('cashBalance'), moneyK(sR.cash_balance), t('allTime'))}
      </div>
      <div class="pagehead"><h3>${t('selectedPeriod')}</h3></div>
      <div class="kpis">
        ${kpi('k1', '💰', t('revenue'), moneyK(sR.revenue), `${sR.sales_count} ${t('salesWord')} · ${t('refunds')}: ${moneyK(sR.refunds)}`)}
        ${kpi('k2', '📈', t('grossProfit'), moneyK(sR.gross_profit), `${t('margin')}: ${margin}`)}
        ${kpi('k3', '💸', t('expenses'), moneyK(sR.expenses), '')}
        ${kpi('k5', '🏆', t('netProfit'), moneyK(sR.net_profit), t('afterExpenses'))}
        ${kpi('k7', '🧾', t('custCredit'), moneyK(sR.credit_outstanding), `${t('supplierDue')}: ${moneyK(sR.supplier_due)}`)}
        ${kpi('k4', '📦', t('stockHealth'), `${sR.low_stock + sR.out_of_stock} ⚠`, `${sR.low_stock} ${t('lowStock')} · ${sR.out_of_stock} ${t('outStock')} · ${t('stockValue')} ${moneyK(sR.stock_value)}`)}
      </div>
      <div class="two"><div class="card"><b>${t('revVsExp')}</b>${barsSvg(pts)}</div>
        <div class="card"><b>${t('byCategory')}</b>${donutSvg(cats.map(c => ({ l: c.category === 'Uncategorised' ? t('uncategorised') : c.category, v: num(c.revenue) })).slice(0, 6))}</div></div>
      <div class="two"><div class="card"><b>${t('salesTrend')}</b>${lineSvg(pts)}</div>
        <div class="card"><b>🏆 ${t('topProducts')}</b>${top.length ? top.map(p => `<div class="row"><div><span>${esc(p.name)} <small class="mut">×${p.qty}</small></span><b>${moneyK(p.revenue)}</b></div><i style="width:${Math.max(4, Math.round(num(p.revenue) / maxTop * 100))}%"></i></div>`).join('') : `<p class="mut">${t('noSales')}</p>`}</div></div>
      <div class="two"><div class="card"><b>⚠️ ${t('lowStockAlerts')}</b>${low.length ? tbl([t('name'), { h: t('stock'), c: 'num' }, { h: t('minimum'), c: 'num' }], low.map(p => `<tr><td>${esc(p.name)}</td><td class="num ${p.current_stock <= 0 ? 'out' : 'low'}">${p.current_stock}</td><td class="num">${p.minimum_stock}</td></tr>`)) : `<p class="ok">✔ ${t('stockOk')}</p>`}</div>
        <div class="card"><b>${t('quickActions')}</b><div class="quick" style="margin-top:12px"><a class="btn" href="#pos">🛒 ${t('nav_pos')}</a><a class="btn ghost" href="#products">📦 ${t('nav_products')}</a><a class="btn ghost" href="#expenses">💸 ${t('nav_expenses')}</a><a class="btn ghost" href="#reports">📑 ${t('nav_reports')}</a></div></div></div>`;
  }
};

/* =====================================================================
   POS TERMINAL + RECEIPT
   ===================================================================== */
const POS = { products: [], map: {}, customers: [], cats: [], cart: [], cat: '', q: '', taxOn: false, discount: 0, customer: '' };

function posTotals() {
  const sub = round2(POS.cart.reduce((s, l) => s + l.qty * POS.map[l.id].selling_price, 0));
  const disc = round2(Math.min(Math.max(num(POS.discount), 0), sub));
  const tax = POS.taxOn ? round2((sub - disc) * num(SET.default_tax_rate) / 100) : 0;
  return { sub, disc, tax, total: round2(sub - disc + tax) };
}

VIEWS.pos = async function () {
  const alive = live();
  const [prods, custs, cats] = await Promise.all([
    fetchAll(() => sb.from('products').select('id,name,sku,barcode,selling_price,current_stock,unit,category_id').eq('active', true).order('name').order('id')),
    sb.from('customers').select('id,name,phone,credit_limit,outstanding_balance').order('name').then(must),
    sb.from('categories').select('id,name').order('name').then(must)
  ]);
  if (!alive()) return;
  Object.assign(POS, { products: prods, customers: custs, cats });
  POS.map = Object.fromEntries(prods.map(p => [p.id, p]));
  POS.cart = POS.cart.filter(l => POS.map[l.id]).map(l => ({ id: l.id, qty: Math.min(l.qty, POS.map[l.id].current_stock) })).filter(l => l.qty > 0);

  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_pos')}</h2></div>
  <div class="pos">
    <div class="card"><div class="toolbar"><input id="pq" class="grow" type="search" placeholder="${esc(t('searchScan'))}" value="${esc(POS.q)}" autocomplete="off" aria-label="${esc(t('searchScan'))}"></div>
      <div class="chips" id="pcats" style="margin-top:10px"></div><div class="pgrid" id="pgrid"></div></div>
    <div class="card"><h3>🛒 ${t('cart')}</h3><div id="pcart"></div>
      <div class="fgrid" style="margin-top:12px">
        ${F(t('customer'), `<select id="pcust"><option value="">${esc(t('walkIn'))}</option>${custs.map(c => `<option value="${c.id}" ${c.id === POS.customer ? 'selected' : ''}>${esc(c.name)}${c.outstanding_balance > 0 ? ' (' + fmt(c.outstanding_balance) + ')' : ''}</option>`).join('')}</select>`, 'full')}
        ${F(t('discount'), `<input id="pdisc" type="number" min="0" step="any" inputmode="decimal" value="${POS.discount || ''}" placeholder="0">`)}
        <label class="check"><input type="checkbox" id="ptax" ${POS.taxOn ? 'checked' : ''}> ${t('addTax')} (${num(SET.default_tax_rate)}%)</label>
      </div>
      <div class="totals" id="ptot"></div>
      <button class="btn big" id="payBtn">💳 ${t('pay')}</button>
      <button class="btn ghost big" id="clearBtn" style="margin-top:8px;min-height:44px">${t('clearCart')}</button></div>
  </div>`;
  drawCats(); drawGrid(); drawCart();
  $('#pq').oninput = e => { POS.q = e.target.value; drawGrid(); };
  $('#pq').onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault(); scanEnter(); };
  $('#pcust').onchange = e => { POS.customer = e.target.value; };
  $('#pdisc').oninput = e => { POS.discount = e.target.value; drawCart(true); };
  $('#ptax').onchange = e => { POS.taxOn = e.target.checked; drawCart(true); };
  $('#clearBtn').onclick = () => { POS.cart = []; POS.discount = 0; $('#pdisc').value = ''; drawCart(); };
  $('#payBtn').onclick = openPay;
  $('#pq').focus();
};

// Barcode scanners "type" the code then press Enter. If no field is focused, typing goes to the search box.
document.addEventListener('keydown', e => {
  if (!window.POS_ACTIVE || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || $('#modalRoot').children.length) return;
  const q = $('#pq'); if (q) q.focus();
});
function scanEnter() {
  const v = $('#pq').value.trim().toLowerCase(); if (!v) return;
  let p = POS.products.find(x => (x.barcode || '').toLowerCase() === v || (x.sku || '').toLowerCase() === v);
  if (!p) { const hits = filteredProducts(); if (hits.length === 1) p = hits[0]; }
  if (!p) return toast(t('notFound'), 'err');
  addCart(p.id); POS.q = ''; $('#pq').value = ''; drawGrid(); $('#pq').focus();
}
function filteredProducts() {
  const q = POS.q.trim().toLowerCase();
  return POS.products.filter(p => (!POS.cat || p.category_id === POS.cat) && (!q || `${p.name} ${p.sku || ''} ${p.barcode || ''}`.toLowerCase().includes(q)));
}
function drawCats() {
  const el = $('#pcats');
  el.innerHTML = `<button class="chip ${POS.cat ? '' : 'on'}" data-c="">${t('all')}</button>` + POS.cats.map(c => `<button class="chip ${POS.cat === c.id ? 'on' : ''}" data-c="${c.id}">${esc(c.name)}</button>`).join('');
  $$('.chip', el).forEach(b => b.onclick = () => { POS.cat = b.dataset.c; drawCats(); drawGrid(); });
}
function drawGrid() {
  const list = filteredProducts(), shown = list.slice(0, 60);
  $('#pgrid').innerHTML = shown.length ? shown.map(p => `<button class="pcard" data-id="${p.id}" ${p.current_stock < 1 ? 'disabled' : ''}><b>${esc(p.name)}</b><span class="pr">${money(p.selling_price)}</span><small>${p.current_stock < 1 ? t('outStock') : `${p.current_stock} ${esc(p.unit)}`}</small></button>`).join('') + (list.length > 60 ? `<p class="hint" style="grid-column:1/-1">${t('refineSearch')}</p>` : '')
    : `<div class="empty" style="grid-column:1/-1">${t('noData')}</div>`;
  $$('.pcard', $('#pgrid')).forEach(b => b.onclick = () => addCart(b.dataset.id));
}
function addCart(id) {
  const p = POS.map[id]; if (!p) return;
  const l = POS.cart.find(x => x.id === id);
  if (l) { if (l.qty < p.current_stock) l.qty++; else return toast(t('stockLimit'), 'err'); }
  else if (p.current_stock > 0) POS.cart.push({ id, qty: 1 });
  drawCart();
}
function drawCart(totalsOnly) {
  if (!totalsOnly) {
    $('#pcart').innerHTML = POS.cart.length ? POS.cart.map((l, i) => { const p = POS.map[l.id]; return `<div class="cartline"><div><b>${esc(p.name)}</b><br><small class="mut">${money(p.selling_price)} × ${l.qty} = ${money(p.selling_price * l.qty)}</small></div>
      <div class="qty"><button class="btn ghost" data-m="${i}" aria-label="−">−</button><input type="number" min="1" max="${p.current_stock}" value="${l.qty}" data-q="${i}" aria-label="${esc(t('qty'))}"><button class="btn ghost" data-p="${i}" aria-label="+">+</button><button class="btn ghost" data-x="${i}" aria-label="${esc(t('remove'))}">✕</button></div></div>`; }).join('') : `<div class="empty">${t('cartEmpty')}</div>`;
    $$('[data-m]', $('#pcart')).forEach(b => b.onclick = () => { const l = POS.cart[b.dataset.m]; l.qty--; if (l.qty < 1) POS.cart.splice(b.dataset.m, 1); drawCart(); });
    $$('[data-p]', $('#pcart')).forEach(b => b.onclick = () => addCart(POS.cart[b.dataset.p].id));
    $$('[data-x]', $('#pcart')).forEach(b => b.onclick = () => { POS.cart.splice(b.dataset.x, 1); drawCart(); });
    $$('[data-q]', $('#pcart')).forEach(inpEl => inpEl.onchange = () => {
      const l = POS.cart[inpEl.dataset.q], max = POS.map[l.id].current_stock; let q = Math.floor(num(inpEl.value));
      if (q > max) { q = max; toast(t('stockLimit'), 'err'); } if (q < 1) POS.cart.splice(inpEl.dataset.q, 1); else l.qty = q; drawCart();
    });
  }
  const T = posTotals();
  $('#ptot').innerHTML = `<div><span>${t('subtotal')}</span><b>${money(T.sub)}</b></div>${T.disc ? `<div><span>${t('discount')}</span><b>− ${money(T.disc)}</b></div>` : ''}${T.tax ? `<div><span>${t('tax')}</span><b>${money(T.tax)}</b></div>` : ''}<div class="grand"><span>${t('total')}</span><span>${money(T.total)}</span></div>`;
  $('#payBtn').disabled = !POS.cart.length;
}

/* ---------- payment modal ---------- */
function openPay() {
  const T = posTotals(); if (!POS.cart.length) return toast(t('cartEmpty'), 'err');
  const cust = POS.customers.find(c => c.id === POS.customer);
  const L = [{ m: 'CASH', a: T.total, r: '' }]; let tend = '';
  const m = openModal(t('payment'), `<div id="pbody"></div>`, { noFocus: true });
  const draw = () => {
    $('#pbody', m).innerHTML = `<div class="paytot"><span>${t('total')}</span><b>${money(T.total)}</b></div>
      ${L.map((l, i) => `<div class="payline"><select data-i="${i}" data-k="m" aria-label="${esc(t('method'))}">${PM.map(p => `<option value="${p}" ${p === l.m ? 'selected' : ''}>${pmLabel(p)}</option>`).join('')}</select>
        <input type="number" min="0" step="any" inputmode="decimal" data-i="${i}" data-k="a" value="${l.a}" aria-label="${esc(t('amount'))}"><input data-i="${i}" data-k="r" placeholder="${esc(t('reference'))}" value="${esc(l.r)}"><button class="btn ghost sm" data-del="${i}" aria-label="${esc(t('remove'))}">✕</button></div>`).join('')}
      <div class="rowbtns"><button class="btn ghost sm" id="addpm">+ ${t('addMethod')}</button><button class="btn ghost sm" id="credit">${t('sellOnCredit')}</button></div>
      <div class="paysum"><div><span class="hint">${t('paid')}</span><b id="s_paid"></b></div><div id="s_credit_w"><span class="hint">${t('creditBalance')}</span><b id="s_credit"></b></div></div>
      <p id="s_note"></p>
      <div class="payline" style="grid-template-columns:1fr 1fr"><label class="f"><span>${t('cashReceived')}</span><input type="number" id="tend" min="0" step="any" inputmode="decimal" value="${tend}"></label><div class="change">${t('change')}: <b id="chg">0</b></div></div>
      <button class="btn big" id="confirmPay">✔ ${t('confirmSale')}</button>`;
    sum();
  };
  const sum = () => {
    const paid = round2(L.reduce((s, l) => s + num(l.a), 0)), rem = round2(T.total - paid);
    $('#s_paid', m).textContent = money(paid);
    $('#s_credit', m).textContent = money(Math.max(rem, 0)); $('#s_credit_w', m).className = rem > 0 ? 'low' : '';
    const note = $('#s_note', m); let ok = true;
    if (rem < 0) { note.className = 'err'; note.textContent = `${t('overpaid')}: ${money(-rem)}`; ok = false; }
    else if (rem > 0 && !cust) { note.className = 'err'; note.textContent = t('creditNeedsCustomer'); ok = false; }
    else if (rem > 0) { note.className = 'mut'; note.textContent = `${t('creditTo')}: ${cust.name}`; }
    else note.textContent = '';
    if (L.some(l => num(l.a) < 0)) ok = false;
    $('#confirmPay', m).disabled = !ok;
    const cash = L.filter(l => l.m === 'CASH').reduce((s, l) => s + num(l.a), 0);
    $('#chg', m).textContent = money(Math.max(num($('#tend', m).value) - cash, 0));
  };
  draw();
  m.addEventListener('input', e => {
    const d = e.target.dataset; if (e.target.id === 'tend') { tend = e.target.value; return sum(); }
    if (d.i === undefined) return; L[d.i][d.k] = e.target.value; if (d.k === 'a') sum();
  });
  m.addEventListener('change', e => { const d = e.target.dataset; if (d.k === 'm') { L[d.i].m = e.target.value; sum(); } });
  m.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.del !== undefined) { L.splice(b.dataset.del, 1); draw(); }
    else if (b.id === 'addpm') { const rem = round2(T.total - L.reduce((s, l) => s + num(l.a), 0)); L.push({ m: 'MPESA', a: rem > 0 ? rem : 0, r: '' }); draw(); }
    else if (b.id === 'credit') { L.length = 0; draw(); }
    else if (b.id === 'confirmPay') await withBusy(b, async () => {
      const payments = L.filter(l => num(l.a) > 0).map(l => ({ method: l.m, amount: round2(l.a), reference: l.r || '' }));
      const res = await rpc('process_pos_sale', {
        p_customer_id: POS.customer || null,
        p_items: POS.cart.map(l => ({ product_id: l.id, quantity: l.qty })),
        p_payments: payments, p_discount: T.disc, p_tax: T.tax, p_cashier_id: ME.id });
      POS.cart = []; POS.discount = 0; POS.taxOn = false; POS.customer = ''; POS.q = '';
      closeModal(); toast(`${t('saleDone')} ${res.receipt_number}`);
      await VIEWS.pos(); showReceipt(res.sale_id);
    });
  });
}

/* ---------- receipt ---------- */
async function loadReceipt(id) {
  const s = must(await sb.from('sales').select('*,customers(name,phone),profiles(full_name),sale_items(quantity,unit_price,subtotal,products(name)),sale_payments(payment_method,amount_paid,reference_number)').eq('id', id).single());
  return s;
}
function receiptHtml(s) {
  const paid = (s.sale_payments || []).reduce((a, p) => a + num(p.amount_paid), 0), due = round2(num(s.net_total) - paid);
  return `<div class="receipt">
    ${SET.logo_url ? `<img src="${esc(SET.logo_url)}" alt="">` : ''}<h3>${esc(SET.business_name)}</h3>
    <div class="c">${esc(SET.address || '')}${SET.phone ? '<br>' + esc(SET.phone) : ''}${SET.tin_vat ? '<br>TIN/VAT: ' + esc(SET.tin_vat) : ''}</div><hr>
    <div>${t('receipt')}: <b>${esc(s.receipt_number)}</b></div><div>${t('date')}: ${fdt(s.created_at)}</div>
    <div>${t('cashier')}: ${esc(s.profiles?.full_name || '-')}</div>${s.customers ? `<div>${t('customer')}: ${esc(s.customers.name)}</div>` : ''}
    ${s.is_voided ? `<div class="c"><b>*** ${t('voided')} ***</b></div>` : ''}<hr>
    <table>${(s.sale_items || []).map(i => `<tr><td colspan="2">${esc(i.products?.name || '')}</td></tr><tr><td>${i.quantity} × ${fmt(i.unit_price)}</td><td class="r">${fmt(i.subtotal)}</td></tr>`).join('')}</table><hr>
    <table><tr><td>${t('subtotal')}</td><td class="r">${fmt(s.total_amount)}</td></tr>
    ${num(s.discount_amount) ? `<tr><td>${t('discount')}</td><td class="r">-${fmt(s.discount_amount)}</td></tr>` : ''}
    ${num(s.tax_amount) ? `<tr><td>${t('tax')}</td><td class="r">${fmt(s.tax_amount)}</td></tr>` : ''}
    <tr class="tot"><td>${t('total')} (${esc(SET.currency)})</td><td class="r">${fmt(s.net_total)}</td></tr></table><hr>
    <table>${(s.sale_payments || []).map(p => `<tr><td>${pmLabel(p.payment_method)}${p.reference_number ? ' #' + esc(p.reference_number) : ''}</td><td class="r">${fmt(p.amount_paid)}</td></tr>`).join('')}
    ${due > 0 ? `<tr class="tot"><td>${t('creditBalance')}</td><td class="r">${fmt(due)}</td></tr>` : ''}</table><hr>
    <div class="c">${esc(SET.receipt_footer || '')}</div></div>`;
}
function receiptText(s) {
  const L = [`*${SET.business_name}*`, `${t('receipt')}: ${s.receipt_number}`, fdt(s.created_at), ''];
  (s.sale_items || []).forEach(i => L.push(`${i.products?.name || ''}  ${i.quantity} x ${fmt(i.unit_price)} = ${fmt(i.subtotal)}`));
  L.push('', `${t('total')}: ${money(s.net_total)}`, '', SET.receipt_footer || '');
  return L.join('\n');
}
async function showReceipt(id) {
  const s = await loadReceipt(id);
  const m = openModal(t('receipt'), `${receiptHtml(s)}<div class="mfoot" style="justify-content:center"><button class="btn" id="rPrint">🖨 ${t('print')}</button><button class="btn ghost" id="rWa">WhatsApp</button><button class="btn ghost" id="rClose">${t('close')}</button></div>`, { noFocus: true });
  $('#rPrint', m).onclick = () => printHtml(receiptHtml(s));
  $('#rWa', m).onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(receiptText(s)), '_blank', 'noopener');
  $('#rClose', m).onclick = closeModal;
}
function printHtml(html) {
  $('#printArea').innerHTML = html; document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); window.print();
}

/* =====================================================================
   PRODUCTS & INVENTORY
   ===================================================================== */
const PR = { all: [], cats: [], sups: [], q: '', cat: '', status: '', page: 1 };
const PSIZE = 20;
const stockState = p => !p.active ? 'inactive' : p.current_stock <= 0 ? 'out' : p.current_stock <= p.minimum_stock ? 'low' : 'ok';
const stockBadge = p => { const s = stockState(p); return badge(s === 'ok' ? 'ok' : s === 'low' ? 'low' : s === 'out' ? 'out' : 'info', t(s === 'ok' ? 'active' : s === 'low' ? 'lowStock' : s === 'out' ? 'outStock' : 'inactive')); };
const marginPct = p => num(p.selling_price) > 0 ? (num(p.selling_price) - num(p.buying_price)) / num(p.selling_price) * 100 : 0;
const canEditStock = () => can('MANAGER', 'STOREKEEPER');

VIEWS.products = async function () {
  const alive = live();
  const [all, cats, sups] = await Promise.all([
    fetchAll(() => sb.from('products').select('*,categories(name),suppliers(name)').order('name').order('id')),
    sb.from('categories').select('id,name').order('name').then(must),
    sb.from('suppliers').select('id,name').order('name').then(r => r.error ? [] : r.data)
  ]);
  if (!alive()) return;
  Object.assign(PR, { all, cats, sups });
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_products')}</h2><div class="toolbar">
      ${canEditStock() ? `<button class="btn" id="pAdd">+ ${t('addProduct')}</button><button class="btn ghost" id="pImp">⬆ ${t('importCsv')}</button><button class="btn ghost" id="pCats">🏷 ${t('categories')}</button>` : ''}
      <button class="btn ghost" id="pExp">⬇ ${t('exportCsv')}</button></div></div>
    <div class="card"><div class="toolbar"><input id="pSearch" class="grow" type="search" placeholder="${esc(t('search'))}" value="${esc(PR.q)}">
      <select id="pCat"><option value="">${t('allCategories')}</option>${cats.map(c => `<option value="${c.id}" ${PR.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select id="pStat">${[['', t('allStatus')], ['ok', t('active')], ['low', t('lowStock')], ['out', t('outStock')], ['inactive', t('inactive')]].map(([v, l]) => `<option value="${v}" ${PR.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div id="pTable" style="margin-top:12px"></div><div class="pager" id="pPager"></div></div>`;
  drawProducts();
  $('#pSearch').oninput = e => { PR.q = e.target.value; PR.page = 1; drawProducts(); };
  $('#pCat').onchange = e => { PR.cat = e.target.value; PR.page = 1; drawProducts(); };
  $('#pStat').onchange = e => { PR.status = e.target.value; PR.page = 1; drawProducts(); };
  $('#pExp').onclick = () => exportCSV('products', PR.all.map(p => ({ name: p.name, sku: p.sku, barcode: p.barcode, category: p.categories?.name || '', supplier: p.suppliers?.name || '', unit: p.unit, buying_price: p.buying_price, selling_price: p.selling_price, margin_pct: marginPct(p).toFixed(1), stock: p.current_stock, minimum_stock: p.minimum_stock, active: p.active })));
  if (canEditStock()) { $('#pAdd').onclick = () => productModal(); $('#pImp').onclick = importModal; $('#pCats').onclick = categoriesModal; }
};
function filteredPR() {
  const q = PR.q.trim().toLowerCase();
  return PR.all.filter(p => (!PR.cat || p.category_id === PR.cat) && (!PR.status || stockState(p) === PR.status) && (!q || `${p.name} ${p.sku || ''} ${p.barcode || ''}`.toLowerCase().includes(q)));
}
function drawProducts() {
  const list = filteredPR(), pages = Math.max(1, Math.ceil(list.length / PSIZE)); if (PR.page > pages) PR.page = pages;
  const rows = list.slice((PR.page - 1) * PSIZE, PR.page * PSIZE).map(p => `<tr>
    <td><b>${esc(p.name)}</b><br><small class="mut">${esc(p.sku || '')}${p.barcode ? ' · ' + esc(p.barcode) : ''}</small></td><td>${esc(p.categories?.name || '—')}</td>
    <td class="num">${fmt(p.buying_price)}</td><td class="num">${fmt(p.selling_price)}</td><td class="num margin-ind ${marginPct(p) < 10 ? 'low' : 'ok'}">${marginPct(p).toFixed(1)}%</td>
    <td class="num">${p.current_stock} <small class="mut">${esc(p.unit)}</small></td><td>${stockBadge(p)}</td>
    <td>${canEditStock() ? `<div class="actions"><button class="btn ghost sm" data-e="${p.id}">✏️</button><button class="btn ghost sm" data-s="${p.id}">± ${t('stock')}</button></div>` : ''}</td></tr>`);
  $('#pTable').innerHTML = tbl([t('name'), t('category'), { h: t('buyPrice'), c: 'num' }, { h: t('price'), c: 'num' }, { h: t('margin'), c: 'num' }, { h: t('stock'), c: 'num' }, t('status'), ''], rows);
  $('#pPager').innerHTML = pagerHtml(list.length, PR.page, PSIZE); wirePager($('#pPager'), p => { PR.page = p; drawProducts(); });
  $$('[data-e]', $('#pTable')).forEach(b => b.onclick = () => productModal(PR.all.find(p => p.id === b.dataset.e)));
  $$('[data-s]', $('#pTable')).forEach(b => b.onclick = () => stockModal(PR.all.find(p => p.id === b.dataset.s)));
}
function productModal(p) {
  const isNew = !p; p = p || { unit: 'Piece', active: true, minimum_stock: 5, buying_price: 0, selling_price: 0 };
  const m = openModal(isNew ? t('addProduct') : t('editProduct'), `<form id="pf"><div class="fgrid">
    ${F(t('name') + ' *', inp('name', p.name, 'required maxlength="150"'), 'full')}
    ${F('SKU', inp('sku', p.sku || '', 'placeholder="' + esc(t('autoIfEmpty')) + '"'))}${F(t('barcode'), inp('barcode', p.barcode || ''))}
    ${F(t('category'), sel('category_id', [['', '—'], ...PR.cats.map(c => [c.id, c.name])], p.category_id || ''))}
    ${F(t('supplier'), sel('supplier_id', [['', '—'], ...PR.sups.map(c => [c.id, c.name])], p.supplier_id || ''))}
    ${F(t('unit'), sel('unit', UNITS.map(u => [u, t('u_' + u)]), p.unit))}
    ${F(t('minimum'), inp('minimum_stock', p.minimum_stock, 'type="number" min="0" step="1"'))}
    ${F(t('buyPrice') + ' *', inp('buying_price', p.buying_price, 'type="number" min="0" step="any" required'))}
    ${F(t('price') + ' *', inp('selling_price', p.selling_price, 'type="number" min="0" step="any" required'))}
    ${isNew ? F(t('openingStock'), inp('opening', 0, 'type="number" min="0" step="1"')) : ''}
    <div class="f"><span>${t('margin')}</span><b id="pmargin" class="margin-ind">—</b></div>
    ${F(t('description'), `<textarea name="description" maxlength="500">${esc(p.description || '')}</textarea>`, 'full')}
    <label class="check full"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> ${t('active')}</label></div>
    <div class="mfoot"><button type="button" class="btn ghost" id="pcancel">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`);
  const f = $('#pf', m), upd = () => { const b = num(f.buying_price.value), s = num(f.selling_price.value); const mg = s > 0 ? (s - b) / s * 100 : 0; $('#pmargin', m).textContent = s > 0 ? mg.toFixed(1) + '%' : '—'; $('#pmargin', m).className = 'margin-ind ' + (mg < 0 ? 'out' : mg < 10 ? 'low' : 'ok'); };
  f.addEventListener('input', upd); upd(); $('#pcancel', m).onclick = closeModal;
  f.onsubmit = async e => {
    e.preventDefault(); const v = formVals(f), btn = $('button[type=submit]', f);
    if (num(v.selling_price) < num(v.buying_price) && !confirm(t('sellBelowCost'))) return;
    await withBusy(btn, async () => {
      const row = { name: v.name, sku: empty2null(v.sku) || (isNew ? 'P' + Date.now().toString(36).toUpperCase().slice(-6) : null), barcode: empty2null(v.barcode), category_id: empty2null(v.category_id), supplier_id: empty2null(v.supplier_id), unit: v.unit, minimum_stock: Math.max(0, Math.floor(num(v.minimum_stock))), buying_price: num(v.buying_price), selling_price: num(v.selling_price), description: empty2null(v.description), active: !!f.active.checked };
      if (isNew) {
        const ins = must(await sb.from('products').insert({ ...row, current_stock: 0 }).select('id').single());
        const op = Math.floor(num(v.opening)); if (op > 0) await rpc('adjust_stock', { p_product_id: ins.id, p_delta: op, p_type: 'OPENING_STOCK', p_notes: 'Opening stock' });
      } else { if (!row.sku) delete row.sku; must(await sb.from('products').update(row).eq('id', p.id).select('id')); }
      closeModal(); toast(t('saved')); VIEWS.products();
    });
  };
}
function stockModal(p) {
  const m = openModal(`${t('adjustStock')}: ${esc(p.name)}`, `<form id="sf"><p class="mut">${t('stock')}: <b>${p.current_stock}</b> ${esc(p.unit)}</p><div class="fgrid">
    ${F(t('type'), sel('type', [['ADJUSTMENT', t('mv_ADJUSTMENT')], ['DAMAGE', t('mv_DAMAGE')]]))}
    ${F(t('qtyChange'), inp('delta', '', 'type="number" step="1" required placeholder="+10 / -3"'))}
    ${F(t('notes'), inp('notes', ''), 'full')}</div><p class="hint">${t('adjustHint')}</p>
    <div class="mfoot"><button type="button" class="btn ghost" id="scancel">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`);
  $('#scancel', m).onclick = closeModal;
  $('#sf', m).onsubmit = async e => { e.preventDefault(); const v = formVals(e.target);
    await withBusy($('button[type=submit]', e.target), async () => {
      const d = Math.trunc(num(v.delta)); if (!d) throw new Error(t('qtyZero'));
      await rpc('adjust_stock', { p_product_id: p.id, p_delta: d, p_type: v.type, p_notes: v.notes || null });
      closeModal(); toast(t('saved')); VIEWS.products(); }); };
}
function categoriesModal() {
  const draw = async () => {
    const cats = must(await sb.from('categories').select('id,name').order('name'));
    const m = $('.modal') || openModal(t('categories'), '<div id="cbody"></div>');
    $('#cbody', m).innerHTML = `<form id="cf" class="toolbar"><input name="name" class="grow" placeholder="${esc(t('categoryName'))}" required maxlength="60"><button class="btn" type="submit">+ ${t('add')}</button></form>
      <div style="margin-top:12px">${cats.length ? cats.map(c => `<div class="row"><div><span>${esc(c.name)}</span><button class="btn ghost sm" data-del="${c.id}">🗑</button></div></div>`).join('') : `<div class="empty">${t('noData')}</div>`}</div>`;
    $('#cf', m).onsubmit = async e => { e.preventDefault(); await withBusy($('button', e.target), async () => { must(await sb.from('categories').insert({ name: formVals(e.target).name }).select('id')); await draw(); }); };
    $$('[data-del]', m).forEach(b => b.onclick = async () => { if (!confirm(t('confirmDelete'))) return; await withBusy(b, async () => { must(await sb.from('categories').delete().eq('id', b.dataset.del).select('id')); await draw(); }); });
  };
  openModal(t('categories'), '<div id="cbody"></div>'); draw().catch(fail);
  $('#modalRoot .x').onclick = () => { closeModal(); VIEWS.products(); };
}

/* ---------- CSV product import ---------- */
const IMPORT_COLS = { name: ['name', 'product', 'jina', 'bidhaa'], sku: ['sku', 'code'], barcode: ['barcode', 'bar code'], category: ['category', 'kategoria'], buying_price: ['buying_price', 'buying price', 'cost', 'bei ya kununua'], selling_price: ['selling_price', 'selling price', 'price', 'bei', 'bei ya kuuza'], stock: ['stock', 'opening_stock', 'quantity', 'qty', 'hisa'], minimum_stock: ['minimum_stock', 'min_stock', 'minimum', 'reorder'], unit: ['unit', 'kipimo'], description: ['description', 'maelezo'] };
function importModal() {
  const m = openModal(t('importCsv'), `<p class="mut">${t('importHelp')}</p><div class="toolbar"><button class="btn ghost sm" id="tpl">⬇ ${t('downloadTemplate')}</button></div>
    <div class="drop" style="margin-top:12px"><input type="file" id="ifile" accept=".csv,text/csv"></div><div id="iprev" style="margin-top:12px"></div>`, { wide: true, noFocus: true });
  $('#tpl', m).onclick = () => exportCSV('products_template', [{ name: 'Blue Pen', sku: 'PEN-BLU', barcode: '', category: 'Pens & Pencils', buying_price: 300, selling_price: 500, stock: 100, minimum_stock: 20, unit: 'Piece', description: '' }]);
  $('#ifile', m).onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5e6) return toast(t('fileTooBig'), 'err');
    const rows = parseCSV(await file.text()); if (rows.length < 2) return toast(t('csvEmpty'), 'err');
    const head = rows[0].map(h => h.trim().toLowerCase()), idx = {};
    for (const [k, names] of Object.entries(IMPORT_COLS)) idx[k] = head.findIndex(h => names.includes(h));
    if (idx.name < 0 || idx.selling_price < 0) return toast(t('csvHeaders'), 'err');
    const catMap = new Map(PR.cats.map(c => [c.name.toLowerCase(), c.id])), skus = new Set(PR.all.map(p => (p.sku || '').toLowerCase()).filter(Boolean)), bcs = new Set(PR.all.map(p => (p.barcode || '').toLowerCase()).filter(Boolean));
    const good = [], bad = [];
    rows.slice(1).forEach((r, i) => {
      const g = k => idx[k] >= 0 ? (r[idx[k]] || '').trim() : '', line = i + 2, errs = [];
      const name = g('name'), sku = g('sku'), bc = g('barcode'), bp = g('buying_price') === '' ? 0 : Number(g('buying_price')), sp = Number(g('selling_price')), st = g('stock') === '' ? 0 : Number(g('stock')), mn = g('minimum_stock') === '' ? 5 : Number(g('minimum_stock'));
      let unit = g('unit') || 'Piece'; unit = UNITS.find(u => u.toLowerCase() === unit.toLowerCase()) || null;
      if (!name) errs.push(t('e_name')); if (!Number.isFinite(sp) || sp < 0 || g('selling_price') === '') errs.push(t('e_sell')); if (!Number.isFinite(bp) || bp < 0) errs.push(t('e_buy'));
      if (!Number.isInteger(st) || st < 0) errs.push(t('e_stock')); if (!Number.isInteger(mn) || mn < 0) errs.push(t('e_min')); if (!unit) errs.push(t('e_unit'));
      if (sku && skus.has(sku.toLowerCase())) errs.push(t('e_dupSku')); if (bc && bcs.has(bc.toLowerCase())) errs.push(t('e_dupBc'));
      if (errs.length) return bad.push({ line, name, errs });
      if (sku) skus.add(sku.toLowerCase()); if (bc) bcs.add(bc.toLowerCase());
      good.push({ name, sku: sku || 'P' + (Date.now() + i).toString(36).toUpperCase().slice(-7), barcode: bc || null, category: g('category'), buying_price: bp, selling_price: sp, stock: st, minimum_stock: mn, unit, description: g('description') || null });
    });
    $('#iprev', m).innerHTML = `<p><b class="ok">${good.length}</b> ${t('rowsReady')} · <b class="${bad.length ? 'out' : ''}">${bad.length}</b> ${t('rowsErrors')}</p>
      ${bad.length ? tbl([t('line'), t('name'), t('problems')], bad.slice(0, 50).map(b => `<tr><td>${b.line}</td><td>${esc(b.name)}</td><td class="out">${esc(b.errs.join(', '))}</td></tr>`)) : ''}
      ${good.length ? `<div class="mfoot"><button class="btn" id="idoit">⬆ ${t('importNow')} (${good.length})</button></div>` : ''}`;
    const go = $('#idoit', m); if (!go) return;
    go.onclick = () => withBusy(go, async () => {
      for (const name of [...new Set(good.map(g => g.category).filter(Boolean))]) if (!catMap.has(name.toLowerCase())) { const c = must(await sb.from('categories').insert({ name }).select('id,name').single()); catMap.set(c.name.toLowerCase(), c.id); }
      let done = 0;
      for (let i = 0; i < good.length; i += 100) {
        const chunk = good.slice(i, i + 100);
        const ins = must(await sb.from('products').insert(chunk.map(g => ({ name: g.name, sku: g.sku, barcode: g.barcode, category_id: g.category ? catMap.get(g.category.toLowerCase()) : null, buying_price: g.buying_price, selling_price: g.selling_price, current_stock: g.stock, minimum_stock: g.minimum_stock, unit: g.unit, description: g.description }))).select('id,sku,current_stock'));
        const mv = ins.filter(x => x.current_stock > 0).map(x => ({ product_id: x.id, movement_type: 'OPENING_STOCK', quantity: x.current_stock, created_by: ME.id, notes: 'CSV import' }));
        if (mv.length) must(await sb.from('stock_movements').insert(mv).select('id'));
        done += chunk.length;
      }
      closeModal(); toast(`${done} ${t('imported')}`); VIEWS.products();
    });
  };
}

/* =====================================================================
   SALES HISTORY · RETURNS · VOID
   ===================================================================== */
const SH = { rows: [], q: '', status: '', page: 1 };
VIEWS.sales = async function () {
  const R = getRange('sales', 'today');
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_sales')}</h2>${rangeHtml('sales')}</div>
    <div class="card"><div class="toolbar"><input id="shq" class="grow" type="search" placeholder="${esc(t('searchReceipt'))}" value="${esc(SH.q)}">
      <select id="shs">${[['', t('allStatus')], ['PAID', t('st_PAID')], ['PARTIAL', t('st_PARTIAL')], ['CREDIT', t('st_CREDIT')], ['VOID', t('voided')]].map(([v, l]) => `<option value="${v}" ${SH.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn ghost" id="shx">⬇ ${t('exportCsv')}</button></div><div id="shsum" class="hint" style="margin:10px 0"></div><div id="shtable"></div><div class="pager" id="shpager"></div></div>`;
  wireRange('sales', load);
  $('#shq').oninput = e => { SH.q = e.target.value; SH.page = 1; drawSales(); }; $('#shs').onchange = e => { SH.status = e.target.value; SH.page = 1; drawSales(); };
  $('#shx').onclick = () => exportCSV('sales', filteredSH().map(s => ({ receipt: s.receipt_number, date: s.created_at, customer: s.customers?.name || '', cashier: s.profiles?.full_name || '', subtotal: s.total_amount, discount: s.discount_amount, tax: s.tax_amount, net_total: s.net_total, status: s.is_voided ? 'VOID' : s.payment_status })));
  await load();
  async function load() {
    const alive = live(), r = rangeDates(R);
    SH.rows = await fetchAll(() => sb.from('sales').select('id,receipt_number,created_at,total_amount,discount_amount,tax_amount,net_total,payment_status,is_voided,void_reason,customers(name),profiles(full_name)').gte('created_at', r.from).lt('created_at', r.to).order('created_at', { ascending: false }).order('id'));
    if (alive()) drawSales();
  }
};
const filteredSH = () => { const q = SH.q.trim().toLowerCase(); return SH.rows.filter(s => (!SH.status || (SH.status === 'VOID' ? s.is_voided : (!s.is_voided && s.payment_status === SH.status))) && (!q || s.receipt_number.toLowerCase().includes(q) || (s.customers?.name || '').toLowerCase().includes(q))); };
function drawSales() {
  const list = filteredSH(), size = 20, pages = Math.max(1, Math.ceil(list.length / size)); if (SH.page > pages) SH.page = pages;
  const live_ = list.filter(s => !s.is_voided), total = live_.reduce((a, s) => a + num(s.net_total), 0);
  $('#shsum').textContent = `${live_.length} ${t('salesWord')} · ${t('total')}: ${money(total)}`;
  $('#shtable').innerHTML = tbl([t('receipt'), t('date'), t('customer'), t('cashier'), { h: t('total'), c: 'num' }, t('status'), ''], list.slice((SH.page - 1) * size, SH.page * size).map(s => `<tr class="${s.is_voided ? 'void' : ''}">
    <td><b>${esc(s.receipt_number)}</b></td><td class="nowrap">${fdt(s.created_at)}</td><td>${esc(s.customers?.name || t('walkIn'))}</td><td>${esc(s.profiles?.full_name || '')}</td><td class="num">${fmt(s.net_total)}</td>
    <td>${s.is_voided ? badge('out', t('voided')) : badge(s.payment_status === 'PAID' ? 'ok' : 'low', t('st_' + s.payment_status))}</td>
    <td><div class="actions"><button class="btn ghost sm" data-v="${s.id}">🧾</button>${!s.is_voided ? `<button class="btn ghost sm" data-r="${s.id}">↩ ${t('return')}</button>` : ''}${!s.is_voided && can('MANAGER') ? `<button class="btn ghost sm" data-x="${s.id}">🚫 ${t('void')}</button>` : ''}</div></td></tr>`));
  $('#shpager').innerHTML = pagerHtml(list.length, SH.page, size); wirePager($('#shpager'), p => { SH.page = p; drawSales(); });
  $$('[data-v]', $('#shtable')).forEach(b => b.onclick = () => withBusy(b, () => showReceipt(b.dataset.v)));
  $$('[data-r]', $('#shtable')).forEach(b => b.onclick = () => withBusy(b, () => returnModal(b.dataset.r)));
  $$('[data-x]', $('#shtable')).forEach(b => b.onclick = () => voidModal(SH.rows.find(s => s.id === b.dataset.x)));
}
async function returnModal(saleId) {
  const [s, rets] = await Promise.all([loadReceipt(saleId), sb.from('sales_returns').select('sales_return_items(product_id,quantity)').eq('sale_id', saleId).then(must)]);
  const prev = {}; rets.forEach(r => (r.sales_return_items || []).forEach(i => { prev[i.product_id] = (prev[i.product_id] || 0) + i.quantity; }));
  const items = await sb.from('sale_items').select('product_id,quantity,unit_price,products(name)').eq('sale_id', saleId).then(must);
  const m = openModal(`${t('return')}: ${esc(s.receipt_number)}`, `<form id="rf">${tbl([t('product'), { h: t('sold'), c: 'num' }, { h: t('alreadyReturned'), c: 'num' }, { h: t('returnQty'), c: 'num' }],
    items.map(i => { const left = i.quantity - (prev[i.product_id] || 0); return `<tr><td>${esc(i.products?.name)}</td><td class="num">${i.quantity}</td><td class="num">${prev[i.product_id] || 0}</td><td class="num"><input type="number" min="0" max="${left}" step="1" value="0" data-p="${i.product_id}" ${left <= 0 ? 'disabled' : ''} style="width:80px"></td></tr>`; }))}
    <div class="fgrid" style="margin-top:12px">${F(t('reason'), inp('reason', '', 'required'), 'full')}${s.customer_id ? '' : F(t('refundMethod'), sel('method', pmOpts(), 'CASH'))}</div>
    <p class="hint">${t('returnHint')}</p><div class="mfoot"><button type="button" class="btn ghost" id="rcancel">${t('cancel')}</button><button class="btn" type="submit">${t('confirm')}</button></div></form>`, { wide: true });
  $('#rcancel', m).onclick = closeModal;
  $('#rf', m).onsubmit = async e => { e.preventDefault(); const v = formVals(e.target);
    await withBusy($('button[type=submit]', e.target), async () => {
      const sel_ = $$('[data-p]', e.target).map(i => ({ product_id: i.dataset.p, quantity: Math.floor(num(i.value)) })).filter(i => i.quantity > 0); if (!sel_.length) throw new Error(t('nothingToReturn'));
      const res = await rpc('process_sale_return', { p_sale_id: saleId, p_items: sel_, p_reason: v.reason, p_user_id: ME.id, p_method: v.method || 'CASH' });
      closeModal(); toast(`${t('returned')}: ${money(res.refund)}${res.credit_offset > 0 ? ` (${t('offsetDebt')}: ${money(res.credit_offset)})` : ''}`); VIEWS.sales(); }); };
}
function voidModal(s) {
  const m = openModal(`${t('void')}: ${esc(s.receipt_number)}`, `<form id="vf"><p>${t('voidWarn')}</p>${F(t('reason') + ' *', inp('reason', '', 'required'))}<div class="mfoot"><button type="button" class="btn ghost" id="vc">${t('cancel')}</button><button class="btn danger" type="submit">${t('void')}</button></div></form>`);
  $('#vc', m).onclick = closeModal;
  $('#vf', m).onsubmit = async e => { e.preventDefault(); await withBusy($('button[type=submit]', e.target), async () => { await rpc('void_sale', { p_sale_id: s.id, p_reason: formVals(e.target).reason, p_user_id: ME.id }); closeModal(); toast(t('voidDone')); VIEWS.sales(); }); };
}

/* =====================================================================
   CUSTOMERS
   ===================================================================== */
VIEWS.customers = async function () {
  const rows = await fetchAll(() => sb.from('customers').select('*').order('name').order('id')); let q = '';
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_customers')}</h2><div class="toolbar"><button class="btn" id="cAdd">+ ${t('addCustomer')}</button><button class="btn ghost" id="cExp">⬇ ${t('exportCsv')}</button></div></div>
    <div class="card"><input id="cq" type="search" class="grow" style="width:100%" placeholder="${esc(t('search'))}"><div class="hint" id="csum" style="margin:10px 0"></div><div id="ctab"></div></div>`;
  const draw_ = () => {
    const l = rows.filter(c => !q || `${c.name} ${c.phone || ''}`.toLowerCase().includes(q)); $('#csum').textContent = `${t('custCredit')}: ${money(rows.reduce((a, c) => a + num(c.outstanding_balance), 0))}`;
    $('#ctab').innerHTML = tbl([t('name'), t('phone'), t('type'), { h: t('creditLimit'), c: 'num' }, { h: t('owes'), c: 'num' }, ''], l.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.phone || '')}</td><td>${esc(c.customer_type || '')}</td><td class="num">${num(c.credit_limit) ? fmt(c.credit_limit) : '∞'}</td><td class="num ${c.outstanding_balance > 0 ? 'low' : ''}">${fmt(c.outstanding_balance)}</td>
      <td><div class="actions">${c.outstanding_balance > 0 ? `<button class="btn sm" data-pay="${c.id}">💵 ${t('receivePayment')}</button>` : ''}<button class="btn ghost sm" data-st="${c.id}">📄</button>${can('MANAGER') ? `<button class="btn ghost sm" data-ed="${c.id}">✏️</button>` : ''}</div></td></tr>`));
    $$('[data-pay]', $('#ctab')).forEach(b => b.onclick = () => payModal({ title: t('receivePayment'), who: rows.find(c => c.id === b.dataset.pay), rpcName: 'receive_customer_payment', idKey: 'p_customer_id', bal: 'outstanding_balance', done: () => VIEWS.customers() }));
    $$('[data-st]', $('#ctab')).forEach(b => b.onclick = () => withBusy(b, () => customerStatement(rows.find(c => c.id === b.dataset.st))));
    $$('[data-ed]', $('#ctab')).forEach(b => b.onclick = () => customerModal(rows.find(c => c.id === b.dataset.ed)));
  };
  draw_(); $('#cq').oninput = e => { q = e.target.value.toLowerCase(); draw_(); };
  $('#cAdd').onclick = () => customerModal();
  $('#cExp').onclick = () => exportCSV('customers', rows.map(c => ({ name: c.name, phone: c.phone, email: c.email, address: c.address, type: c.customer_type, credit_limit: c.credit_limit, outstanding_balance: c.outstanding_balance })));
};
function customerModal(c) {
  const isNew = !c; c = c || { customer_type: 'RETAIL', credit_limit: 0 };
  const m = openModal(isNew ? t('addCustomer') : t('editCustomer'), `<form id="cf"><div class="fgrid">${F(t('name') + ' *', inp('name', c.name || '', 'required'), 'full')}${F(t('phone'), inp('phone', c.phone || '', 'type="tel"'))}${F('Email', inp('email', c.email || '', 'type="email"'))}
    ${F(t('type'), sel('customer_type', [['RETAIL', t('ct_RETAIL')], ['WHOLESALE', t('ct_WHOLESALE')], ['SCHOOL', t('ct_SCHOOL')], ['OFFICE', t('ct_OFFICE')]], c.customer_type))}
    ${can('MANAGER') ? F(t('creditLimit'), inp('credit_limit', c.credit_limit, 'type="number" min="0" step="any"') + `<small class="hint">${t('limitHint')}</small>`) : ''}
    ${F(t('address'), inp('address', c.address || ''), 'full')}${F(t('notes'), inp('notes', c.notes || ''), 'full')}</div><div class="mfoot"><button type="button" class="btn ghost" id="cc">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`);
  $('#cc', m).onclick = closeModal;
  $('#cf', m).onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); await withBusy($('button[type=submit]', e.target), async () => {
    const row = { name: v.name, phone: empty2null(v.phone), email: empty2null(v.email), customer_type: v.customer_type, address: empty2null(v.address), notes: empty2null(v.notes) }; if (can('MANAGER')) row.credit_limit = Math.max(0, num(v.credit_limit));
    if (isNew) must(await sb.from('customers').insert(row).select('id')); else must(await sb.from('customers').update(row).eq('id', c.id).select('id'));
    closeModal(); toast(t('saved')); if (CUR_VIEW() === 'customers') VIEWS.customers(); }); };
}
const CUR_VIEW = () => (location.hash || '').slice(1);
function payModal({ title, who, rpcName, idKey, bal, done }) {
  const m = openModal(`${title}: ${esc(who.name)}`, `<form id="pf2"><p class="mut">${t('balance')}: <b>${money(who[bal])}</b></p><div class="fgrid">${F(t('amount'), inp('amount', who[bal], `type="number" min="0.01" max="${who[bal]}" step="any" required`))}${F(t('method'), sel('method', pmOpts(), 'CASH'))}${F(t('notes'), inp('notes', ''), 'full')}</div>
    <div class="mfoot"><button type="button" class="btn ghost" id="pc">${t('cancel')}</button><button class="btn" type="submit">${t('confirm')}</button></div></form>`);
  $('#pc', m).onclick = closeModal;
  $('#pf2', m).onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); await withBusy($('button[type=submit]', e.target), async () => { await rpc(rpcName, { [idKey]: who.id, p_amount: round2(v.amount), p_method: v.method, p_notes: v.notes || null }); closeModal(); toast(t('saved')); done(); }); };
}
async function customerStatement(c) {
  const [sales, pays] = await Promise.all([
    sb.from('sales').select('receipt_number,created_at,net_total,payment_status,is_voided').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(100).then(must),
    sb.from('financial_transactions').select('amount,payment_method,transaction_date,description').eq('transaction_type', 'CUSTOMER_PAYMENT').eq('reference_id', c.id).order('transaction_date', { ascending: false }).limit(100).then(must)]);
  openModal(`${t('statement')}: ${esc(c.name)}`, `<p>${t('owes')}: <b class="low">${money(c.outstanding_balance)}</b></p><h4>${t('nav_sales')}</h4>
    ${tbl([t('receipt'), t('date'), { h: t('total'), c: 'num' }, t('status')], sales.map(s => `<tr class="${s.is_voided ? 'void' : ''}"><td>${esc(s.receipt_number)}</td><td>${fdt(s.created_at)}</td><td class="num">${fmt(s.net_total)}</td><td>${s.is_voided ? t('voided') : t('st_' + s.payment_status)}</td></tr>`))}
    <h4>${t('payments')}</h4>${tbl([t('date'), t('method'), { h: t('amount'), c: 'num' }], pays.map(p => `<tr><td>${fdt(p.transaction_date)}</td><td>${pmLabel(p.payment_method)}</td><td class="num">${fmt(p.amount)}</td></tr>`))}`, { wide: true });
}

/* =====================================================================
   SUPPLIERS & PURCHASES
   ===================================================================== */
VIEWS.suppliers = async function () {
  const rows = await fetchAll(() => sb.from('suppliers').select('*').order('name').order('id'));
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_suppliers')}</h2><div class="toolbar"><button class="btn" id="sAdd">+ ${t('addSupplier')}</button><button class="btn ghost" id="sExp">⬇ ${t('exportCsv')}</button></div></div>
    <div class="card"><div class="hint" style="margin-bottom:10px">${t('supplierDue')}: <b>${money(rows.reduce((a, s) => a + num(s.balance_due), 0))}</b></div>
    ${tbl([t('name'), t('company'), t('phone'), { h: t('balanceDue'), c: 'num' }, ''], rows.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.company || '')}</td><td>${esc(s.phone || '')}</td><td class="num ${s.balance_due > 0 ? 'low' : ''}">${fmt(s.balance_due)}</td>
      <td><div class="actions">${s.balance_due > 0 && can('MANAGER') ? `<button class="btn sm" data-pay="${s.id}">💵 ${t('paySupplier')}</button>` : ''}<button class="btn ghost sm" data-led="${s.id}">📄</button><button class="btn ghost sm" data-ed="${s.id}">✏️</button></div></td></tr>`))}</div>`;
  $('#sAdd').onclick = () => supplierModal(); $('#sExp').onclick = () => exportCSV('suppliers', rows.map(s => ({ name: s.name, company: s.company, phone: s.phone, email: s.email, address: s.address, tin_vat: s.tin_vat, balance_due: s.balance_due })));
  $$('[data-ed]').forEach(b => b.onclick = () => supplierModal(rows.find(s => s.id === b.dataset.ed)));
  $$('[data-pay]').forEach(b => b.onclick = () => payModal({ title: t('paySupplier'), who: rows.find(s => s.id === b.dataset.pay), rpcName: 'pay_supplier', idKey: 'p_supplier_id', bal: 'balance_due', done: () => VIEWS.suppliers() }));
  $$('[data-led]').forEach(b => b.onclick = () => withBusy(b, () => supplierLedger(rows.find(s => s.id === b.dataset.led))));
};
function supplierModal(s) {
  const isNew = !s; s = s || {};
  const m = openModal(isNew ? t('addSupplier') : t('editSupplier'), `<form id="sf2"><div class="fgrid">${F(t('name') + ' *', inp('name', s.name || '', 'required'))}${F(t('company'), inp('company', s.company || ''))}${F(t('phone'), inp('phone', s.phone || '', 'type="tel"'))}${F('Email', inp('email', s.email || '', 'type="email"'))}${F('TIN/VAT', inp('tin_vat', s.tin_vat || ''))}${F(t('address'), inp('address', s.address || ''))}${F(t('notes'), inp('notes', s.notes || ''), 'full')}</div>
    <div class="mfoot"><button type="button" class="btn ghost" id="sc">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`);
  $('#sc', m).onclick = closeModal;
  $('#sf2', m).onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); await withBusy($('button[type=submit]', e.target), async () => {
    const row = { name: v.name, company: empty2null(v.company), phone: empty2null(v.phone), email: empty2null(v.email), tin_vat: empty2null(v.tin_vat), address: empty2null(v.address), notes: empty2null(v.notes) };
    if (isNew) must(await sb.from('suppliers').insert(row).select('id')); else must(await sb.from('suppliers').update(row).eq('id', s.id).select('id'));
    closeModal(); toast(t('saved')); VIEWS.suppliers(); }); };
}
async function supplierLedger(s) {
  const [pur, pays] = await Promise.all([
    sb.from('purchases').select('purchase_order_no,created_at,total_amount,paid_amount,status').eq('supplier_id', s.id).order('created_at', { ascending: false }).limit(100).then(must),
    sb.from('financial_transactions').select('amount,payment_method,transaction_date').eq('transaction_type', 'SUPPLIER_PAYMENT').eq('reference_id', s.id).order('transaction_date', { ascending: false }).limit(100).then(r => r.error ? [] : r.data)]);
  openModal(`${t('ledger')}: ${esc(s.name)}`, `<p>${t('balanceDue')}: <b class="low">${money(s.balance_due)}</b></p><h4>${t('nav_purchases')}</h4>
    ${tbl([t('po'), t('date'), { h: t('total'), c: 'num' }, { h: t('paid'), c: 'num' }, t('status')], pur.map(p => `<tr><td>${esc(p.purchase_order_no)}</td><td>${fdt(p.created_at)}</td><td class="num">${fmt(p.total_amount)}</td><td class="num">${fmt(p.paid_amount)}</td><td>${t('st_' + p.status)}</td></tr>`))}
    <h4>${t('payments')}</h4>${tbl([t('date'), t('method'), { h: t('amount'), c: 'num' }], pays.map(p => `<tr><td>${fdt(p.transaction_date)}</td><td>${pmLabel(p.payment_method)}</td><td class="num">${fmt(p.amount)}</td></tr>`))}`, { wide: true });
}

VIEWS.purchases = async function () {
  const rows = await fetchAll(() => sb.from('purchases').select('id,purchase_order_no,created_at,total_amount,paid_amount,status,notes,suppliers(name)').order('created_at', { ascending: false }).order('id'));
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_purchases')}</h2><div class="toolbar"><button class="btn" id="poAdd">+ ${t('newPurchase')}</button><button class="btn ghost" id="poExp">⬇ ${t('exportCsv')}</button></div></div>
    <div class="card">${tbl([t('po'), t('date'), t('supplier'), { h: t('total'), c: 'num' }, { h: t('paid'), c: 'num' }, t('status'), ''], rows.slice(0, 300).map(p => `<tr><td><b>${esc(p.purchase_order_no)}</b></td><td class="nowrap">${fdt(p.created_at)}</td><td>${esc(p.suppliers?.name || '—')}</td><td class="num">${fmt(p.total_amount)}</td><td class="num">${fmt(p.paid_amount)}</td><td>${badge(p.status === 'PAID' ? 'ok' : 'low', t('st_' + p.status))}</td><td><button class="btn ghost sm" data-v="${p.id}">👁</button></td></tr>`))}</div>`;
  $('#poAdd').onclick = purchaseModal; $('#poExp').onclick = () => exportCSV('purchases', rows.map(p => ({ po: p.purchase_order_no, date: p.created_at, supplier: p.suppliers?.name || '', total: p.total_amount, paid: p.paid_amount, status: p.status })));
  $$('[data-v]').forEach(b => b.onclick = () => withBusy(b, async () => {
    const items = must(await sb.from('purchase_items').select('quantity,unit_buying_price,subtotal,products(name)').eq('purchase_id', b.dataset.v)); const p = rows.find(x => x.id === b.dataset.v);
    openModal(`${t('po')}: ${esc(p.purchase_order_no)}`, `${tbl([t('product'), { h: t('qty'), c: 'num' }, { h: t('buyPrice'), c: 'num' }, { h: t('total'), c: 'num' }], items.map(i => `<tr><td>${esc(i.products?.name)}</td><td class="num">${i.quantity}</td><td class="num">${fmt(i.unit_buying_price)}</td><td class="num">${fmt(i.subtotal)}</td></tr>`))}<p>${t('total')}: <b>${money(p.total_amount)}</b> · ${t('paid')}: <b>${money(p.paid_amount)}</b></p>${p.notes ? `<p class="mut">${esc(p.notes)}</p>` : ''}`, { wide: true }); }));
};
async function purchaseModal() {
  const [prods, sups] = await Promise.all([fetchAll(() => sb.from('products').select('id,name,buying_price,current_stock,unit').eq('active', true).order('name').order('id')), sb.from('suppliers').select('id,name').order('name').then(must)]);
  if (!prods.length) return toast(t('addProductsFirst'), 'err');
  const L = [{ id: prods[0].id, q: 1, c: prods[0].buying_price }];
  const m = openModal(t('newPurchase'), `<form id="pof"><div class="fgrid">${F(t('supplier'), sel('supplier', [['', '—'], ...sups.map(s => [s.id, s.name])], ''))}${F(t('notes'), inp('notes', ''))}</div><div id="plines" style="margin:12px 0"></div>
    <button type="button" class="btn ghost sm" id="padd">+ ${t('addLine')}</button><div class="paysum" style="margin-top:14px"><div><span class="hint">${t('total')}</span><b id="ptotal"></b></div></div>
    <div class="fgrid">${F(t('paidNow'), inp('paid', '0', 'type="number" min="0" step="any"'))}${F(t('method'), sel('method', pmOpts(), 'CASH'))}</div><p class="hint">${t('purchaseHint')}</p>
    <div class="mfoot"><button type="button" class="btn ghost" id="pcx">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`, { wide: true });
  const total = () => round2(L.reduce((s, l) => s + num(l.q) * num(l.c), 0));
  const draw_ = () => { $('#plines', m).innerHTML = L.map((l, i) => `<div class="payline" style="grid-template-columns:2fr 1fr 1fr auto"><select data-i="${i}" data-k="id">${prods.map(p => `<option value="${p.id}" ${p.id === l.id ? 'selected' : ''}>${esc(p.name)} (${p.current_stock})</option>`).join('')}</select><input type="number" min="1" step="1" data-i="${i}" data-k="q" value="${l.q}" aria-label="${esc(t('qty'))}"><input type="number" min="0" step="any" data-i="${i}" data-k="c" value="${l.c}" aria-label="${esc(t('buyPrice'))}"><button type="button" class="btn ghost sm" data-del="${i}">✕</button></div>`).join(''); $('#ptotal', m).textContent = money(total()); };
  draw_();
  m.addEventListener('input', e => { const d = e.target.dataset; if (d.i === undefined) return; L[d.i][d.k] = e.target.value; $('#ptotal', m).textContent = money(total()); });
  m.addEventListener('change', e => { const d = e.target.dataset; if (d.k === 'id') { const p = prods.find(x => x.id === e.target.value); L[d.i].c = p.buying_price; draw_(); } });
  m.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.del !== undefined && L.length > 1) { L.splice(b.dataset.del, 1); draw_(); } });
  $('#padd', m).onclick = () => { L.push({ id: prods[0].id, q: 1, c: prods[0].buying_price }); draw_(); };
  $('#pcx', m).onclick = closeModal;
  $('#pof', m).onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); await withBusy($('button[type=submit]', e.target), async () => {
    if (L.some(l => !(Math.floor(num(l.q)) > 0) || num(l.c) < 0)) throw new Error(t('invalidLines'));
    const res = await rpc('process_purchase', { p_supplier_id: v.supplier || null, p_items: L.map(l => ({ product_id: l.id, quantity: Math.floor(num(l.q)), unit_buying_price: num(l.c) })), p_paid_amount: num(v.paid), p_payment_method: v.method, p_user_id: ME.id, p_notes: v.notes || null });
    closeModal(); toast(`${res.po} ✔`); VIEWS.purchases(); }); };
}

/* =====================================================================
   EXPENSES
   ===================================================================== */
const expCatLabel = c => EXP_CATS.includes(c) ? t('ec_' + c) : c;
VIEWS.expenses = async function () {
  const R = getRange('exp', 'month');
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_expenses')}</h2><div class="toolbar">${rangeHtml('exp')}<button class="btn" id="eAdd">+ ${t('addExpense')}</button><button class="btn ghost" id="eExp">⬇ ${t('exportCsv')}</button></div></div><div id="ebody"><div class="loading">…</div></div>`;
  wireRange('exp', load); $('#eAdd').onclick = () => expenseModal(load);
  let rows = [];
  $('#eExp').onclick = () => exportCSV('expenses', rows.map(e => ({ number: e.expense_number, date: e.expense_date, category: e.category, description: e.description, amount: e.amount, method: e.payment_method, notes: e.notes })));
  await load();
  async function load() {
    const alive = live(), r = rangeDates(R);
    rows = await fetchAll(() => sb.from('expenses').select('*').gte('expense_date', r.fromD).lte('expense_date', r.toD).order('expense_date', { ascending: false }).order('id'));
    if (!alive()) return;
    const by = {}; rows.forEach(e => { by[e.category] = (by[e.category] || 0) + num(e.amount); });
    const total = rows.reduce((s, e) => s + num(e.amount), 0), cats = Object.entries(by).sort((a, b) => b[1] - a[1]);
    $('#ebody').innerHTML = `<div class="two"><div class="card"><b>${t('total')}: ${money(total)}</b>${tbl([t('number'), t('date'), t('category'), t('description'), t('method'), { h: t('amount'), c: 'num' }], rows.slice(0, 300).map(e => `<tr><td>${esc(e.expense_number)}</td><td class="nowrap">${fd(e.expense_date)}</td><td>${esc(expCatLabel(e.category))}</td><td>${esc(e.description || '')}</td><td>${pmLabel(e.payment_method)}</td><td class="num">${fmt(e.amount)}</td></tr>`))}</div>
      <div class="card"><b>${t('byCategory')}</b>${donutSvg(cats.slice(0, 6).map(([l, v]) => ({ l: expCatLabel(l), v })))}${cats.map(([l, v]) => `<div class="row"><div><span>${esc(expCatLabel(l))}</span><b>${money(v)}</b></div><i style="width:${Math.max(3, Math.round(v / cats[0][1] * 100))}%"></i></div>`).join('')}</div></div>`;
  }
};
function expenseModal(done) {
  const m = openModal(t('addExpense'), `<form id="ef"><div class="fgrid">${F(t('category') + ' *', `<input name="category" list="ecl" required maxlength="60" placeholder="${esc(t('chooseOrType'))}"><datalist id="ecl">${EXP_CATS.map(c => `<option value="${c}">${esc(t('ec_' + c))}</option>`).join('')}</datalist>`)}
    ${F(t('amount') + ' *', inp('amount', '', 'type="number" min="0.01" step="any" required inputmode="decimal"'))}${F(t('method'), sel('method', pmOpts(), 'CASH'))}${F(t('date'), inp('date', ymd(new Date()), 'type="date" required'))}
    ${F(t('description'), inp('description', ''), 'full')}${F(t('notes'), inp('notes', ''), 'full')}</div><p class="hint">${t('expenseHint')}</p>
    <div class="mfoot"><button type="button" class="btn ghost" id="ecx">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`);
  $('#ecx', m).onclick = closeModal;
  $('#ef', m).onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); await withBusy($('button[type=submit]', e.target), async () => {
    const cat = EXP_CATS.find(c => c.toLowerCase() === v.category.toLowerCase() || t('ec_' + c).toLowerCase() === v.category.toLowerCase()) || v.category;
    await rpc('record_expense', { p_category: cat, p_description: v.description || null, p_amount: round2(v.amount), p_method: v.method, p_date: v.date, p_notes: v.notes || null });
    closeModal(); toast(t('saved')); done(); }); };
}

/* =====================================================================
   BUDGETS
   ===================================================================== */
function periodDefaults(type) {
  const s = new Date(); s.setHours(0, 0, 0, 0); let a, b;
  if (type === 'WEEKLY') { a = addDays(s, -((s.getDay() + 6) % 7)); b = addDays(a, 6); }
  else if (type === 'YEARLY') { a = new Date(s.getFullYear(), 0, 1); b = new Date(s.getFullYear(), 11, 31); }
  else { a = new Date(s.getFullYear(), s.getMonth(), 1); b = new Date(s.getFullYear(), s.getMonth() + 1, 0); }
  return { start: ymd(a), end: ymd(b) };
}
VIEWS.budgets = async function () {
  const budgets = await sb.from('budgets').select('*').order('start_date', { ascending: false }).then(must);
  let exps = [];
  if (budgets.length) {
    const lo = budgets.reduce((m, b) => b.start_date < m ? b.start_date : m, budgets[0].start_date), hi = budgets.reduce((m, b) => b.end_date > m ? b.end_date : m, budgets[0].end_date);
    exps = await fetchAll(() => sb.from('expenses').select('category,amount,expense_date').gte('expense_date', lo).lte('expense_date', hi).order('expense_date').order('id'));
  }
  const today = ymd(new Date());
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_budgets')}</h2><button class="btn" id="bAdd">+ ${t('addBudget')}</button></div>
    <div class="bcards">${budgets.length ? budgets.map(b => {
      const spent = exps.filter(e => e.category.toLowerCase() === b.category.toLowerCase() && e.expense_date >= b.start_date && e.expense_date <= b.end_date).reduce((s, e) => s + num(e.amount), 0);
      const pct = num(b.budgeted_amount) > 0 ? spent / num(b.budgeted_amount) * 100 : 0, cls = pct >= 100 ? 'r' : pct >= 90 ? 'o' : pct >= 75 ? 'y' : '';
      const active = today >= b.start_date && today <= b.end_date;
      return `<div class="card lift"><div class="toolbar" style="justify-content:space-between"><b>${esc(expCatLabel(b.category))}</b>${badge(active ? 'ok' : 'info', t('bp_' + b.period_type))}</div>
        <p class="hint">${fd(b.start_date)} → ${fd(b.end_date)}</p><div class="prog" role="progressbar" aria-valuenow="${Math.min(100, pct).toFixed(0)}" aria-valuemin="0" aria-valuemax="100"><i class="${cls}" style="width:${Math.min(100, pct)}%"></i></div>
        <p style="margin:8px 0 0"><b>${money(spent)}</b> / ${money(b.budgeted_amount)} · <b class="${pct >= 100 ? 'out' : pct >= 75 ? 'low' : 'ok'}">${pct.toFixed(0)}%</b></p>
        ${pct >= 100 ? `<p class="out">⚠ ${t('overBudget')}: ${money(spent - num(b.budgeted_amount))}</p>` : pct >= 75 ? `<p class="low">⚠ ${t('nearBudget')}</p>` : `<p class="hint">${t('remaining')}: ${money(num(b.budgeted_amount) - spent)}</p>`}
        <div class="actions"><button class="btn ghost sm" data-ed="${b.id}">✏️</button><button class="btn ghost sm" data-del="${b.id}">🗑</button></div></div>`; }).join('') : `<div class="empty card">${t('noBudgets')}</div>`}</div>`;
  $('#bAdd').onclick = () => budgetModal();
  $$('[data-ed]').forEach(b => b.onclick = () => budgetModal(budgets.find(x => x.id === b.dataset.ed)));
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm(t('confirmDelete'))) return; await withBusy(b, async () => { must(await sb.from('budgets').delete().eq('id', b.dataset.del).select('id')); VIEWS.budgets(); }); });
};
function budgetModal(b) {
  const isNew = !b, d = periodDefaults('MONTHLY'); b = b || { period_type: 'MONTHLY', start_date: d.start, end_date: d.end };
  const m = openModal(isNew ? t('addBudget') : t('editBudget'), `<form id="bf"><div class="fgrid">${F(t('category') + ' *', `<input name="category" list="bcl" required value="${esc(b.category || '')}"><datalist id="bcl">${EXP_CATS.map(c => `<option value="${c}">${esc(t('ec_' + c))}</option>`).join('')}</datalist>`)}
    ${F(t('budgetAmount') + ' *', inp('budgeted_amount', b.budgeted_amount || '', 'type="number" min="1" step="any" required'))}${F(t('period'), sel('period_type', ['WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'].map(p => [p, t('bp_' + p)]), b.period_type))}
    ${F(t('from'), inp('start_date', b.start_date, 'type="date" required'))}${F(t('to'), inp('end_date', b.end_date, 'type="date" required'))}</div>
    <p class="hint">${t('budgetHint')}</p><div class="mfoot"><button type="button" class="btn ghost" id="bcx">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`);
  const f = $('#bf', m); $('#bcx', m).onclick = closeModal;
  f.period_type.onchange = () => { if (f.period_type.value !== 'CUSTOM') { const x = periodDefaults(f.period_type.value); f.start_date.value = x.start; f.end_date.value = x.end; } };
  f.onsubmit = async e => { e.preventDefault(); const v = formVals(f); await withBusy($('button[type=submit]', f), async () => {
    if (v.end_date < v.start_date) throw new Error(t('badDates'));
    const cat = EXP_CATS.find(c => c.toLowerCase() === v.category.toLowerCase() || t('ec_' + c).toLowerCase() === v.category.toLowerCase()) || v.category;
    const row = { category: cat, budgeted_amount: num(v.budgeted_amount), period_type: v.period_type, start_date: v.start_date, end_date: v.end_date };
    if (isNew) must(await sb.from('budgets').insert(row).select('id')); else must(await sb.from('budgets').update(row).eq('id', b.id).select('id'));
    closeModal(); toast(t('saved')); VIEWS.budgets(); }); };
}

/* =====================================================================
   FINANCE: P&L + CASH FLOW
   ===================================================================== */
function pnlHtml(s, expCats) {
  const row = (label, v, cls = '', sub = false) => `<tr class="${cls} ${sub ? 'sub' : ''}"><td>${label}</td><td class="num">${money(v)}</td></tr>`;
  const gm = s.revenue > 0 ? (s.gross_profit / s.revenue * 100).toFixed(1) : '0.0', nm = s.revenue > 0 ? (s.net_profit / s.revenue * 100).toFixed(1) : '0.0';
  return `<div class="tw"><table class="pnl" style="min-width:0"><tbody>
    ${row(t('salesAfterDiscount'), s.revenue_gross)}${row('− ' + t('refunds'), s.refunds, '', true)}${row(t('netRevenue'), s.revenue, 'key')}
    ${row('− ' + t('cogs'), s.cogs)}${row(`${t('grossProfit')} (${gm}%)`, s.gross_profit, 'key')}
    ${row('− ' + t('opex'), s.expenses)}${(expCats || []).map(([c, v]) => row(esc(expCatLabel(c)), v, '', true)).join('')}
    ${row(`${t('netProfit')} (${nm}%)`, s.net_profit, 'key')}</tbody></table></div>
    <div class="kpis" style="margin-top:14px"><div class="kpi"><small>${t('salesWord')}</small><b>${s.sales_count}</b><em>${t('avgSale')}: ${money(s.sales_count ? s.revenue_gross / s.sales_count : 0)}</em></div><div class="kpi"><small>${t('discounts')}</small><b>${money(s.discounts)}</b></div><div class="kpi"><small>${t('taxCollected')}</small><b>${money(s.tax)}</b></div><div class="kpi"><small>${t('cashIn')} / ${t('cashOut')}</small><b>${moneyK(s.cash_in)} / ${moneyK(s.cash_out)}</b></div></div>`;
}
async function loadPnl(r) {
  const [s, exps] = await Promise.all([rpc('get_financial_summary', { p_from: r.from, p_to: r.to }), fetchAll(() => sb.from('expenses').select('category,amount').gte('expense_date', r.fromD).lte('expense_date', r.toD).order('id'))]);
  const by = {}; exps.forEach(e => { by[e.category] = (by[e.category] || 0) + num(e.amount); });
  return { s, cats: Object.entries(by).sort((a, b) => b[1] - a[1]) };
}
const pnlRows = (s, cats) => [[t('salesAfterDiscount'), s.revenue_gross], [t('refunds'), s.refunds], [t('netRevenue'), s.revenue], [t('cogs'), s.cogs], [t('grossProfit'), s.gross_profit], [t('opex'), s.expenses], ...cats.map(([c, v]) => ['  ' + expCatLabel(c), v]), [t('netProfit'), s.net_profit]].map(([line, amount]) => ({ line, amount }));

VIEWS.finance = async function () {
  const R = getRange('fin', 'month'); let tab = 'pnl';
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_finance')}</h2>${rangeHtml('fin')}</div>
    <div class="tabs"><button class="tab on" data-t="pnl">${t('pnl')}</button><button class="tab" data-t="cash">${t('cashFlow')}</button></div><div id="fbody"><div class="loading">…</div></div>`;
  wireRange('fin', load); $$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; $$('.tab').forEach(x => x.classList.toggle('on', x === b)); load(); });
  await load();
  async function load() {
    const alive = live(), r = rangeDates(R);
    if (tab === 'pnl') {
      const { s, cats } = await loadPnl(r); if (!alive()) return;
      $('#fbody').innerHTML = `<div class="card"><div class="toolbar" style="justify-content:space-between"><b>${fd(r.fromD)} → ${fd(r.toD)}</b><button class="btn ghost sm" id="fx">⬇ ${t('exportCsv')}</button></div>${pnlHtml(s, cats)}</div>`;
      $('#fx').onclick = () => exportCSV('profit_and_loss', pnlRows(s, cats));
    } else {
      const [open, rows] = await Promise.all([rpc('get_cash_opening', { p_before: r.from }), fetchAll(() => sb.from('financial_transactions').select('*').gte('transaction_date', r.from).lt('transaction_date', r.to).order('transaction_date').order('id'))]);
      if (!alive()) return;
      let run = num(open); const led = rows.map(x => { run += x.flow_type === 'IN' ? num(x.amount) : -num(x.amount); return { ...x, run }; });
      const inn = rows.filter(x => x.flow_type === 'IN').reduce((s, x) => s + num(x.amount), 0), out = rows.filter(x => x.flow_type === 'OUT').reduce((s, x) => s + num(x.amount), 0);
      $('#fbody').innerHTML = `<div class="kpis"><div class="kpi k4"><small>${t('openingBalance')}</small><b>${moneyK(open)}</b></div><div class="kpi k2"><small>${t('cashIn')}</small><b>${moneyK(inn)}</b></div><div class="kpi k3"><small>${t('cashOut')}</small><b>${moneyK(out)}</b></div><div class="kpi k5"><small>${t('closingBalance')}</small><b>${moneyK(run)}</b></div></div>
        <div class="card"><div class="toolbar" style="justify-content:flex-end"><button class="btn ghost sm" id="fx">⬇ ${t('exportCsv')}</button></div>${tbl([t('date'), t('type'), t('description'), t('method'), { h: t('in'), c: 'num' }, { h: t('out'), c: 'num' }, { h: t('balance'), c: 'num' }],
          led.slice(-500).reverse().map(x => `<tr><td class="nowrap">${fdt(x.transaction_date)}</td><td>${t('tt_' + x.transaction_type)}</td><td>${esc(x.description || '')}</td><td>${x.payment_method ? pmLabel(x.payment_method) : ''}</td><td class="num ok">${x.flow_type === 'IN' ? fmt(x.amount) : ''}</td><td class="num out">${x.flow_type === 'OUT' ? fmt(x.amount) : ''}</td><td class="num">${fmt(x.run)}</td></tr>`))}${led.length > 500 ? `<p class="hint">${t('showingLast')} 500 / ${led.length}</p>` : ''}</div>`;
      $('#fx').onclick = () => exportCSV('cash_flow', led.map(x => ({ date: x.transaction_date, type: x.transaction_type, description: x.description, method: x.payment_method, flow: x.flow_type, amount: x.amount, running_balance: x.run })));
    }
  }
};

/* =====================================================================
   REPORTS
   ===================================================================== */
VIEWS.reports = async function () {
  const R = getRange('rep', 'month'); let tab = 'sales';
  const tabs = ['sales', 'inventory', 'expenses', 'pnl', 'performance', 'closing'];
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_reports')}</h2><div id="rrange">${rangeHtml('rep')}</div></div>
    <div class="tabs">${tabs.map(k => `<button class="tab ${k === tab ? 'on' : ''}" data-t="${k}">${t('rep_' + k)}</button>`).join('')}</div><div id="rbody"><div class="loading">…</div></div>`;
  wireRange('rep', load);
  $$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; $$('.tab').forEach(x => x.classList.toggle('on', x === b)); $('#rrange').hidden = tab === 'inventory'; load(); });
  await load();
  async function load() {
    const alive = live(), r = rangeDates(R), body = $('#rbody'); body.innerHTML = '<div class="loading">…</div>';
    try {
      if (tab === 'sales') {
        const [rows, pay] = await Promise.all([fetchAll(() => sb.from('sales').select('receipt_number,created_at,total_amount,discount_amount,tax_amount,net_total,payment_status,is_voided,customers(name),profiles(full_name)').gte('created_at', r.from).lt('created_at', r.to).order('created_at', { ascending: false }).order('id')), rpc('get_payment_breakdown', { p_from: r.from, p_to: r.to })]);
        if (!alive()) return;
        const ok = rows.filter(s => !s.is_voided), tot = ok.reduce((a, s) => a + num(s.net_total), 0), disc = ok.reduce((a, s) => a + num(s.discount_amount), 0), byC = {};
        ok.forEach(s => { const k = s.profiles?.full_name || '—'; byC[k] = (byC[k] || 0) + num(s.net_total); });
        body.innerHTML = `<div class="kpis"><div class="kpi k1"><small>${t('salesWord')}</small><b>${ok.length}</b></div><div class="kpi k2"><small>${t('total')}</small><b>${moneyK(tot)}</b></div><div class="kpi k3"><small>${t('discounts')}</small><b>${moneyK(disc)}</b></div><div class="kpi k4"><small>${t('voided')}</small><b>${rows.length - ok.length}</b></div></div>
          <div class="two"><div class="card"><b>${t('byPayment')}</b>${tbl([t('method'), { h: t('in'), c: 'num' }, { h: t('out'), c: 'num' }], [...new Set(pay.map(p => p.method))].map(m => `<tr><td>${pmLabel(m)}</td><td class="num">${fmt(pay.find(p => p.method === m && p.flow === 'IN')?.total || 0)}</td><td class="num">${fmt(pay.find(p => p.method === m && p.flow === 'OUT')?.total || 0)}</td></tr>`))}</div>
          <div class="card"><b>${t('byCashier')}</b>${tbl([t('cashier'), { h: t('total'), c: 'num' }], Object.entries(byC).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${fmt(v)}</td></tr>`))}</div></div>
          <div class="card"><div class="toolbar" style="justify-content:flex-end"><button class="btn ghost sm" id="rx">⬇ ${t('exportCsv')}</button></div>${tbl([t('receipt'), t('date'), t('customer'), t('cashier'), { h: t('total'), c: 'num' }, t('status')], rows.slice(0, 200).map(s => `<tr class="${s.is_voided ? 'void' : ''}"><td>${esc(s.receipt_number)}</td><td class="nowrap">${fdt(s.created_at)}</td><td>${esc(s.customers?.name || t('walkIn'))}</td><td>${esc(s.profiles?.full_name || '')}</td><td class="num">${fmt(s.net_total)}</td><td>${s.is_voided ? t('voided') : t('st_' + s.payment_status)}</td></tr>`))}${rows.length > 200 ? `<p class="hint">${t('showingFirst')} 200 / ${rows.length} — ${t('exportForAll')}</p>` : ''}</div>`;
        $('#rx').onclick = () => exportCSV('sales', rows.map(s => ({ receipt: s.receipt_number, date: s.created_at, customer: s.customers?.name || '', cashier: s.profiles?.full_name || '', subtotal: s.total_amount, discount: s.discount_amount, tax: s.tax_amount, net_total: s.net_total, status: s.is_voided ? 'VOID' : s.payment_status })));
      } else if (tab === 'inventory') {
        const prods = await fetchAll(() => sb.from('products').select('name,sku,current_stock,minimum_stock,buying_price,selling_price,unit,active,categories(name)').order('name').order('id')); if (!alive()) return;
        let onlyLow = false; const draw_ = () => {
          const l = prods.filter(p => p.active && (!onlyLow || p.current_stock <= p.minimum_stock)), cost = l.reduce((s, p) => s + p.current_stock * num(p.buying_price), 0), retail = l.reduce((s, p) => s + p.current_stock * num(p.selling_price), 0);
          body.innerHTML = `<div class="kpis"><div class="kpi k4"><small>${t('products')}</small><b>${l.length}</b></div><div class="kpi k5"><small>${t('stockValue')}</small><b>${moneyK(cost)}</b></div><div class="kpi k2"><small>${t('retailValue')}</small><b>${moneyK(retail)}</b></div><div class="kpi k1"><small>${t('potentialProfit')}</small><b>${moneyK(retail - cost)}</b></div></div>
            <div class="card"><div class="toolbar" style="justify-content:space-between"><label class="check"><input type="checkbox" id="lowonly" ${onlyLow ? 'checked' : ''}> ${t('onlyLow')}</label><button class="btn ghost sm" id="rx">⬇ ${t('exportCsv')}</button></div>
            ${tbl([t('name'), t('category'), { h: t('stock'), c: 'num' }, { h: t('minimum'), c: 'num' }, { h: t('buyPrice'), c: 'num' }, { h: t('stockValue'), c: 'num' }, t('status')], l.slice(0, 300).map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.categories?.name || '—')}</td><td class="num">${p.current_stock}</td><td class="num">${p.minimum_stock}</td><td class="num">${fmt(p.buying_price)}</td><td class="num">${fmt(p.current_stock * num(p.buying_price))}</td><td>${stockBadge({ ...p, active: true })}</td></tr>`))}</div>`;
          $('#lowonly').onchange = e => { onlyLow = e.target.checked; draw_(); };
          $('#rx').onclick = () => exportCSV('inventory', l.map(p => ({ name: p.name, sku: p.sku, category: p.categories?.name || '', unit: p.unit, stock: p.current_stock, minimum_stock: p.minimum_stock, buying_price: p.buying_price, selling_price: p.selling_price, stock_value_cost: p.current_stock * num(p.buying_price), stock_value_retail: p.current_stock * num(p.selling_price) })));
        }; draw_();
      } else if (tab === 'expenses') {
        const rows = await fetchAll(() => sb.from('expenses').select('*').gte('expense_date', r.fromD).lte('expense_date', r.toD).order('expense_date', { ascending: false }).order('id')); if (!alive()) return;
        const by = {}; rows.forEach(e => { by[e.category] = (by[e.category] || 0) + num(e.amount); });
        body.innerHTML = `<div class="two"><div class="card"><b>${t('byCategory')}</b>${tbl([t('category'), { h: t('amount'), c: 'num' }], Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr><td>${esc(expCatLabel(c))}</td><td class="num">${fmt(v)}</td></tr>`).concat(`<tr class="total"><td>${t('total')}</td><td class="num">${fmt(rows.reduce((s, e) => s + num(e.amount), 0))}</td></tr>`))}</div>
          <div class="card"><div class="toolbar" style="justify-content:flex-end"><button class="btn ghost sm" id="rx">⬇ ${t('exportCsv')}</button></div>${tbl([t('date'), t('category'), t('description'), { h: t('amount'), c: 'num' }], rows.slice(0, 200).map(e => `<tr><td>${fd(e.expense_date)}</td><td>${esc(expCatLabel(e.category))}</td><td>${esc(e.description || '')}</td><td class="num">${fmt(e.amount)}</td></tr>`))}</div></div>`;
        $('#rx').onclick = () => exportCSV('expenses', rows.map(e => ({ number: e.expense_number, date: e.expense_date, category: e.category, description: e.description, amount: e.amount, method: e.payment_method })));
      } else if (tab === 'pnl') {
        const { s, cats } = await loadPnl(r); if (!alive()) return;
        body.innerHTML = `<div class="card"><div class="toolbar" style="justify-content:space-between"><b>${fd(r.fromD)} → ${fd(r.toD)}</b><button class="btn ghost sm" id="rx">⬇ ${t('exportCsv')}</button></div>${pnlHtml(s, cats)}</div>`;
        $('#rx').onclick = () => exportCSV('profit_and_loss', pnlRows(s, cats));
      } else if (tab === 'performance') {
        const [top, prods] = await Promise.all([rpc('get_top_products', { p_from: r.from, p_to: r.to, p_limit: 100000 }), fetchAll(() => sb.from('products').select('id,name,current_stock,buying_price').eq('active', true).order('id'))]); if (!alive()) return;
        const sold = new Set(top.map(x => x.product_id)), slow = prods.filter(p => p.current_stock > 0 && !sold.has(p.id)).sort((a, b) => b.current_stock * num(b.buying_price) - a.current_stock * num(a.buying_price));
        body.innerHTML = `<div class="two"><div class="card"><b>🏆 ${t('bestSellers')}</b>${tbl([t('product'), { h: t('qty'), c: 'num' }, { h: t('revenue'), c: 'num' }], top.slice(0, 20).map(p => `<tr><td>${esc(p.name)}</td><td class="num">${p.qty}</td><td class="num">${fmt(p.revenue)}</td></tr>`))}</div>
          <div class="card"><b>🐌 ${t('slowMovers')}</b><p class="hint">${t('slowHint')}</p>${tbl([t('product'), { h: t('stock'), c: 'num' }, { h: t('tiedUp'), c: 'num' }], slow.slice(0, 20).map(p => `<tr><td>${esc(p.name)}</td><td class="num">${p.current_stock}</td><td class="num">${fmt(p.current_stock * num(p.buying_price))}</td></tr>`))}</div></div>`;
      } else if (tab === 'closing') closingReport(body, alive);
    } catch (e) { fail(e); body.innerHTML = `<div class="card"><p class="err">${esc(e.message || e)}</p></div>`; }
  }
};
async function closingReport(body, alive) {
  const day = getRange('close', 'today'); if (!day.set) { day.set = true; day.from = ymd(new Date()); }
  body.innerHTML = `<div class="card"><div class="toolbar">${F(t('date'), `<input type="date" id="cday" value="${day.from}">`)}</div><div id="cbody2" style="margin-top:12px"><div class="loading">…</div></div></div>`;
  const run = async () => {
    const r = rangeDates({ key: 'custom', from: day.from, to: day.from });
    const [pay, s] = await Promise.all([rpc('get_payment_breakdown', { p_from: r.from, p_to: r.to }), rpc('get_financial_summary', { p_from: r.from, p_to: r.to })]); if (!alive()) return;
    const get = (m, f) => num(pay.find(p => p.method === m && p.flow === f)?.total), methods = [...new Set(pay.map(p => p.method))];
    const expected = get('CASH', 'IN') - get('CASH', 'OUT');
    $('#cbody2').innerHTML = `<div class="kpis"><div class="kpi k1"><small>${t('salesWord')}</small><b>${s.sales_count}</b></div><div class="kpi k2"><small>${t('revenue')}</small><b>${moneyK(s.revenue)}</b></div><div class="kpi k3"><small>${t('expenses')}</small><b>${moneyK(s.expenses)}</b></div><div class="kpi k5"><small>${t('netProfit')}</small><b>${moneyK(s.net_profit)}</b></div></div>
      ${tbl([t('method'), { h: t('in'), c: 'num' }, { h: t('out'), c: 'num' }, { h: t('net'), c: 'num' }], methods.map(m => `<tr><td>${pmLabel(m)}</td><td class="num">${fmt(get(m, 'IN'))}</td><td class="num">${fmt(get(m, 'OUT'))}</td><td class="num">${fmt(get(m, 'IN') - get(m, 'OUT'))}</td></tr>`))}
      <div class="fgrid" style="margin-top:14px"><div class="f"><span>${t('expectedCash')}</span><b style="font-size:1.4rem">${money(expected)}</b></div>${F(t('countedCash'), '<input type="number" id="counted" min="0" step="any" inputmode="decimal">')}<div class="f"><span>${t('difference')}</span><b id="cdiff" style="font-size:1.4rem">—</b></div></div>`;
    $('#counted').oninput = e => { const v = e.target.value; const d = round2(num(v) - expected); $('#cdiff').textContent = v === '' ? '—' : (d > 0 ? '+' : '') + money(d); $('#cdiff').className = d === 0 ? 'ok' : d < 0 ? 'out' : 'low'; };
  };
  $('#cday').onchange = e => { day.from = e.target.value || ymd(new Date()); run().catch(fail); };
  await run();
}

/* =====================================================================
   AUDIT TRAIL
   ===================================================================== */
VIEWS.audit = async function () {
  const R = getRange('audit', 'week'); let mod = '', q = '', rows = [], page = 1;
  const MODS = ['', 'sales', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'budgets', 'categories', 'business_settings'];
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_audit')}</h2>${rangeHtml('audit')}</div><div class="card"><div class="toolbar"><input id="aq" class="grow" type="search" placeholder="${esc(t('search'))}"><select id="amod">${MODS.map(m => `<option value="${m}">${m ? t('mod_' + m) : t('allModules')}</option>`).join('')}</select><button class="btn ghost" id="ax">⬇ ${t('exportCsv')}</button></div><div id="atab" style="margin-top:12px"></div><div class="pager" id="apager"></div></div>`;
  wireRange('audit', load);
  $('#aq').oninput = e => { q = e.target.value.toLowerCase(); page = 1; draw_(); }; $('#amod').onchange = e => { mod = e.target.value; load(); };
  $('#ax').onclick = () => exportCSV('audit_log', filt().map(a => ({ date: a.created_at, user: a.profiles?.full_name || '', action: a.action, module: a.module, record_id: a.record_id, previous: a.previous_state, new: a.new_state })));
  await load();
  async function load() { const alive = live(), r = rangeDates(R); rows = await fetchAll(() => { let b = sb.from('audit_logs').select('*,profiles(full_name)').gte('created_at', r.from).lt('created_at', r.to); if (mod) b = b.eq('module', mod); return b.order('created_at', { ascending: false }).order('id'); }); if (alive()) { page = 1; draw_(); } }
  function filt() { return rows.filter(a => !q || `${a.profiles?.full_name || ''} ${a.action} ${a.module} ${JSON.stringify(a.new_state || '')}`.toLowerCase().includes(q)); }
  function draw_() {
    const l = filt(), size = 25; $('#atab').innerHTML = tbl([t('date'), t('user'), t('action'), t('module'), t('details')], l.slice((page - 1) * size, page * size).map((a, i) => `<tr><td class="nowrap">${fdt(a.created_at)}</td><td>${esc(a.profiles?.full_name || '—')}</td><td>${badge('info', a.action)}</td><td>${esc(t('mod_' + a.module))}</td><td><button class="btn ghost sm" data-i="${(page - 1) * size + i}">{ }</button></td></tr>`));
    $('#apager').innerHTML = pagerHtml(l.length, page, size); wirePager($('#apager'), p => { page = p; draw_(); });
    $$('[data-i]', $('#atab')).forEach(b => b.onclick = () => { const a = l[b.dataset.i]; openModal(`${esc(a.action)} · ${esc(a.module)}`, `${a.previous_state ? `<b>${t('before')}</b><pre class="json">${esc(JSON.stringify(a.previous_state, null, 2))}</pre>` : ''}${a.new_state ? `<b>${t('after')}</b><pre class="json">${esc(JSON.stringify(a.new_state, null, 2))}</pre>` : ''}`, { wide: true }); });
  }
};

/* =====================================================================
   SETTINGS (business, my profile, backup)
   ===================================================================== */
const BACKUP_TABLES = ['products', 'categories', 'customers', 'suppliers', 'sales', 'sale_items', 'sale_payments', 'sales_returns', 'sales_return_items', 'purchases', 'purchase_items', 'stock_movements', 'expenses', 'budgets', 'financial_transactions'];
async function uploadImage(bucket, path, file) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(t('imgType'));
  if (file.size > 2 * 1024 * 1024) throw new Error(t('imgSize'));
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
  if (error) throw error;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
VIEWS.settings = async function () {
  const s = SET;
  $('#view').innerHTML = `<div class="pagehead"><h2>${t('nav_settings')}</h2></div>
  <div class="two"><div class="card"><h3>🏪 ${t('business')}</h3><form id="setf"><div class="fgrid" style="margin-top:12px">
    ${F(t('businessName'), inp('business_name', s.business_name || '', 'required maxlength="80"'), 'full')}${F(t('phone'), inp('phone', s.phone || ''))}${F('Email', inp('email', s.email || '', 'type="email"'))}${F(t('address'), inp('address', s.address || ''), 'full')}${F('TIN/VAT', inp('tin_vat', s.tin_vat || ''))}
    ${F(t('currency'), inp('currency', s.currency || 'TZS', 'maxlength="6" required'))}${F(t('taxRate') + ' %', inp('default_tax_rate', s.default_tax_rate ?? 18, 'type="number" min="0" max="100" step="any"'))}
    ${F(t('receiptFooter'), `<textarea name="receipt_footer" maxlength="200">${esc(s.receipt_footer || '')}</textarea>`, 'full')}
    <div class="f full"><span>${t('logo')}</span><div class="toolbar"><div class="logo sm" id="slogo">${s.logo_url ? `<img src="${esc(s.logo_url)}" alt="">` : 'M'}</div><input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp"></div><small class="hint">${t('imgHint')}</small></div></div>
    <div class="mfoot"><button class="btn" type="submit">${t('save')}</button></div></form></div>
  <div><div class="card"><h3>👤 ${t('myProfile')}</h3><form id="prof"><div class="fgrid" style="margin-top:12px">${F(t('name'), inp('full_name', ME.full_name || '', 'required maxlength="80"'), 'full')}
    <div class="f full"><span>${t('avatar')}</span><div class="toolbar"><div class="av" id="savatar">${ME.avatar_url ? `<img src="${esc(ME.avatar_url)}" alt="">` : esc((ME.full_name || '?')[0].toUpperCase())}</div><input type="file" id="avFile" accept="image/png,image/jpeg,image/webp"></div></div></div>
    <div class="mfoot"><button class="btn" type="submit">${t('save')}</button></div></form></div>
  <div class="card" style="margin-top:18px"><h3>💾 ${t('backup')}</h3><p class="hint">${t('backupHint')}</p><div class="toolbar"><button class="btn" id="bkAll">⬇ ${t('exportAll')}</button></div><div class="chips" style="margin-top:10px">${BACKUP_TABLES.map(x => `<button class="chip" data-bk="${x}">${x}</button>`).join('')}</div><p class="hint" id="bkmsg"></p></div></div></div>`;
  $('#setf').onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); await withBusy($('button[type=submit]', e.target), async () => {
    const row = { business_name: v.business_name, phone: empty2null(v.phone), email: empty2null(v.email), address: empty2null(v.address), tin_vat: empty2null(v.tin_vat), currency: v.currency.toUpperCase(), default_tax_rate: Math.min(100, Math.max(0, num(v.default_tax_rate))), receipt_footer: empty2null(v.receipt_footer) };
    must(await sb.from('business_settings').update(row).eq('id', 1).select('id')); Object.assign(SET, row); applyBranding(); toast(t('saved')); }); };
  $('#logoFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; await withBusy(e.target, async () => {
    const url = await uploadImage('branding', `logo-${Date.now()}.${f.type.split('/')[1].replace('jpeg', 'jpg')}`, f);
    must(await sb.from('business_settings').update({ logo_url: url }).eq('id', 1).select('id')); SET.logo_url = url; applyBranding(); $('#slogo').innerHTML = `<img src="${esc(url)}" alt="">`; toast(t('saved')); }); };
  $('#prof').onsubmit = async e => { e.preventDefault(); await withBusy($('button[type=submit]', e.target), async () => {
    const name = formVals(e.target).full_name; must(await sb.from('profiles').update({ full_name: name }).eq('id', ME.id).select('id')); ME.full_name = name; applyUserChip(); toast(t('saved')); }); };
  $('#avFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; await withBusy(e.target, async () => {
    const url = await uploadImage('avatars', `${ME.id}/avatar-${Date.now()}.${f.type.split('/')[1].replace('jpeg', 'jpg')}`, f);
    must(await sb.from('profiles').update({ avatar_url: url }).eq('id', ME.id).select('id')); ME.avatar_url = url; applyUserChip(); $('#savatar').innerHTML = `<img src="${esc(url)}" alt="">`; toast(t('saved')); }); };
  const dump = async name => { const rows = await fetchAll(() => sb.from(name).select('*').order('id')); exportCSV(name, rows.length ? rows : null); return rows.length; };
  $$('[data-bk]').forEach(b => b.onclick = () => withBusy(b, async () => { const n = await dump(b.dataset.bk); $('#bkmsg').textContent = `${b.dataset.bk}: ${n} ${t('rows')}`; }));
  $('#bkAll').onclick = e => withBusy(e.target, async () => { let tot = 0; for (const name of BACKUP_TABLES) { tot += await dump(name); await new Promise(r => setTimeout(r, 350)); } $('#bkmsg').textContent = `${t('backupDone')}: ${tot} ${t('rows')}`; });
};

/* =====================================================================
   BOOT
   ===================================================================== */
function onSignedOut() { ME = null; $('#shell').hidden = true; $('#login').hidden = false; applyLoginBrand(); closeModal(); }
async function loadSettings() {
  const { data } = await sb.from('business_settings').select('*').eq('id', 1).maybeSingle();
  if (data) Object.keys(data).forEach(k => { if (data[k] !== null) SET[k] = data[k]; else if (k === 'logo_url') SET.logo_url = null; });
}
async function showApp() {
  if (!sb) { $('#loginErr').textContent = 'Supabase library failed to load (check internet / CDN).'; return; }
  if (!(await loadProfile())) {
    $('#login').hidden = false; $('#shell').hidden = true; $('#loginErr').textContent = PROFILE_ERR;
    if (PROFILE_ERR) { try { await sb.auth.signOut(); } catch (e) { /* ignore */ } } return;
  }
  await loadSettings();
  $('#login').hidden = true; $('#shell').hidden = false;
  applyBranding(); applyUserChip(); buildNav(); await route();
}
function setLang(l) { updateLanguage(l); $('#lang').value = l; $('#loginLang').value = l; if (ME) { buildNav(); applyUserChip(); route(); } }
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(); applyLoginBrand(); $('#lang').value = LANG; $('#loginLang').value = LANG; updateLanguage(LANG);
  try { if (localStorage.getItem('collapsed') === '1') document.body.classList.add('collapsed'); } catch (e) { /* ignore */ }
  $('#loginForm').onsubmit = async e => {
    e.preventDefault(); const b = $('#loginBtn'); b.disabled = true; $('#loginErr').textContent = '';
    try {
      if (!sb) throw new Error('Supabase library failed to load (check internet / CDN).');
      const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
      if (error) { $('#loginErr').textContent = error.message; return; }
      await showApp();
    } catch (err) { $('#loginErr').textContent = err.message; } finally { b.disabled = false; }
  };
  $('#logout').onclick = async () => { try { await sb.auth.signOut(); } finally { onSignedOut(); } };
  $('#menuBtn').onclick = () => document.body.classList.toggle('drawer');
  $('#backdrop').onclick = () => document.body.classList.remove('drawer');
  $('#nav').addEventListener('click', () => document.body.classList.remove('drawer'));
  $('#collapseBtn').onclick = () => { const c = document.body.classList.toggle('collapsed'); try { localStorage.setItem('collapsed', c ? '1' : '0'); } catch (e) { /* ignore */ } };
  $('#lang').onchange = e => setLang(e.target.value); $('#loginLang').onchange = e => setLang(e.target.value);
  $('#theme').onchange = e => { try { localStorage.setItem('theme', e.target.value); } catch (x) { /* ignore */ } applyTheme(); };
  $('#accent').onchange = e => { try { localStorage.setItem('accent', e.target.value); } catch (x) { /* ignore */ } applyTheme(); };
  window.addEventListener('hashchange', route);
  showApp();
});
