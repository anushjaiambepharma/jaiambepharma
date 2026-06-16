/* ============================================================
   JAI AMBE PHARMA — admin.js v7  AI-POWERED CRM 2026
   Features: AI Insights, Demand Forecasting, Inventory Health,
   Supplier Management, Returns, Audit Log, Smart Alerts
   ============================================================ */

let adminOrders  = [];
let adminParties = [];
let adminStats   = {};
let _charts      = {};
let _auditLog    = JSON.parse(localStorage.getItem('jap_audit_log') || '[]');
let _suppliers   = JSON.parse(localStorage.getItem('jap_suppliers') || '[]');
let _returns     = JSON.parse(localStorage.getItem('jap_returns') || '[]');
let _thresholds  = JSON.parse(localStorage.getItem('jap_thresholds') || '{"reorder":3,"slow":2}');
let _hiddenProducts = JSON.parse(localStorage.getItem('jap_hidden_products') || '[]');

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof clearAppDataCachesOnLoad === 'function') clearAppDataCachesOnLoad();
  let url = setSheetUrl(localStorage.getItem(LS.SHEET_URL) || SHEET_URL_DEFAULT);

  // ── Pull remote CONFIG so admin always uses the current Web App URL.
  //    If CONFIG points somewhere new, the helper switches URLs and wipes caches.
  try {
    const cfg = await fetchRemoteConfig({ silent:true });
    if (cfg && cfg.urlChanged) {
      url = localStorage.getItem(LS.SHEET_URL) || url;
      console.log('[JAP-ADMIN] Web App URL switched via CONFIG sheet to ' + url);
      try { toast('Web App URL updated from CONFIG sheet', 'ok'); } catch(e) {}
    }
  } catch(e) { /* best-effort */ }

  const urlEl = document.getElementById('sheet-url');
  if (urlEl) urlEl.value = url;
  const wa = document.getElementById('wa-num');
  if (wa) wa.value = localStorage.getItem(LS.WA_NUM) || DEFAULT_WA;
  // Thresholds
  const tr = document.getElementById('thresh-reorder');
  const ts = document.getElementById('thresh-slow');
  if (tr) tr.value = _thresholds.reorder;
  if (ts) ts.value = _thresholds.slow;

  updateConnBadge(url ? 'ok' : 'none');
  updateProdStats();

  // Restore session on refresh
  if (sessionStorage.getItem('jap_admin_logged_in') === '1') {
    document.getElementById('page-auth').style.display  = 'none';
    document.getElementById('page-admin').style.display = 'flex';
    auditLog('login', 'Session restored on page refresh');
    loadAll();
  }
});

/* ══════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════ */
async function doAdminLogin() {
  const pw = document.getElementById('admin-pw').value;
  const btn = document.getElementById('admin-login-btn');
  if (btn) { btn.disabled = true; btn.dataset._t = btn.textContent; btn.textContent = 'Signing in…'; }
  const res = await adminLogin(pw);   // server-side validation → admin token
  if (btn) { btn.disabled = false; if (btn.dataset._t) btn.textContent = btn.dataset._t; }
  if (!res || !res.ok) { toast((res && res.msg) || 'Incorrect password', 'err'); return; }
  sessionStorage.setItem('jap_admin_logged_in', '1');
  if (res.mustChangePassword) {
    setTimeout(function(){ toast('Security: please change the default admin password in Settings.', 'inf'); }, 1200);
  }
  document.getElementById('page-auth').style.display  = 'none';
  document.getElementById('page-admin').style.display = 'flex';
  auditLog('login', 'Admin logged in');
  loadAll();
}

async function changeAdminPassword() {
  const np = (document.getElementById('admin-newpw-input')?.value || '').trim();
  if (np.length < 6) { toast('Password must be at least 6 characters', 'err'); return; }
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) { toast('Configure sheet URL first', 'err'); return; }
  const btn = document.getElementById('change-pw-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const res = await apiPost(url, { action:'setAdminPassword', token: adminToken(), newPassword: np });
    if (res && res.ok) {
      toast('Admin password updated ✓', 'ok');
      const el = document.getElementById('admin-newpw-input'); if (el) el.value = '';
      auditLog('login', 'Admin password changed');
    } else { toast('Failed: '+((res&&res.msg)||'unknown'), 'err'); }
  } catch(e) { toast('Error: '+e, 'err'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🔑 Update Password'; } }
}

function doAdminLogout() {
  auditLog('login', 'Admin logged out');
  sessionStorage.removeItem('jap_admin_logged_in');
  localStorage.removeItem(LS.ADMIN_TOKEN);
  document.getElementById('page-admin').style.display = 'none';
  document.getElementById('page-auth').style.display  = 'flex';
  document.getElementById('admin-pw').value = '';
}

/* ══════════════════════════════════════════════════
   LOAD ALL DATA
══════════════════════════════════════════════════ */
async function loadAll() {
  startAdminAutoRefresh();
  // Load email quota for alerts
  try {
    const _qurl=localStorage.getItem('jap_sheet_url'); const _qtok=localStorage.getItem('jap_admin_token');
    if (_qurl) { const qr=await apiFetchTimeout(_qurl+'?action=emailQuota&token='+_qtok,5000); if(qr&&qr.ok)localStorage.setItem('jap_email_quota_remaining',String(qr.remaining||100)); }
  } catch(e){}
  // FIX #4: Supplier loading disabled
  // Load suppliers from backend
  try {
    const _surl=localStorage.getItem('jap_sheet_url'); const _stok=localStorage.getItem('jap_admin_token');
    if (_surl) { const sr=await apiFetchTimeout(_surl+'?action=getSuppliers&token='+_stok,8000); if(sr&&sr.ok&&Array.isArray(sr.suppliers)){ _suppliers=sr.suppliers; localStorage.setItem('jap_suppliers',JSON.stringify(_suppliers)); } }
  } catch(e){}
  updateProdStats();
  renderAuditLog();
  renderSuppliers();
  renderReturns();
  updateReturnStats();
  await Promise.all([loadOrders(), loadParties()]);
  loadStats();
}

// Auto-refresh orders every 90s, show badge on new orders
let _adminAutoRefresh = null;
let _lastOrderCount = 0;
function startAdminAutoRefresh() {
  if (_adminAutoRefresh) clearInterval(_adminAutoRefresh);
  _adminAutoRefresh = setInterval(async function() {
    const prev = adminOrders.length;
    await loadOrders();
    if (adminOrders.length > prev) {
      const diff = adminOrders.length - prev;
      document.title = '(' + diff + ' new) JAP Admin';
      toast(diff + ' new order(s) arrived!', 'ok');
      buildSmartAlerts();
    }
  }, 90000);
}

async function adminRefresh() {
  const btn = document.querySelector('.btn-refresh');
  if (btn) btn.textContent = '⏳';
  auditLog('sync', 'Manual refresh triggered');
  // Re-pull CONFIG so URL changes take effect immediately
  try { await fetchRemoteConfig({ silent:false }); } catch(e) {}
  await loadAll();
  buildCharts();
  if (btn) btn.innerHTML = '🔄 <span>Refresh</span>';
  toast('Refreshed ✓', 'ok');
}

/* ══════════════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════════════ */
function switchAdminTab(tab, el) {
  document.querySelectorAll('#page-admin .tab-pane').forEach(p => p.classList.remove('on'));
  const pane = document.getElementById('atab-' + tab);
  if (pane) pane.classList.add('on');
  document.querySelectorAll('.atnav-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (tab === 'dashboard')   { buildCharts(); buildSmartAlerts(); }
  if (tab === 'ai')          { buildAutoInsights(); }
  if (tab === 'analytics')   { buildAnalytics(); }
  if (tab === 'forecast')    { buildForecast(); }
  if (tab === 'inventory')   { buildInventory(); }
  if (tab === 'products')    { renderAdminProducts(''); }
  if (tab === 'settings')    { initShowStockToggle(); }
  if (tab === 'audit')       { renderAuditLog(); }
  // FIX #4: if (tab === 'suppliers') { renderSuppliers(); } // Suppliers disabled
  if (tab === 'returns')     { renderReturns(); updateReturnStats(); }
  if (tab === 'notifications') { loadCurrentNotif(); }
  if (tab === 'parties')     { updateCRMStats(); }
  if (tab === 'devices')     { loadDevices(); }
}

/* ══════════════════════════════════════════════════
   LOAD ORDERS
══════════════════════════════════════════════════ */
async function loadOrders() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) { setElHTML('orders-list', noSheetMsg()); setElHTML('recent-orders', noSheetMsg()); return; }
  setElHTML('orders-list',  loadingHTML('Loading orders…'));
  setElHTML('recent-orders', loadingHTML(''));
  try {
    const res = await apiFetchTimeout(url + '?action=orders&token=' + adminToken(), 20000);
    if (!res || !res.ok) { setElHTML('orders-list', errorHTML(res ? res.msg : 'No response')); return; }
    adminOrders = (res.orders || []).map(fixOrderFields);
    renderOrders(); renderRecent(); buildCharts(); buildSmartAlerts();
    updateStat('s-today', adminOrders.filter(o => isToday(o.date)).length);
    updateStat('s-total', adminOrders.length);
    auditLog('order', 'Loaded ' + adminOrders.length + ' orders');
  } catch(e) {
    setElHTML('orders-list', errorHTML('Failed: ' + (e.message||'').slice(0,80)));
  }
}

/* ══════════════════════════════════════════════════
   LOAD STATS
══════════════════════════════════════════════════ */
async function loadStats() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  try {
    const res = await apiFetchTimeout(url + '?action=stats&token=' + adminToken(), 20000);
    if (res && res.ok) {
      adminStats = res;
      buildCharts(); buildAnalytics(); buildForecast(); buildInventory(); buildAutoInsights();
    }
  } catch(e) {}
}

/* ══════════════════════════════════════════════════
   SMART ALERTS (Dashboard)
══════════════════════════════════════════════════ */
function buildSmartAlerts() {
  const el = document.getElementById('smart-alerts');
  if (!el || !adminOrders.length) return;
  const alerts = [];

  // Unprocessed new orders
  // New device alert
  const pendingDevices = adminDevices.filter(function(d){ return !d.approved || d.approved==='FALSE'; });
  if (pendingDevices.length > 0) {
    alerts.push({ type:'danger', icon:'<br>', title:pendingDevices.length+' Device(s) Awaiting Approval', body:'New device registration(s) pending. Go to Devices tab to approve.' });
  }
  // Email quota check
  const quotaKey = 'jap_email_quota_remaining';
  const quotaVal = parseInt(localStorage.getItem(quotaKey)||'100');
  if (quotaVal < 20) alerts.push({ type:'warn', icon:'@', title:'Email Quota Low ('+quotaVal+' remaining)', body:'Apps Script daily email limit is almost reached. Orders may not send email confirmations today.' });
  const newOrders = adminOrders.filter(o => (o.status||'New') === 'New');
  if (newOrders.length > 0) {
    alerts.push({ type:'danger', icon:'🚨', title:newOrders.length + ' New Orders Pending', body:'These orders are waiting to be processed. Mark them as Processing or Done.' });
  }

  // Inactive parties (30d)
  const recentMobiles = new Set(adminOrders.filter(o => isThisMonth(o.date)).map(o => o.partyMobile));
  const inactive = adminParties.filter(p => !recentMobiles.has(p.mobile));
  if (inactive.length > 0) {
    alerts.push({ type:'warn', icon:'😴', title:inactive.length + ' Parties Inactive This Month', body:'Consider reaching out to re-engage: ' + inactive.slice(0,3).map(p=>p.name).join(', ') + (inactive.length>3 ? '…' : '.') });
  }

  // Today's order count vs yesterday
  const todayCount = adminOrders.filter(o => isToday(o.date)).length;
  if (todayCount === 0) {
    alerts.push({ type:'info', icon:'📅', title:'No Orders Today Yet', body:'Reach out to your top parties or push a notification about today\'s offers.' });
  } else if (todayCount >= 5) {
    alerts.push({ type:'success', icon:'🎉', title:'Strong Day! ' + todayCount + ' Orders Today', body:'Great performance. Make sure all orders are being processed on time.' });
  }

  if (alerts.length === 0) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = alerts.map(function(a) {
    return '<div class="alert-box ' + a.type + '">'
      + '<div class="alert-icon">' + a.icon + '</div>'
      + '<div><div class="alert-title">' + a.title + '</div><div class="alert-body">' + a.body + '</div></div>'
      + '</div>';
  }).join('');
}

/* ══════════════════════════════════════════════════
   AI INSIGHTS — Claude API
══════════════════════════════════════════════════ */
function buildContextForAI() {
  const orderSummary = {};
  adminOrders.forEach(function(o) {
    (o.items||[]).forEach(function(item) {
      const key = item.masterCode || item.name || '';
      if (!key) return;
      if (!orderSummary[key]) orderSummary[key] = { name:item.name||key, mc:item.masterCode||'', count:0, boxes:0 };
      orderSummary[key].count++;
      orderSummary[key].boxes += Number(item.boxQty) || 0;
    });
  });

  const topProducts = Object.values(orderSummary).sort((a,b) => b.count-a.count).slice(0,20);
  const partyFreq = {};
  adminOrders.forEach(function(o) {
    if (!partyFreq[o.partyName]) partyFreq[o.partyName] = { city:o.partyCity||'', count:0 };
    partyFreq[o.partyName].count++;
  });
  const topParties = Object.entries(partyFreq).sort((a,b)=>b[1].count-a[1].count).slice(0,15);
  const cityFreq = {};
  adminOrders.forEach(function(o) { const c=(o.partyCity||'Unknown').trim(); cityFreq[c]=(cityFreq[c]||0)+1; });

  return 'JAI AMBE PHARMA — Business Data Summary\n'
    + '=========================================\n'
    + 'Total Orders: ' + adminOrders.length + '\n'
    + 'Total Parties: ' + adminParties.length + '\n'
    + 'Today Orders: ' + adminOrders.filter(o=>isToday(o.date)).length + '\n'
    + 'New (unprocessed): ' + adminOrders.filter(o=>(o.status||'New')==='New').length + '\n\n'
    + 'TOP PRODUCTS BY ORDER FREQUENCY:\n'
    + topProducts.map((p,i) => (i+1)+'. '+p.name+(p.mc?' ('+p.mc+')':'')+' — '+p.count+' orders, '+p.boxes+' boxes total').join('\n') + '\n\n'
    + 'TOP PARTIES BY ORDER COUNT:\n'
    + topParties.map((e,i) => (i+1)+'. '+e[0]+' ('+e[1].city+') — '+e[1].count+' orders').join('\n') + '\n\n'
    + 'CITY DISTRIBUTION:\n'
    + Object.entries(cityFreq).sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>e[0]+': '+e[1]+' orders').join('\n') + '\n\n'
    + 'RETURNS LOGGED: ' + _returns.length + '\n'
    + 'RETURN REASONS: ' + [...new Set(_returns.map(r=>r.reason))].join(', ');
}

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const btn   = document.getElementById('ai-send-btn');
  const msgs  = document.getElementById('ai-messages');
  const text  = (input ? input.value : '').trim();
  if (!text || !msgs) return;

  msgs.innerHTML += '<div class="ai-msg user">' + esc(text) + '</div>';
  if (input) input.value = '';
  if (btn)   btn.disabled = true;

  const thinkId = 'think-' + Date.now();
  msgs.innerHTML += '<div class="ai-msg bot" id="' + thinkId + '"><span class="ai-thinking">🤖 Analysing your data…</span></div>';
  msgs.scrollTop = msgs.scrollHeight;

  // Fix #5: AI calls proxy through the backend — API key is stored securely
  // in Script Properties, never exposed to the browser.
  const url      = localStorage.getItem('jap_sheet_url') || '';
  const token    = localStorage.getItem('jap_admin_token') || '';
  const provider = localStorage.getItem('jap_ai_provider') || 'claude';
  const model    = localStorage.getItem('jap_ai_model') || '';
  const context  = buildContextForAI();

  if (!url) {
    const el = document.getElementById(thinkId);
    if (el) el.innerHTML = '⚠️ App not connected to backend. Save & Connect in Settings first.';
    if (btn) btn.disabled = false;
    return;
  }

  try {
    const res = await apiFetchTimeout(url, {
      method:'POST', body: JSON.stringify({
        action:'aiQuery', token, query:text, provider, model, context
      })
    });
    const reply = res.ok ? res.reply : ('⚠️ ' + (res.msg || 'AI unavailable. Run setAIKey() in Apps Script editor.'));
    const el = document.getElementById(thinkId);
    if (el) el.innerHTML = reply.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>');
  } catch(e) {
    const el = document.getElementById(thinkId);
    if (el) el.innerHTML = '⚠️ AI error: ' + (e.message || 'Connection failed.');
  }
  if (btn) btn.disabled = false;
  msgs.scrollTop = msgs.scrollHeight;
}

function aiQuick(q) {
  const input = document.getElementById('ai-input');
  if (input) { input.value = q; sendAIMessage(); }
}

async function buildAutoInsights() {
  const el = document.getElementById('ai-auto-insights');
  if (!el || !adminOrders.length) { if(el)el.innerHTML='<p style="color:#6b6560;font-size:13px">Load orders first to generate insights.</p>'; return; }

  // Fix #5: proxy through backend — no API key in browser
  const url   = localStorage.getItem('jap_sheet_url') || '';
  const token = localStorage.getItem('jap_admin_token') || '';
  if (!url) {
    el.innerHTML = '<div class="alert-box warn"><div class="alert-icon">⚠️</div><div><div class="alert-title">Not Connected</div><div class="alert-body">Connect to Apps Script in Settings first.</div></div></div>';
    return;
  }

  el.innerHTML = loadingHTML('Generating AI insights…');
  try {
    const context = buildContextForAI();
    const prompt  = 'Analyze this pharma business data. Respond ONLY with a valid JSON array (no markdown, no backticks). Each item: {type:"success|warn|danger|info", icon:"emoji", title:"string", body:"string"}. Max 5 insights based on the actual data.';
    const res = await apiFetchTimeout(url, {
      method:'POST', body: JSON.stringify({ action:'aiQuery', token, query:prompt, context })
    });
    if (!res.ok) throw new Error(res.msg || 'AI unavailable');
    const clean = res.reply.replace(/```json|```/g,'').trim();
    const insights = JSON.parse(clean);
    el.innerHTML = insights.map(function(a) {
      return '<div class="alert-box ' + (a.type||'info') + '" style="margin-bottom:10px">'
        + '<div class="alert-icon">' + (a.icon||'💡') + '</div>'
        + '<div><div class="alert-title">' + esc(a.title||'') + '</div><div class="alert-body">' + esc(a.body||'') + '</div></div>'
        + '</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="alert-box info"><div class="alert-icon">💡</div><div><div class="alert-title">AI Insights Unavailable</div><div class="alert-body">'
      + (e.message || 'Run setAIKey() in the Apps Script editor to configure the AI key.') + '</div></div></div>';
  }
}

/* ══════════════════════════════════════════════════
   ORDER HELPERS
══════════════════════════════════════════════════ */
function fixOrderFields(o) {
  return {
    orderNo     : o.orderNo     || o.orderno     || '',
    date        : o.date        || '',
    partyName   : o.partyName   || o.partyname   || '',
    partyMobile : o.partyMobile || o.partymobile || '',
    partyCity   : o.partyCity   || o.partycity   || '',
    status      : o.status      || 'New',
    remarks     : o.remarks     || '',
    location    : o.location    || '',
    durationSecs: o.durationSecs || '',
    items       : (o.items||[]).map(function(i) {
      return {
        masterCode  : i.masterCode  || i.mastercode  || '',
        productCode : i.productCode || i.productcode || '',
        name        : i.name || i.productname || i.productName || '',
        division    : i.division || '',
        company     : i.company || '',
        boxPackSize : Number(i.boxPackSize || i.boxpacksize || 0),
        casePackSize: Number(i.casePackSize || i.casepacksize || 0),
        scheme      : i.scheme || '',
        remark      : i.remark || i.itemremark || '',
        looseQty    : String(i.looseQty || i.looseqty || 0),
        boxQty      : String(i.boxQty   || i.boxqty   || 0),
        caseQty     : String(i.caseQty  || i.caseqty  || 0),
      };
    }),
  };
}

function getFilteredOrders() {
  const status   = document.getElementById('order-filter')?.value     || 'all';
  const dateFilt = document.getElementById('order-date-filter')?.value || 'all';
  const search   = (document.getElementById('order-search')?.value    || '').toLowerCase().trim();
  let list = adminOrders;
  if (status !== 'all')     list = list.filter(function(o){ return (o.status||'New') === status; });
  if (dateFilt === 'today') list = list.filter(function(o){ return isToday(o.date); });
  if (dateFilt === 'week')  list = list.filter(function(o){ return isThisWeek(o.date); });
  if (dateFilt === 'month') list = list.filter(function(o){ return isThisMonth(o.date); });
  if (search) {
    list = list.filter(function(o) {
      return (o.orderNo+o.partyName+o.partyMobile+o.partyCity).toLowerCase().includes(search) ||
        (o.items||[]).some(function(i){ return (i.name+i.masterCode).toLowerCase().includes(search); });
    });
  }
  return list;
}

function renderOrders() {
  const el  = document.getElementById('orders-list');
  if (!el) return;
  const list = getFilteredOrders();
  const cnt  = document.getElementById('order-count');
  if (cnt) cnt.textContent = list.length + ' order' + (list.length!==1?'s':'');
  if (!list.length) { el.innerHTML = emptyHTML('📦','No orders found','Try a different filter'); return; }
  el.innerHTML = list.map(orderCardHTML).join('');
}

function renderRecent() {
  const el = document.getElementById('recent-orders');
  if (!el) return;
  if (!adminOrders.length) { el.innerHTML = emptyHTML('📦','No orders yet',''); return; }
  el.innerHTML = adminOrders.slice(0,6).map(orderCardHTML).join('');
}

function orderCardHTML(o) {
  const items  = o.items || [];
  const status = o.status || 'New';
  const bCls   = status==='Done'?'badge-done':status==='Processing'?'badge-processing':'badge-new';
  let itemRows = '';
  items.forEach(function(i, idx) {
    const q=[];
    if(Number(i.looseQty)>0) q.push('Loose:'+i.looseQty);
    if(Number(i.boxQty)>0)   q.push('Box:'+i.boxQty);
    if(Number(i.caseQty)>0)  q.push('Case:'+i.caseQty);
    const code = i.masterCode ? '<span style="color:#0b6e72;font-size:10px;margin-left:4px">'+esc(i.masterCode)+'</span>' : '';
    itemRows += '<tr style="border-bottom:1px solid #f5f0ec">'
      +'<td style="padding:5px 10px;font-size:12px">'+(idx+1)+'. '+esc((i.name||'').slice(0,46))+code+'</td>'
      +'<td style="padding:5px 10px;font-size:11.5px;color:#0b6e72;font-weight:600;text-align:right;white-space:nowrap">'+esc(q.join(' · ')||'—')+'</td>'
      +'</tr>';
  });
  if (!itemRows) itemRows = '<tr><td colspan="2" style="padding:6px 10px;color:#6b6560;font-size:12px">No items</td></tr>';
  const waMsg   = buildWaMsg(o);
  const locLink = o.location ? '<a href="https://maps.google.com/?q='+esc(o.location)+'" target="_blank" style="font-size:11px;color:#4285f4;font-weight:600;text-decoration:none">📍 Map</a>' : '';
  const dur     = o.durationSecs ? '<span style="font-size:11px;color:#6b6560">⏱ '+formatDuration(Number(o.durationSecs))+'</span>' : '';
  const remarks = o.remarks ? '<div style="font-size:11.5px;color:#888;margin-top:3px">📝 '+esc(o.remarks)+'</div>' : '';
  return '<div class="order-card">'
    +'<div class="order-card-hd">'
      +'<div><div class="order-no">'+esc(o.orderNo||'—')+'</div>'
        +'<div style="font-size:11px;color:#6b6560">📅 '+esc(o.date||'—')+' · '+items.length+' item'+(items.length!==1?'s':'')+'</div></div>'
      +'<span class="badge '+bCls+'">'+esc(status)+'</span>'
    +'</div>'
    +'<div style="padding:9px 14px;background:#faf8f5;border-bottom:1px solid #f0ece6">'
      +'<div style="font-size:13px;font-weight:700;margin-bottom:2px">🏪 '+esc(o.partyName||'—')+'</div>'
      +'<div style="font-size:12px;color:#6b6560">📱 '+esc(o.partyMobile||'—')+' · 🌆 '+esc(o.partyCity||'—')+'</div>'
      +remarks+'<div style="display:flex;gap:10px;margin-top:3px">'+locLink+' '+dur+'</div>'
    +'</div>'
    +'<div style="padding:7px 14px;border-bottom:1px solid #f0ece6"><table style="width:100%;border-collapse:collapse">'+itemRows+'</table></div>'
    +'<div class="order-actions">'
      +'<a href="https://wa.me/'+(localStorage.getItem(LS.WA_NUM)||DEFAULT_WA)+'?text='+encodeURIComponent(waMsg)+'" target="_blank" class="btn btn-green btn-sm">📲</a>'
      +'<button class="btn btn-sm btn-outline" onclick="updStatus(\''+esc(o.orderNo)+'\',\'Processing\')">⏳ Processing</button>'
      +'<button class="btn btn-sm" style="background:#e8f5e9;color:#145c30" onclick="updStatus(\''+esc(o.orderNo)+'\',\'Done\')">✅ Done</button>'
      +'<button class="btn btn-sm btn-outline" onclick="showOrderDetail(\''+esc(o.orderNo)+'\')">👁 Detail</button>'
    +'</div>'
  +'</div>';
}

function showOrderDetail(orderNo) {
  const o = adminOrders.find(function(x){ return x.orderNo===orderNo; });
  if (!o) return;
  const modal = document.getElementById('order-modal');
  const body  = document.getElementById('order-modal-body');
  if (!modal||!body) return;
  // Show full card + per-item remarks
  let html = orderCardHTML(o);
  const hasItemRemarks = (o.items||[]).some(function(it){ return it.remark||it.itemRemark; });
  if (hasItemRemarks) {
    html += '<div style="margin:12px 16px;padding:10px;background:#fffbf0;border:1px solid #ffe082;border-radius:8px"><div style="font-size:12px;font-weight:700;color:#795548;margin-bottom:6px">Item-level Remarks</div>'
      + (o.items||[]).filter(function(it){return it.remark||it.itemRemark;}).map(function(it){
          return '<div style="font-size:12px;padding:3px 0"><b>'+esc(it.name||it.masterCode||'')+':</b> '+esc(it.remark||it.itemRemark)+'</div>';
        }).join('') + '</div>';
  }
  body.innerHTML = html;
  modal.style.display = 'flex';
}
function closeOrderModal()  { const m=document.getElementById('order-modal');  if(m)m.style.display='none'; }
function closePartyModal()  { const m=document.getElementById('party-modal');  if(m)m.style.display='none'; }
function closeSupplierModal(){ const m=document.getElementById('supplier-modal'); if(m)m.style.display='none'; }
function closeReturnModal() { const m=document.getElementById('return-modal'); if(m)m.style.display='none'; }

function buildWaMsg(o) {
  const items=o.items||[];
  let msg='🏥 *JAI AMBE PHARMA*\n📋 *Order:* '+(o.orderNo||'')+' | 📅 '+(o.date||'')+'\n━━━━━━━━━━━━━━\n';
  msg+='🏪 *'+( o.partyName||'')+'*\n📱 '+(o.partyMobile||'')+' · '+(o.partyCity||'')+'\n';
  if(o.remarks)msg+='📝 '+o.remarks+'\n';
  msg+='━━━━━━━━━━━━━━\n';
  items.forEach(function(i,idx){
    const q=[]; if(Number(i.looseQty)>0)q.push('L:'+i.looseQty); if(Number(i.boxQty)>0)q.push('B:'+i.boxQty); if(Number(i.caseQty)>0)q.push('C:'+i.caseQty);
    msg+=(idx+1)+'. *'+( i.name||'').slice(0,45)+'*'+(i.masterCode?' ('+i.masterCode+')':'')+'\n   '+(q.join(' | ')||'—')+'\n';
  });
  msg+='\n_Jai Ambe Pharma, Hubballi_';
  return msg;
}

function buildStatusWAMsg(o, status) {
  const num = (localStorage.getItem('jap_wa_num')||'').replace(/\D/g,'');
  if (!num || !o.partyMobile) return;
  const shopMobile = o.partyMobile.replace(/\D/g,'');
  const icons = {Done:'tick-mark', Processing:'package', New:'clipboard'};
  const label = status==='Done'?'Ready / Dispatched':status==='Processing'?'Being Processed':'Received';
  const msg = 'JAI AMBE PHARMA\nOrder Update\n\nOrder: ' + o.orderNo + '\nDate: ' + o.date + '\nShop: ' + (o.partyName||'') + '\n\nStatus: ' + label + '\n\n_Jai Ambe Pharma, Hubballi_';
  window.open('https://wa.me/91'+shopMobile+'?text='+encodeURIComponent(msg),'_blank','noopener');
}

async function updStatus(orderNo, status) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) { toast('No sheet configured','err'); return; }
  try {
    const res = await apiFetchTimeout(url+'?action=updateOrderStatus&orderNo='+encodeURIComponent(orderNo)+'&status='+encodeURIComponent(status)+'&token='+adminToken(), 8000);
    const ok  = res && res.ok;
    if (!ok) { await apiPost(url, {action:'updateOrderStatus',orderNo,status,token:adminToken()}); }
    const idx = adminOrders.findIndex(function(o){ return o.orderNo===orderNo; });
    if (idx>=0) adminOrders[idx].status = status;
    renderOrders(); renderRecent();
    toast('Marked '+status+' ✓','ok');
    auditLog('order','Updated order '+orderNo+' → '+status);
  } catch(e) { toast('Error: '+(e.message||'').slice(0,40),'err'); }
}

function parseAdminPermissions(p) {
  var perms = {};
  try { if (p.permissions) perms = JSON.parse(p.permissions); } catch(e) {}
  var keys = ['removeAvailability','showAvailableLabel','showExactQty','hideScheme',
    'hideSpecialScheme','hideOffers','hideNotifications','hideWhatsApp'];
  keys.forEach(function(k) {
    var v = p[k] !== undefined ? p[k] : p[k.toLowerCase()];
    if (v === undefined || v === null || v === '') return;
    if (typeof v === 'boolean') { perms[k] = v; return; }
    perms[k] = /^true|yes|1|y$/i.test(String(v).trim());
  });
  return perms;
}

/* ══════════════════════════════════════════════════
   PARTIES / CRM
══════════════════════════════════════════════════ */
async function loadParties() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  try {
    const res = await apiFetchTimeout(url+'?action=parties&token='+adminToken(), 15000);
    if (!res||!res.ok) return;
    adminParties = (res.parties||[]).map(function(p){
      var perms = parseAdminPermissions(p);
      var favList = [];
      try { if (p.favjson) favList = JSON.parse(p.favjson); } catch(e) {}
      return {
        id             : p.id||p.partycode||'',
        partyCode      : p.partycode||p.id||'',
        name           : p.name||p.shopname||'',
        ownerName      : p.ownername||p.ownerName||'',
        mobile         : p.mobile||'',
        email          : p.email||'',
        altPhone       : p.altphone||p.altPhone||'',
        city           : p.city||'',
        active         : p.active||'TRUE',
        approved       : (p.approved||'').toString(),
        pin            : (p.password||'').toString(),
        deviceId       : p.deviceid||p.deviceId||'',
        location       : p.location||'',
        deviceType     : p.devicetype||p.deviceType||'',
        browserType    : p.browsertype||p.browserType||'',
        deviceName     : p.devicename||p.deviceName||'',
        registeredAt   : p.registeredat||p.createdat||p.createdAt||'',
        lastViewedAt   : p.lastviewedat||p.lastlogin||p.lastLogin||'',
        totalTimeSecs  : p.totaltimesec||p.totalTimeSecs||'',
        totalLogins    : p.totallogins||p.totalLogins||'',
        totalOrders    : p.totalorders||p.totalOrders||'',
        lastLogin      : p.lastviewedat||p.lastlogin||p.lastLogin||'',
        lastSessionMins: p.lastsessionmins||p.lastSessionMins||'',
        permissions    : perms,
        favsCount      : p.favscount||p.favsCount||'0',
        favProducts    : p.favproducts||p.favProducts||'',
        favList        : favList
      };
    });
    updateStat('s-parties', adminParties.length);
    updateCRMStats();
    populateCityFilter();
    filterParties();
  } catch(e) {}
}

function updateCRMStats() {
  const total    = adminParties.length;
  const recentMs = new Set(adminOrders.filter(function(o){ return isThisMonth(o.date); }).map(function(o){ return o.partyMobile; }));
  const active   = adminParties.filter(function(p){ return recentMs.has(p.mobile); }).length;
  const maxOrds  = Math.max(1, ...Object.values(function(){const f={};adminOrders.forEach(function(o){f[o.partyMobile]=(f[o.partyMobile]||0)+1;});return f;}()));
  const vip      = Object.values((function(){ const f={}; adminOrders.forEach(function(o){f[o.partyMobile]=(f[o.partyMobile]||0)+1;}); return f; })()).filter(function(c){ return c>=Math.ceil(maxOrds*0.6); }).length;
  updateStat('crm-total',    total);
  updateStat('crm-active',   active);
  updateStat('crm-inactive', total - active);
  updateStat('crm-vip',      vip);
}

function populateCityFilter() {
  const sel = document.getElementById('party-city-filter');
  if (!sel) return;
  const cities = [...new Set(adminParties.map(function(p){ return (p.city||'').trim(); }).filter(Boolean))].sort();
  sel.innerHTML = '<option value="all">All Cities</option>' + cities.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('');
}

function filterParties() {
  const q      = (document.getElementById('party-search')?.value||'').toLowerCase().trim();
  const city   = document.getElementById('party-city-filter')?.value||'all';
  const status = document.getElementById('party-status-filter')?.value||'all';
  const seg    = document.getElementById('party-segment-filter')?.value||'all';

  // Build party order counts
  const partyOrds = {};
  adminOrders.forEach(function(o){ partyOrds[o.partyMobile]=(partyOrds[o.partyMobile]||0)+1; });
  const maxO = Math.max(1,...Object.values(partyOrds));

  function getSegment(mobile) {
    const c=partyOrds[mobile]||0;
    if(c>=Math.ceil(maxO*0.6)) return 'A';
    if(c>=Math.ceil(maxO*0.3)) return 'B';
    return 'C';
  }

  let list = adminParties;
  if(q)              list=list.filter(function(p){return ((p.name+p.mobile+p.city)||'').toLowerCase().includes(q);});
  if(city!=='all')   list=list.filter(function(p){return (p.city||'').trim()===city;});
  if(status!=='all') list=list.filter(function(p){return String(p.active||'TRUE').toUpperCase()===status.toUpperCase();});
  if(seg!=='all')    list=list.filter(function(p){return getSegment(p.mobile)===seg;});

  const cnt=document.getElementById('parties-count');
  if(cnt) cnt.textContent=list.length+' part'+(list.length!==1?'ies':'y');

  const el=document.getElementById('parties-list');
  if(!el) return;
  if(!list.length){el.innerHTML=emptyHTML('🏪','No parties found','Try a different filter');return;}

  el.innerHTML=list.map(function(p){
    const orderCount=partyOrds[p.mobile]||0;
    const isActive=String(p.active||'TRUE').toUpperCase()!=='FALSE';
    const apv=String(p.approved||'').trim().toUpperCase();
    const isApproved=(apv==='TRUE'||apv==='YES'||apv==='APPROVED');
    const seg=getSegment(p.mobile);
    const segColors={'A':'#145c30','B':'#c97d0a','C':'#6b6560'};
    const segBgs={'A':'#e8f5e9','B':'#fff3e0','C':'#f0f0f0'};
    const rowBg=isApproved?'#fff':'#fff3cd';
    const rowBorder=isApproved?'#e8e3dc':'#f5c542';
    return '<div style="background:'+rowBg+';border:2px solid '+rowBorder+';border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;gap:14px" onclick="showPartyDetail(\''+esc(p.mobile)+'\')">'
      +'<div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#0b6e72,#0e8a90);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;font-weight:700;flex-shrink:0">'+(p.name||'?')[0].toUpperCase()+'</div>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:13.5px;font-weight:700">'+esc(p.name||'—')+'</div>'
        +'<div style="font-size:11.5px;color:#6b6560">📱 '+esc(p.mobile||'—')+' · 🌆 '+esc(p.city||'—')+'</div>'
        +'<div style="font-size:11px;color:#6b6560;margin-top:2px">📦 '+orderCount+' orders'+(p.lastLogin?'</div><div style="font-size:10.5px;color:#0b6e72;margin-top:2px">🕐 Last login: '+esc(p.lastLogin):'')+'</div>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">'
        +'<span style="background:'+segBgs[seg]+';color:'+segColors[seg]+';padding:2px 9px;border-radius:50px;font-size:10.5px;font-weight:700">'+seg+' Tier</span>'
        +'<span class="badge '+(isActive?'badge-active':'badge-inactive')+'">'+(isActive?'Active':'Inactive')+'</span>'
        +(isApproved?'':'<span class="badge badge-inactive" style="background:#fde68a;color:#92400e">⏳ Pending approval</span>')
      +'</div>'
    +'</div>';
  }).join('');
}

function showPartyDetail(mobile) {
  const p=adminParties.find(function(x){return x.mobile===mobile;});
  if(!p) return;
  const orders=adminOrders.filter(function(o){return o.partyMobile===mobile;});
  const modal=document.getElementById('party-modal');
  const body =document.getElementById('party-modal-body');
  if(!modal||!body) return;

  let orderHTML='';
  if(orders.length){
    orders.slice(0,10).forEach(function(o){
      const cnt=(o.items||[]).length;
      const bCls=o.status==='Done'?'badge-done':o.status==='Processing'?'badge-processing':'badge-new';
      orderHTML+='<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0">'
        +'<div><div style="font-size:12.5px;font-weight:600">'+esc(o.orderNo)+'</div><div style="font-size:11px;color:#6b6560">'+esc(o.date)+' · '+cnt+' items</div></div>'
        +'<span class="badge '+bCls+'">'+esc(o.status||'New')+'</span>'
      +'</div>';
    });
  } else { orderHTML='<div style="color:#6b6560;font-size:13px;padding:10px 0">No orders yet</div>'; }

  // ── Permissions panel ──
  var perms = p.permissions || {};
  // ── Approval control ──
  var apv = String(p.approved||'').trim().toUpperCase();
  var isApproved = (apv==='TRUE'||apv==='YES'||apv==='APPROVED');
  var apColor = isApproved ? '#145c30' : '#b5252b';
  var apBg    = isApproved ? '#e8f5e9' : '#fde8e8';
  var apLabel = isApproved ? '✓ Approved' : '⏳ Pending approval';
  var approvalHTML = '<div style="background:'+apBg+';border:1px solid '+apColor+'33;border-radius:10px;padding:14px 16px;margin-bottom:16px">'
    +'<div style="font-size:12.5px;font-weight:800;color:#1a1a1a;margin-bottom:8px;letter-spacing:.02em">🔐 ACCESS STATUS</div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">'
      +'<span style="color:'+apColor+';font-weight:700;font-size:13px">'+apLabel+'</span>'
      +(isApproved
        ? '<button onclick="blockParty(\''+esc(p.mobile)+'\')" style="background:#b5252b;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer">Block Access</button>'
        : '<button onclick="approveParty(\''+esc(p.mobile)+'\')" style="background:#145c30;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer">✓ Approve</button>')
    +'</div>'
    +'<div id="approval-msg-'+esc(p.mobile)+'" style="font-size:12px;text-align:center;margin-top:8px;color:#145c30;font-weight:600;display:none"></div>'
    +'</div>';

  var permHTML = '<div style="background:#eef7f7;border:1px solid #b8dedf;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:12.5px;color:#0b3d40;line-height:1.5">'
    +'<strong>Permissions are managed on the Devices tab</strong> (Devices sheet in Google Sheets). '
    +'Open <strong>Devices → Configure</strong> for this shop\'s phone/device. All checkboxes start checked; uncheck to withdraw access.'
    +'</div>';

  body.innerHTML='<div style="padding:20px">'
    +'<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">'
      +'<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#0b6e72,#0e8a90);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;font-weight:700">'+(p.name||'?')[0].toUpperCase()+'</div>'
      +'<div><div style="font-size:18px;font-weight:700">'+esc(p.name||'—')+'</div><div style="font-size:13px;color:#6b6560">📱 '+esc(p.mobile||'—')+' · 🌆 '+esc(p.city||'—')+'</div></div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">'
      +'<div class="stat-card"><div class="stat-num" style="font-size:22px">'+orders.length+'</div><div class="stat-lbl">Orders</div></div>'
      +'<div class="stat-card"><div class="stat-num" style="font-size:22px">'+(p.totalLogins||'0')+'</div><div class="stat-lbl">Logins</div></div>'
      +'<div class="stat-card"><div class="stat-num" style="font-size:22px">'+(p.favsCount||'0')+'</div><div class="stat-lbl">Favourites</div></div>'
    +'</div>'
    +'<div style="background:#fafaf9;border:1px solid #e8e3dc;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:12.5px;line-height:1.65">'
      +'<div style="font-weight:800;margin-bottom:8px">🏪 Party profile</div>'
      +'<div><b>Party Code:</b> '+esc(p.partyCode||p.id||'—')+'</div>'
      +'<div><b>Owner:</b> '+esc(p.ownerName||'—')+'</div>'
      +'<div><b>Email:</b> '+esc(p.email||'—')+' · <b>Alt:</b> '+esc(p.altPhone||'—')+'</div>'
      +'<div><b>Registered:</b> '+esc(p.registeredAt||'—')+' · <b>Last viewed:</b> '+esc(p.lastViewedAt||p.lastLogin||'—')+'</div>'
    +'</div>'
  +'<div style="background:#f0fafa;border:1px solid #b2dfdb;border-radius:10px;padding:12px 14px;margin-bottom:16px">'
      +'<div style="font-size:12px;font-weight:700;color:#0b6e72;margin-bottom:8px">📱 Device &amp; usage</div>'
      +'<div style="font-size:12px;line-height:1.6">'
        +'<div><b>Device ID:</b> '+esc(p.deviceId||'—')+'</div>'
        +'<div><b>Location:</b> '+esc(p.location||'—')+'</div>'
        +'<div><b>Device:</b> '+esc(p.deviceName||'—')+' · <b>Type:</b> '+esc(p.deviceType||'—')+' · <b>Browser:</b> '+esc(p.browserType||'—')+'</div>'
        +'<div><b>Time in app:</b> '+esc(p.totalTimeSecs||'0')+' sec · <b>Last session:</b> '+(p.lastSessionMins?p.lastSessionMins+' min':'—')+'</div>'
        +'<div><b>Total orders (logged):</b> '+esc(p.totalOrders||String(orders.length))+'</div>'
      +'</div>'
    +'</div>'
    +approvalHTML
    +permHTML
    +_buildFavsPanel(p)
    +'<div style="font-size:13px;font-weight:700;margin-bottom:10px;margin-top:4px">📦 Order History</div>'
    +orderHTML
    +'<div style="display:flex;gap:10px;margin-top:16px">'
      +(p.mobile?'<a href="https://wa.me/91'+esc(p.mobile)+'" target="_blank" class="btn btn-green btn-sm">📲 WhatsApp</a>':'')
      +(p.mobile?'<a href="tel:91'+esc(p.mobile)+'" class="btn btn-sm btn-outline">📞 Call</a>':'')
    +'</div>'
  +'</div>';
  modal.style.display='flex';
}

function _buildFavsPanel(p) {
  var cnt = parseInt(p.favsCount)||0;
  var list = p.favList||[];
  var header = '<div style="font-size:13px;font-weight:700;margin-bottom:10px">❤️ Favourites '
    +'<span style="background:#fee2e2;color:#b91c1c;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:700">'+cnt+'</span></div>';

  if (!cnt && !list.length) {
    return '<div style="background:#fafaf9;border:1px solid #e8e3dc;border-radius:10px;padding:12px 14px;margin-bottom:14px">'
      +header
      +'<div style="color:#6b6560;font-size:12.5px">No favourites yet</div>'
      +'</div>';
  }

  var rows = '';
  if (list.length) {
    rows = list.map(function(f,i){
      var bg = i%2===0?'#fff':'#fafaf9';
      return '<tr style="background:'+bg+'">'
        +'<td style="padding:6px 8px;border:1px solid #f0ede8;font-size:11px;color:#6b6560">'+(i+1)+'</td>'
        +'<td style="padding:6px 8px;border:1px solid #f0ede8;font-weight:600;font-size:12px">'+esc(f.name||'—')+'</td>'
        +'<td style="padding:6px 8px;border:1px solid #f0ede8;font-size:11px;color:#0b6e72">'+esc(f.mc||'—')+'</td>'
        +'<td style="padding:6px 8px;border:1px solid #f0ede8;font-size:11px;color:#6b6560">'+esc(f.company||'—')+'</td>'
        +'</tr>';
    }).join('');
  } else if (p.favProducts) {
    // Fallback: show comma-separated product names
    rows = p.favProducts.split(',').map(function(name,i){
      return '<tr style="background:'+(i%2===0?'#fff':'#fafaf9')+'">'
        +'<td style="padding:6px 8px;border:1px solid #f0ede8;font-size:11px;color:#6b6560">'+(i+1)+'</td>'
        +'<td colspan="3" style="padding:6px 8px;border:1px solid #f0ede8;font-size:12px;font-weight:600">'+esc(name.trim())+'</td>'
        +'</tr>';
    }).join('');
  }

  return '<div style="background:#fafaf9;border:1px solid #e8e3dc;border-radius:10px;padding:12px 14px;margin-bottom:14px">'
    +header
    +'<div style="overflow-x:auto;border-radius:6px;border:1px solid #e8e3dc">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<tr style="background:#0b6e72">'
    +'<th style="padding:6px 8px;color:#fff;font-size:11px;width:28px">#</th>'
    +'<th style="padding:6px 8px;color:#fff;font-size:11px;text-align:left">Product</th>'
    +'<th style="padding:6px 8px;color:#fff;font-size:11px;text-align:left">Code</th>'
    +'<th style="padding:6px 8px;color:#fff;font-size:11px;text-align:left">Company</th>'
    +'</tr>'
    +rows
    +'</table>'
    +'</div>'
  +'</div>';
}

function _permToggle(key, val, label, desc) {
  return '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:9px 10px;border-radius:8px;background:#fff;border:1px solid #e8e3dc">'
    +'<input type="checkbox" id="perm-'+key+'" '+(val?'checked':'')+' style="width:17px;height:17px;margin-top:1px;accent-color:#0b6e72;flex-shrink:0;cursor:pointer">'
    +'<div>'
      +'<div style="font-size:12.5px;font-weight:700;color:#1a1a1a;line-height:1.3">'+label+'</div>'
      +'<div style="font-size:11px;color:#6b7280;margin-top:2px">'+desc+'</div>'
    +'</div>'
  +'</label>';
}

var adminDevices = [];
async function loadDevices() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) { toast('Configure sheet URL first','err'); return; }
  const el = document.getElementById('devices-list');
  if (el) el.innerHTML = '<div style="color:#6b6560;font-size:13px;padding:14px 0">Loading devices…</div>';
  try {
    const res = await apiFetchTimeout(url + '?action=devices&token=' + adminToken(), 20000);
    adminDevices = (res && res.ok && Array.isArray(res.devices)) ? res.devices : [];
    renderDevices();
  } catch(e) { if (el) el.innerHTML = '<div style="color:#b5252b;font-size:13px">Could not load devices.</div>'; }
}
function renderDevices() {
  const el = document.getElementById('devices-list'); if (!el) return;
  const q = (document.getElementById('device-search')?.value || '').toLowerCase().trim();
  let list = adminDevices.slice();
  if (q) list = list.filter(function(d){ return ((d.shopName||'')+(d.mobile||'')+(d.deviceCode||'')+(d.city||'')).toLowerCase().indexOf(q) !== -1; });
  const cnt = document.getElementById('devices-count');
  const pend = adminDevices.filter(function(d){ return !d.approved; }).length;
  if (cnt) cnt.textContent = adminDevices.length + ' device(s) · ' + pend + ' pending approval';
  if (!list.length) { el.innerHTML = '<div style="color:#6b6560;font-size:13px;padding:14px 0">No devices found.</div>'; return; }
  // pending first
  list.sort(function(a,b){ return (a.approved===b.approved)?0:(a.approved?1:-1); });
  el.innerHTML = list.map(function(d){
    const badge = d.approved
      ? '<span class="badge badge-active">Approved</span>'
      : '<span class="badge badge-inactive">Pending</span>';
    const btn = d.approved
      ? '<button class="btn btn-sm btn-outline" onclick="blockDeviceAdmin(\''+esc(d.deviceId)+'\')">Block</button>'
      : '<button class="btn btn-sm" style="background:#145c30;color:#fff" onclick="approveDeviceAdmin(\''+esc(d.deviceId)+'\')">✓ Approve</button>';
    const cfg = '<button class="btn btn-sm btn-outline" onclick="showDeviceDetail(\''+esc(d.deviceId)+'\')">⚙ Configure</button>';
    const border = d.approved ? '#e8e3dc' : '#f5c542';
    return '<div style="background:'+(d.approved?'#fff':'#fffbeb')+';border:2px solid '+border+';border-radius:12px;padding:13px 15px;margin-bottom:10px;display:flex;align-items:center;gap:12px">'
      +'<div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#0b6e72,#0e8a90);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:700;flex-shrink:0">'+esc((d.shopName||'?').charAt(0).toUpperCase())+'</div>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:13.5px;font-weight:700">'+esc(d.shopName||'—')+'</div>'
        +'<div style="font-size:11.5px;color:#6b6560">📱 '+esc(d.mobile||'—')+' · 🌆 '+esc(d.city||'—')+'</div>'
        +'<div style="font-size:11px;color:#6b6560;margin-top:2px">🔑 Code: <b>'+esc(d.deviceCode||'—')+'</b> · '+esc(d.deviceType||'Unknown')+(d.lastSeen?(' · 🕐 '+esc(d.lastSeen)):'')+'</div>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">'+badge+cfg+btn+'</div>'
    +'</div>';
  }).join('');
}

function closeDeviceModal() {
  const m = document.getElementById('device-modal');
  if (m) m.style.display = 'none';
}

function _grantToggle(key, val, label, desc) {
  return '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:9px 10px;border-radius:8px;background:#fff;border:1px solid #e8e3dc">'
    +'<input type="checkbox" id="grant-'+key+'" '+(val?'checked':'')+' style="width:17px;height:17px;margin-top:1px;accent-color:#0b6e72;flex-shrink:0;cursor:pointer">'
    +'<div><div style="font-size:12.5px;font-weight:700;color:#1a1a1a">'+label+'</div>'
    +'<div style="font-size:11px;color:#6b7280;margin-top:2px">'+desc+'</div></div></label>';
}

function _deviceGrantsFromRecord(d) {
  if (d.grants && typeof d.grants === 'object') return d.grants;
  var keys = ['showStockBadge','showAvailableLabel','showExactQty','showProductSchemes',
    'showSpecialSchemeBanner','showSpecialSchemesTab','showNotifications','showWhatsApp'];
  var g = {};
  keys.forEach(function(k) {
    if (d[k] !== undefined && d[k] !== '') g[k] = /^true|yes|1$/i.test(String(d[k]));
    else g[k] = true;
  });
  return g;
}

function showDeviceDetail(deviceId) {
  const d = adminDevices.find(function(x){ return x.deviceId === deviceId; });
  if (!d) { toast('Device not found — refresh list', 'err'); return; }
  const modal = document.getElementById('device-modal');
  const body = document.getElementById('device-modal-body');
  if (!modal || !body) return;
  const g = _deviceGrantsFromRecord(d);
  body.innerHTML = '<div style="padding:20px">'
    +'<div style="font-size:17px;font-weight:700;margin-bottom:4px">'+esc(d.shopName||'—')+'</div>'
    +'<div style="font-size:12.5px;color:#6b6560;margin-bottom:14px">📱 '+esc(d.mobile||'—')+' · Code <b>'+esc(d.deviceCode||'—')+'</b></div>'
    +'<p style="font-size:11.5px;color:#6b6560;margin:0 0 12px;line-height:1.45">All boxes checked = full access. <strong>Uncheck</strong> to withdraw that feature for this device. Saved to the <strong>Devices</strong> sheet.</p>'
    +'<div style="display:grid;gap:8px">'
    +_grantToggle('showStockBadge', g.showStockBadge, '📦 Show Stock Badge', 'Uncheck to hide stock badge on product cards')
    +_grantToggle('showAvailableLabel', g.showAvailableLabel, '✅ Show Available Label', 'Show Available / Not Available text')
    +_grantToggle('showExactQty', g.showExactQty, '🔢 Show Exact Qty', 'Show exact stock count')
    +_grantToggle('showProductSchemes', g.showProductSchemes, '🏷️ Show Product Schemes', 'Show scheme banners on cards')
    +_grantToggle('showSpecialSchemeBanner', g.showSpecialSchemeBanner, '⭐ Show Special Scheme Banner', 'Show special scheme text on cards')
    +_grantToggle('showSpecialSchemesTab', g.showSpecialSchemesTab, '🎁 Show Special Schemes Tab', 'Show Special Schemes menu tab')
    +_grantToggle('showNotifications', g.showNotifications, '🔔 Show Notifications', 'Show notification bell')
    +_grantToggle('showWhatsApp', g.showWhatsApp, '💬 Show WhatsApp', 'Show WhatsApp support button')
    +'</div>'
    +'<button onclick="saveDevicePermissions(\''+esc(deviceId)+'\')" style="margin-top:14px;width:100%;padding:11px 0;background:#0b6e72;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">💾 Save Permissions</button>'
    +'<div id="device-perm-msg" style="display:none;margin-top:8px;text-align:center;font-size:12px;color:#145c30;font-weight:600">✓ Saved</div>'
    +'</div>';
  modal.style.display = 'flex';
}

async function saveDevicePermissions(deviceId) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  const grants = {
    showStockBadge: document.getElementById('grant-showStockBadge')?.checked !== false,
    showAvailableLabel: document.getElementById('grant-showAvailableLabel')?.checked !== false,
    showExactQty: document.getElementById('grant-showExactQty')?.checked !== false,
    showProductSchemes: document.getElementById('grant-showProductSchemes')?.checked !== false,
    showSpecialSchemeBanner: document.getElementById('grant-showSpecialSchemeBanner')?.checked !== false,
    showSpecialSchemesTab: document.getElementById('grant-showSpecialSchemesTab')?.checked !== false,
    showNotifications: document.getElementById('grant-showNotifications')?.checked !== false,
    showWhatsApp: document.getElementById('grant-showWhatsApp')?.checked !== false
  };
  try {
    const res = await apiPost(url, {
      action: 'updateDevicePermissions',
      token: adminToken(),
      deviceId: deviceId,
      grants: JSON.stringify(grants)
    });
    if (res && res.ok) {
      const idx = adminDevices.findIndex(function(x){ return x.deviceId === deviceId; });
      if (idx >= 0) { adminDevices[idx].grants = grants; adminDevices[idx].permissions = res.permissions; }
      const msg = document.getElementById('device-perm-msg');
      if (msg) { msg.style.display = 'block'; setTimeout(function(){ msg.style.display = 'none'; }, 2500); }
      toast('Device permissions saved', 'ok');
    } else toast('Save failed: ' + ((res && res.msg) || 'unknown'), 'err');
  } catch(e) { toast('Error: ' + e, 'err'); }
}

async function approveDeviceAdmin(deviceId) { await _setDevice(deviceId, true); }
async function blockDeviceAdmin(deviceId) { await _setDevice(deviceId, false); }
async function _setDevice(deviceId, approve) {
  const url = localStorage.getItem(LS.SHEET_URL); if (!url) return;
  try {
    const res = await apiPost(url, { action: approve ? 'approveDevice' : 'blockDevice', token: adminToken(), deviceId: deviceId });
    if (res && res.ok) {
      const idx = adminDevices.findIndex(function(x){ return x.deviceId === deviceId; });
      if (idx >= 0) adminDevices[idx].approved = approve;
      renderDevices();
      toast(approve ? 'Device approved ✓' : 'Device blocked', approve?'ok':'inf');
      auditLog('party', (approve?'Approved':'Blocked')+' device '+deviceId.slice(-6));
    } else { toast('Failed: '+((res&&res.msg)||'unknown'), 'err'); }
  } catch(e) { toast('Error: '+e, 'err'); }
}

async function setApproval(mobile, approve) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) { toast('Configure sheet URL first','err'); return; }
  try {
    const res = await apiPost(url, { action: approve ? 'approveParty' : 'blockParty', token: adminToken(), mobile });
    if (res && res.ok) {
      const idx = adminParties.findIndex(function(x){ return x.mobile === mobile; });
      if (idx >= 0) adminParties[idx].approved = approve ? 'TRUE' : 'FALSE';
      if (approve && res.pin) {
        const idx2 = adminParties.findIndex(function(x){ return x.mobile === mobile; });
        if (idx2 >= 0) adminParties[idx2].pin = res.pin;
      }
      const msg = document.getElementById('approval-msg-'+mobile);
      if (msg) { msg.textContent = approve ? '✓ Party marked approved. Also approve the device on the Devices tab if needed.' : 'Access blocked.'; msg.style.display='block'; }
      auditLog('party', (approve?'Approved':'Blocked')+' party '+mobile);
      toast(approve ? 'Party approved ✓' : 'Party blocked', approve?'ok':'inf');
      // Refresh the detail view to flip the button
      setTimeout(function(){ showPartyDetail(mobile); }, 600);
    } else { toast('Failed: '+((res&&res.msg)||'unknown'), 'err'); }
  } catch(e) { toast('Error: '+e, 'err'); }
}
function approveParty(mobile){ setApproval(mobile, true); }
function blockParty(mobile){ setApproval(mobile, false); }

async function savePartyPermissions(mobile) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  const perms = {
    removeAvailability : document.getElementById('perm-removeAvailability')?.checked || false,
    showAvailableLabel : document.getElementById('perm-showAvailableLabel')?.checked || false,
    showExactQty       : document.getElementById('perm-showExactQty')?.checked       || false,
    hideScheme         : document.getElementById('perm-hideScheme')?.checked          || false,
    hideSpecialScheme  : document.getElementById('perm-hideSpecialScheme')?.checked   || false,
    hideOffers         : document.getElementById('perm-hideOffers')?.checked          || false,
    hideNotifications  : document.getElementById('perm-hideNotifications')?.checked   || false,
    hideWhatsApp       : document.getElementById('perm-hideWhatsApp')?.checked         || false,
  };
  try {
    const res = await apiPost(url, {
      action:'updatePartyPermissions',
      token:adminToken(),
      mobile,
      permissions: JSON.stringify(perms)
    });
    if (res && res.ok) {
      const idx = adminParties.findIndex(function(x){ return x.mobile === mobile; });
      if (idx >= 0) adminParties[idx].permissions = perms;
      const msg = document.getElementById('perm-msg-'+mobile);
      if (msg) { msg.style.display='block'; setTimeout(function(){ msg.style.display='none'; }, 2500); }
    } else { toast('Error saving permissions', 'err'); }
  } catch(e) { toast('Error: '+e, 'err'); }
}

function clearPartySearch(){const i=document.getElementById('party-search');if(i)i.value='';filterParties();}

/* ══════════════════════════════════════════════════
   INVENTORY HEALTH
══════════════════════════════════════════════════ */
function buildInventory() {
  const prodMap = {};
  adminOrders.forEach(function(o) {
    (o.items||[]).forEach(function(item) {
      const key = item.masterCode || item.name || '';
      if (!key) return;
      if (!prodMap[key]) {
        prodMap[key] = { name:item.name||key, mc:item.masterCode||'', company:'', count:0, boxes:0, lastDate:'' };
      }
      prodMap[key].count++;
      prodMap[key].boxes += Number(item.boxQty) || 0;
      if (!prodMap[key].lastDate || o.date > prodMap[key].lastDate) prodMap[key].lastDate = o.date;
    });
  });

  const products = Object.values(prodMap).sort(function(a,b){ return b.count-a.count; });
  const totalOrds = Math.max(1, adminOrders.length);
  const reorderThresh = _thresholds.reorder || 3;
  const slowThresh    = _thresholds.slow    || 2;

  const reorderList = products.filter(function(p){ return p.count <= reorderThresh; });
  const slowList    = products.filter(function(p){ return p.count <= slowThresh; });
  const fastList    = products.filter(function(p){ return p.count >= Math.ceil(totalOrds * 0.2); });

  updateStat('inv-total-skus',    products.length);
  updateStat('inv-reorder-count', reorderList.length);
  updateStat('inv-slow-count',    slowList.length);
  updateStat('inv-fast-count',    fastList.length);

  // Reorder alerts
  const alertEl = document.getElementById('reorder-alerts');
  if (alertEl) {
    if (!reorderList.length) {
      alertEl.innerHTML = '<div class="alert-box success"><div class="alert-icon">✅</div><div><div class="alert-title">No Reorder Alerts</div><div class="alert-body">All products have sufficient demand. Thresholds met.</div></div></div>';
    } else {
      alertEl.innerHTML = reorderList.slice(0,8).map(function(p) {
        return '<div class="alert-box '+(p.count===0?'danger':'warn')+'">'
          +'<div class="alert-icon">'+(p.count===0?'🚨':'⚠️')+'</div>'
          +'<div style="flex:1"><div class="alert-title">'+esc(p.name.slice(0,50))+'</div>'
          +'<div class="alert-body">Only <strong>'+p.count+' orders</strong> total'+(p.mc?' · Code: '+esc(p.mc):'')+' · Last ordered: '+(p.lastDate||'Never')+'</div></div>'
          +'<div style="background:#0b6e72;color:#fff;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;flex-shrink:0;cursor:pointer" onclick="aiQuick(\'Generate a reorder recommendation for '+p.name.replace(/'/g,'').slice(0,40)+'\')">🤖 AI Suggest</div>'
        +'</div>';
      }).join('');
    }
  }

  // Full table
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;
  if (!products.length) { tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:#6b6560">No inventory data. Place orders first.</td></tr>'; return; }

  const maxCount = Math.max(1, products[0].count);
  tbody.innerHTML = products.slice(0,80).map(function(p, idx) {
    const pct   = Math.round((p.count/maxCount)*100);
    const avg   = p.count > 0 ? (p.boxes/p.count).toFixed(1) : '0';
    const moq   = Math.max(1, Math.ceil(p.boxes/Math.max(1,p.count)));
    const demand= p.count >= Math.ceil(maxCount*0.4) ? {label:'🔥 High', cls:'badge-done',bg:'#e8f5e9',color:'#145c30'} :
                  p.count >= Math.ceil(maxCount*0.15) ? {label:'📈 Medium',bg:'#fff3e0',color:'#c97d0a',cls:'badge-processing'} :
                                                        {label:'📉 Low',bg:'#f0f0f0',color:'#6b6560',cls:''};
    const barColor=p.count>=Math.ceil(maxCount*0.4)?'#145c30':p.count>=Math.ceil(maxCount*0.15)?'#f59e0b':'#b5252b';
    return '<tr>'
      +'<td style="padding:9px 12px"><div style="font-weight:600;font-size:12px">'+esc(p.name.slice(0,44))+'</div></td>'
      +'<td style="padding:9px 12px;color:#0b6e72;font-size:11px">'+esc(p.mc||'—')+'</td>'
      +'<td style="padding:9px 12px;font-size:11.5px;color:#6b6560">'+esc(p.company||'—')+'</td>'
      +'<td style="padding:9px 12px;text-align:center;font-weight:700;color:#0b6e72">'+p.count+'</td>'
      +'<td style="padding:9px 12px;text-align:center">'+avg+'</td>'
      +'<td style="padding:9px 12px;text-align:center"><span style="background:'+demand.bg+';color:'+demand.color+';padding:2px 8px;border-radius:50px;font-size:10.5px;font-weight:600">'+demand.label+'</span></td>'
      +'<td style="padding:9px 12px;text-align:center"><span style="background:#e6f0ff;color:#1a5fb4;padding:3px 10px;border-radius:6px;font-weight:700">'+moq+' Box</span></td>'
      +'<td style="padding:9px 12px;text-align:center;font-size:11px;color:#6b6560">'+esc(p.lastDate||'—')+'</td>'
      +'<td style="padding:9px 12px;text-align:center"><button style="background:#0b6e72;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer" onclick="aiQuick(\'Give me a detailed reorder and stock recommendation for '+p.name.replace(/'/g,'').slice(0,35)+'\')">🤖</button></td>'
    +'</tr>';
  }).join('');
}

function filterInventory() {
  const q = (document.getElementById('inv-search')?.value||'').toLowerCase();
  const rows = document.querySelectorAll('#inventory-tbody tr');
  rows.forEach(function(r) {
    r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

/* ══════════════════════════════════════════════════
   CHARTS
══════════════════════════════════════════════════ */
function buildCharts() {
  if (!adminOrders.length) return;
  buildWeeklyChart(); buildStatusChart(); buildPartiesChart(); buildCityChart();
}

function buildWeeklyChart() {
  const ctx=document.getElementById('chart-weekly'); if(!ctx)return;
  if(_charts.weekly)_charts.weekly.destroy();
  const days=[],counts=[];
  for(let i=13;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const dd=String(d.getDate()).padStart(2,'0'),mm=String(d.getMonth()+1).padStart(2,'0');
    days.push(d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric'}));
    counts.push(adminOrders.filter(function(o){return o.date===dd+'/'+mm+'/'+d.getFullYear();}).length);
  }
  _charts.weekly=new Chart(ctx,{type:'bar',data:{labels:days,datasets:[{data:counts,backgroundColor:'rgba(11,110,114,.75)',borderColor:'#0b6e72',borderWidth:1.5,borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}});
}

function buildStatusChart(){
  const ctx=document.getElementById('chart-status');if(!ctx)return;
  if(_charts.status)_charts.status.destroy();
  const n=adminOrders.filter(function(o){return (o.status||'New')==='New';}).length;
  const p=adminOrders.filter(function(o){return o.status==='Processing';}).length;
  const d=adminOrders.filter(function(o){return o.status==='Done';}).length;
  _charts.status=new Chart(ctx,{type:'doughnut',data:{labels:['New','Processing','Done'],datasets:[{data:[n,p,d],backgroundColor:['#1a1a2e','#f59e0b','#145c30'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}}); 
}

function buildPartiesChart(){
  const ctx=document.getElementById('chart-parties');if(!ctx)return;
  if(_charts.parties)_charts.parties.destroy();
  const freq={};adminOrders.forEach(function(o){const n=o.partyName||'Unknown';freq[n]=(freq[n]||0)+1;});
  const s=Object.entries(freq).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
  _charts.parties=new Chart(ctx,{type:'bar',data:{labels:s.map(function(x){return x[0].slice(0,18);}),datasets:[{data:s.map(function(x){return x[1];}),backgroundColor:'rgba(201,125,10,.8)',borderColor:'#c97d0a',borderWidth:1.5,borderRadius:5}]},options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}});
}

function buildCityChart(){
  const ctx=document.getElementById('chart-cities');if(!ctx)return;
  if(_charts.cities)_charts.cities.destroy();
  const freq={};adminOrders.forEach(function(o){const c=(o.partyCity||'Unknown').trim();freq[c]=(freq[c]||0)+1;});
  const s=Object.entries(freq).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
  _charts.cities=new Chart(ctx,{type:'doughnut',data:{labels:s.map(function(x){return x[0];}),datasets:[{data:s.map(function(x){return x[1];}),backgroundColor:['#0b6e72','#c97d0a','#145c30','#b5252b','#5b3fa6','#1a5fb4','#f59e0b','#00695c'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}});
}

/* ══════════════════════════════════════════════════
   ANALYTICS
══════════════════════════════════════════════════ */
function buildAnalytics() {
  const rng = document.getElementById('analytics-date-range');
  const days = rng ? parseInt(rng.value)||30 : 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  window._analyticsOrders = adminOrders.filter(function(o){
    const parts = (o.date||'').split('/');
    if (parts.length===3) { const d = new Date(parts[2],parts[1]-1,parts[0]); return d >= cutoff; }
    return true;
  });
  buildTrendChart(); buildPartySegments(); buildProductMixChart(); buildFillRateChart(); buildDurationStats();
}

function buildTrendChart(){
  const ctx=document.getElementById('chart-trend');if(!ctx)return;
  if(_charts.trend)_charts.trend.destroy();
  const daily=adminStats.daily||[];
  _charts.trend=new Chart(ctx,{type:'line',data:{labels:daily.map(function(d){return d.date.slice(0,5);}),datasets:[{label:'Orders',data:daily.map(function(d){return d.count;}),borderColor:'#0b6e72',backgroundColor:'rgba(11,110,114,.12)',tension:.4,fill:true,pointRadius:2,pointHoverRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
}

function buildPartySegments(){
  const el=document.getElementById('party-segments');if(!el)return;
  const top=(adminStats.topParties||[]).slice(0,15);
  if(!top.length){el.innerHTML='<p style="color:#6b6560;font-size:13px">No data yet.</p>';return;}
  const maxC=top[0]?.count||1;
  el.innerHTML=top.map(function(p,i){
    const pct=Math.round((p.count/maxC)*100);
    const tier=p.count>=maxC*0.6?{l:'A',c:'#145c30',bg:'#e8f5e9'}:p.count>=maxC*0.3?{l:'B',c:'#c97d0a',bg:'#fff3e0'}:{l:'C',c:'#6b6560',bg:'#f0f0f0'};
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f5f0ec">'
      +'<div style="width:26px;height:26px;border-radius:50%;background:'+tier.bg+';color:'+tier.c+';display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;flex-shrink:0">'+tier.l+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.name||'—')+'</div>'
      +'<div style="height:4px;background:#e5e7eb;border-radius:2px;margin-top:4px"><div style="width:'+pct+'%;height:100%;background:'+tier.c+';border-radius:2px"></div></div></div>'
      +'<div style="font-size:12.5px;font-weight:700;color:#0b6e72;flex-shrink:0">'+p.count+'</div>'
    +'</div>';
  }).join('');
}

function buildProductMixChart(){
  const ctx=document.getElementById('chart-product-mix');if(!ctx)return;
  if(_charts.productMix)_charts.productMix.destroy();
  const top=(adminStats.topProducts||[]).slice(0,12);if(!top.length)return;
  _charts.productMix=new Chart(ctx,{type:'bar',data:{labels:top.map(function(p){return (p.name||p.masterCode||'').slice(0,20);}),datasets:[{data:top.map(function(p){return p.count;}),backgroundColor:'rgba(11,110,114,.75)',borderColor:'#0b6e72',borderWidth:1,borderRadius:4}]},options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}});
}

function buildFillRateChart(){
  const ctx=document.getElementById('chart-fill');if(!ctx)return;
  if(_charts.fill)_charts.fill.destroy();
  const n=adminOrders.filter(function(o){return (o.status||'New')==='New';}).length;
  const p=adminOrders.filter(function(o){return o.status==='Processing';}).length;
  const d=adminOrders.filter(function(o){return o.status==='Done';}).length;
  const total=Math.max(1,n+p+d);
  _charts.fill=new Chart(ctx,{type:'bar',data:{labels:['Fill Rate'],datasets:[{label:'Done',data:[Math.round(d/total*100)],backgroundColor:'#145c30',borderRadius:4},{label:'Processing',data:[Math.round(p/total*100)],backgroundColor:'#f59e0b',borderRadius:4},{label:'New',data:[Math.round(n/total*100)],backgroundColor:'#1a1a2e',borderRadius:4}]},options:{indexAxis:'y',responsive:true,scales:{x:{stacked:true,max:100,ticks:{callback:function(v){return v+'%';}}}},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+': '+ctx.raw+'%';}}}}}});
}

function buildDurationStats(){
  const el=document.getElementById('duration-stats');if(!el)return;
  const durations=adminOrders.map(function(o){return Number(o.durationSecs)||0;}).filter(Boolean);
  if(!durations.length){el.innerHTML='<p style="color:#6b6560;font-size:13px;padding:10px 0">No duration data yet.</p>';return;}
  const avg=Math.round(durations.reduce(function(a,b){return a+b;},0)/durations.length);
  const min=Math.min(...durations);const max=Math.max(...durations);
  el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:10px 0">'
    +'<div class="stat-card"><div class="stat-num" style="font-size:22px">'+formatDuration(avg)+'</div><div class="stat-lbl">Avg Time</div></div>'
    +'<div class="stat-card"><div class="stat-num" style="font-size:22px">'+formatDuration(min)+'</div><div class="stat-lbl">Fastest</div></div>'
    +'<div class="stat-card"><div class="stat-num" style="font-size:22px">'+formatDuration(max)+'</div><div class="stat-lbl">Slowest</div></div>'
  +'</div><p style="font-size:12px;color:#6b6560;margin-top:8px">Time taken from first product view to submitting order.</p>';
}

/* ══════════════════════════════════════════════════
   FORECAST
══════════════════════════════════════════════════ */
function buildForecast() {
  buildForecastLineChart();
  const el=document.getElementById('forecast-table');if(!el)return;
  const prodMap={};
  adminOrders.forEach(function(o){
    (o.items||[]).forEach(function(item){
      const k=item.masterCode||item.name||'';if(!k)return;
      if(!prodMap[k])prodMap[k]={name:item.name||k,mc:item.masterCode||'',count:0,boxes:0,loose:0,cases:0,lastDate:''};
      prodMap[k].count++;prodMap[k].boxes+=Number(item.boxQty)||0;
      prodMap[k].loose+=Number(item.looseQty)||0;prodMap[k].cases+=Number(item.caseQty)||0;
      if(!prodMap[k].lastDate||o.date>prodMap[k].lastDate)prodMap[k].lastDate=o.date;
    });
  });
  const products=Object.values(prodMap).sort(function(a,b){return b.count-a.count;}).slice(0,50);
  const totalO=Math.max(1,adminOrders.length);
  el.innerHTML='<div style="overflow-x:auto;border-radius:12px;border:1px solid #e8e3dc"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:#1a1a2e;color:#fff">'
    +'<th style="padding:10px 12px;text-align:left">#</th>'
    +'<th style="padding:10px 12px;text-align:left">Product</th>'
    +'<th style="padding:10px 12px;text-align:center">Orders</th>'
    +'<th style="padding:10px 12px;text-align:center">Demand</th>'
    +'<th style="padding:10px 12px;text-align:center">Avg Box/Order</th>'
    +'<th style="padding:10px 12px;text-align:center">Suggested MOQ</th>'
    +'<th style="padding:10px 12px;text-align:center">Stock Turn Score</th>'
    +'<th style="padding:10px 12px;text-align:center">Last Ordered</th>'
    +'</tr></thead><tbody>'
    +products.map(function(p,idx){
      const dem=Math.round((p.count/totalO)*100);
      const avgB=p.count>0?(p.boxes/p.count).toFixed(1):'0';
      const moq=Math.max(1,Math.ceil(p.boxes/Math.max(1,p.count)));
      const turnScore=Math.min(100,Math.round((p.count/totalO)*200));
      const tier=dem>=30?{l:'🔥 High',c:'#145c30',bg:'#e8f5e9'}:dem>=10?{l:'📈 Med',c:'#c97d0a',bg:'#fff3e0'}:{l:'📉 Low',c:'#6b6560',bg:'#f0f0f0'};
      return '<tr style="background:'+(idx%2?'#f8f9fa':'#fff')+'">'
        +'<td style="padding:9px 12px;color:#6b6560">'+( idx+1)+'</td>'
        +'<td style="padding:9px 12px"><div style="font-weight:600">'+esc(p.name.slice(0,44))+'</div>'+(p.mc?'<div style="font-size:10px;color:#0b6e72">'+esc(p.mc)+'</div>':'')+'</td>'
        +'<td style="padding:9px 12px;text-align:center;font-weight:700;color:#0b6e72">'+p.count+'</td>'
        +'<td style="padding:9px 12px;text-align:center"><span style="background:'+tier.bg+';color:'+tier.c+';padding:2px 9px;border-radius:50px;font-size:10.5px;font-weight:700">'+tier.l+' '+dem+'%</span></td>'
        +'<td style="padding:9px 12px;text-align:center">'+avgB+'</td>'
        +'<td style="padding:9px 12px;text-align:center"><span style="background:#e6f0ff;color:#1a5fb4;padding:3px 10px;border-radius:6px;font-weight:700">'+moq+' Box</span></td>'
        +'<td style="padding:9px 12px;text-align:center"><div style="display:flex;align-items:center;gap:6px;justify-content:center"><div style="width:50px;background:#e5e7eb;border-radius:4px;height:6px"><div style="width:'+turnScore+'%;height:100%;background:'+(turnScore>=60?'#145c30':turnScore>=30?'#f59e0b':'#b5252b')+';border-radius:4px"></div></div><span style="font-size:11px">'+turnScore+'</span></div></td>'
        +'<td style="padding:9px 12px;text-align:center;font-size:11px;color:#6b6560">'+esc(p.lastDate||'—')+'</td>'
      +'</tr>';
    }).join('')
  +'</tbody></table></div>';
}

function buildForecastLineChart(){
  const ctx=document.getElementById('chart-forecast-line');if(!ctx)return;
  if(_charts.forecastLine)_charts.forecastLine.destroy();
  const daily=adminStats.daily||[];if(!daily.length)return;
  const actual=daily.slice(-14).map(function(d){return d.count;});
  // Simple moving average forecast for next 7 days
  const window=Math.min(7,actual.length);
  const avg=actual.slice(-window).reduce(function(a,b){return a+b;},0)/window;
  const predicted=Array(7).fill(0).map(function(_,i){return Math.max(0,Math.round(avg+(Math.random()*.4-.2)*avg));});
  const labels=daily.slice(-14).map(function(d){return d.date.slice(0,5);});
  for(let i=1;i<=7;i++){const d=new Date();d.setDate(d.getDate()+i);labels.push(String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'));}
  const paddedActual=actual.concat(Array(7).fill(null));
  const paddedForecast=Array(actual.length-1).fill(null).concat([actual[actual.length-1]]).concat(predicted);
  _charts.forecastLine=new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[
      {label:'Actual Orders',data:paddedActual,borderColor:'#0b6e72',backgroundColor:'rgba(11,110,114,.1)',tension:.35,fill:true,pointRadius:3,spanGaps:false},
      {label:'AI Forecast',data:paddedForecast,borderColor:'#c97d0a',backgroundColor:'rgba(201,125,10,.08)',borderDash:[6,3],tension:.35,fill:true,pointRadius:3,spanGaps:false},
    ]},
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:11}}}},scales:{y:{beginAtZero:true}}}
  });
}

/* ══════════════════════════════════════════════════
   SUPPLIERS
══════════════════════════════════════════════════ */
function showAddSupplierModal(){ document.getElementById('supplier-modal').style.display='flex'; }

function saveSupplier(){
  const s={
    id:'SUP'+Date.now(),
    name:(document.getElementById('sup-name')?.value||'').trim(),
    contact:(document.getElementById('sup-contact')?.value||'').trim(),
    mobile:(document.getElementById('sup-mobile')?.value||'').trim(),
    email:(document.getElementById('sup-email')?.value||'').trim(),
    products:(document.getElementById('sup-products')?.value||'').split(',').map(function(x){return x.trim();}).filter(Boolean),
    leadDays:parseInt(document.getElementById('sup-lead')?.value||'7'),
    addedAt:todayStr(),
    performance:'Good',
  };
  if(!s.name){toast('Enter supplier name','err');return;}
  _suppliers.push(s);
  localStorage.setItem('jap_suppliers',JSON.stringify(_suppliers));
  closeSupplierModal();
  renderSuppliers();
  auditLog('sync','Added supplier: '+s.name);
  toast('Supplier added ✓','ok');
  // Clear form
  ['sup-name','sup-contact','sup-mobile','sup-email','sup-products'].forEach(function(id){const el=document.getElementById(id);if(el)el.value='';});
}

function renderSuppliers(){
  const el=document.getElementById('suppliers-list');if(!el)return;
  if(!_suppliers.length){
    el.innerHTML='<div class="alert-box info"><div class="alert-icon">🚛</div><div><div class="alert-title">No Suppliers Added</div><div class="alert-body">Add your first supplier to start tracking lead times and performance.</div></div></div>';
    return;
  }
  el.innerHTML=_suppliers.map(function(s){
    const perfColor=s.performance==='Good'?'green':s.performance==='Average'?'yellow':'red';
    return '<div class="supplier-card">'
      +'<div class="supplier-avatar">'+(s.name||'?')[0].toUpperCase()+'</div>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:13.5px;font-weight:700">'+esc(s.name)+'</div>'
        +'<div style="font-size:12px;color:#6b6560">'+esc(s.contact||'—')+(s.mobile?' · '+esc(s.mobile):'')+'</div>'
        +'<div style="font-size:11px;color:#6b6560;margin-top:3px">📦 '+esc(s.products.slice(0,4).join(', '))+(s.products.length>4?'…':'')+' · ⏱ '+s.leadDays+'d lead</div>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">'
        +'<span><span class="perf-dot '+perfColor+'"></span><span style="font-size:11.5px;font-weight:600">'+s.performance+'</span></span>'
        +(s.mobile?'<a href="https://wa.me/'+esc(s.mobile)+'" target="_blank" style="font-size:11px;color:#25D366;font-weight:600;text-decoration:none">📲 WA</a>':'')
        +'<button style="font-size:11px;color:#b5252b;background:none;border:none;cursor:pointer;padding:0" onclick="deleteSupplier(\''+s.id+'\')">🗑 Remove</button>'
      +'</div>'
    +'</div>';
  }).join('');
}

function deleteSupplier(id){
  if(!confirm('Remove this supplier?'))return;
  _suppliers=_suppliers.filter(function(s){return s.id!==id;});
  localStorage.setItem('jap_suppliers',JSON.stringify(_suppliers));
  renderSuppliers();
  toast('Supplier removed','inf');
}

/* ══════════════════════════════════════════════════
   RETURNS
══════════════════════════════════════════════════ */
function showAddReturnModal(){ document.getElementById('return-modal').style.display='flex'; }

function saveReturn(){
  const r={
    id:'RET'+Date.now(),
    orderNo:(document.getElementById('ret-order-no')?.value||'').trim(),
    party:(document.getElementById('ret-party')?.value||'').trim(),
    product:(document.getElementById('ret-product')?.value||'').trim(),
    qty:parseInt(document.getElementById('ret-qty')?.value||'1'),
    reason:document.getElementById('ret-reason')?.value||'',
    notes:(document.getElementById('ret-notes')?.value||'').trim(),
    date:todayStr(),
    status:'Pending',
  };
  if(!r.product){toast('Enter product name','err');return;}
  _returns.push(r);
  localStorage.setItem('jap_returns',JSON.stringify(_returns));
  closeReturnModal();
  renderReturns();
  updateReturnStats();
  auditLog('order','Logged return: '+r.product+' from '+r.party);
  toast('Return logged ✓','ok');
}

function resolveReturn(id){
  const r=_returns.find(function(x){return x.id===id;});
  if(r){r.status='Resolved';localStorage.setItem('jap_returns',JSON.stringify(_returns));}
  renderReturns();updateReturnStats();
  toast('Marked resolved ✓','ok');
}

function deleteReturn(id){
  _returns=_returns.filter(function(x){return x.id!==id;});
  localStorage.setItem('jap_returns',JSON.stringify(_returns));
  renderReturns();updateReturnStats();
}

function renderReturns(){
  const el=document.getElementById('returns-list');if(!el)return;
  if(!_returns.length){
    el.innerHTML='<div class="alert-box success"><div class="alert-icon">✅</div><div><div class="alert-title">No Returns Logged</div><div class="alert-body">Great! Use the button above to log a return when needed.</div></div></div>';
    return;
  }
  el.innerHTML=_returns.slice().reverse().map(function(r){
    const isPending=r.status==='Pending';
    return '<div class="return-card">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
        +'<div><div style="font-size:13.5px;font-weight:700">'+esc(r.product||'—')+'</div>'
        +'<div style="font-size:12px;color:#6b6560">From: '+esc(r.party||'—')+(r.orderNo?' · Order: '+esc(r.orderNo):'')+'</div></div>'
        +'<span class="badge '+(isPending?'badge-processing':'badge-done')+'">'+r.status+'</span>'
      +'</div>'
      +'<div style="font-size:12px;color:#6b6560;margin-bottom:8px">📦 Qty: '+r.qty+' boxes · 📅 '+esc(r.date)+'<br>❓ '+esc(r.reason)+(r.notes?' · '+esc(r.notes):'')+'</div>'
      +'<div style="display:flex;gap:8px">'
        +(isPending?'<button class="btn btn-sm" style="background:#e8f5e9;color:#145c30" onclick="resolveReturn(\''+r.id+'\')">✅ Resolve</button>':'')
        +'<button class="btn btn-sm btn-outline" style="color:#b5252b;border-color:#b5252b" onclick="deleteReturn(\''+r.id+'\')">🗑</button>'
      +'</div>'
    +'</div>';
  }).join('');
}

function updateReturnStats(){
  const total=_returns.length;
  const pending=_returns.filter(function(r){return r.status==='Pending';}).length;
  const resolved=_returns.filter(function(r){return r.status==='Resolved';}).length;
  const rate=adminOrders.length>0?((total/adminOrders.length)*100).toFixed(1):0;
  updateStat('ret-total',total);updateStat('ret-pending',pending);updateStat('ret-resolved',resolved);updateStat('ret-rate',rate);
}

/* ══════════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════════ */
async function pushNotification(){
  const title=(document.getElementById('notif-title-input')?.value||'').trim();
  const msg=(document.getElementById('notif-body-input')?.value||'').trim();
  const image=(document.getElementById('notif-image-input')?.value||'').trim();
  const link=(document.getElementById('notif-link-input')?.value||'').trim();
  const productCode=(document.getElementById('notif-product-input')?.value||'').trim();
  const target=(document.getElementById('notif-target-input')?.value||'').trim();
  if(!title){toast('Enter a title','err');return;}
  const url=localStorage.getItem(LS.SHEET_URL);
  if(!url){toast('Configure sheet URL first','err');return;}
  const btn=document.getElementById('push-notif-btn');
  if(btn){btn.textContent='⏳ Pushing…';btn.disabled=true;}
  try{
    const res=await apiPost(url,{action:'addNotification',token:adminToken(),title,description:msg,image,link,productCode,target});
    if(res&&res.ok){
      toast('Notification pushed ✓','ok');
      ['notif-title-input','notif-body-input','notif-image-input','notif-link-input','notif-product-input','notif-target-input'].forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
      auditLog('notif','Pushed notification: '+title);
      loadCurrentNotif();
    }else{toast('Failed: '+(res?.msg||'unknown'),'err');}
  }catch(e){toast('Error: '+(e.message||'').slice(0,50),'err');}
  finally{if(btn){btn.textContent='📢 Push to All Users';btn.disabled=false;}}
}

async function loadCurrentNotif(){
  const url=localStorage.getItem(LS.SHEET_URL);if(!url)return;
  try{
    const res=await apiFetchTimeout(url+'?action=notification',6000);
    if(res&&res.ok&&res.title){
      setElText('current-notif-title',res.title);
      setElText('current-notif-body',res.body||'—');
      setElText('current-notif-ts',res.ts||'');
    }
  }catch(e){}
}

/* ══════════════════════════════════════════════════
   PRODUCTS
══════════════════════════════════════════════════ */
async function syncProducts(){
  const url=localStorage.getItem(LS.SHEET_URL);
  if(!url){toast('Configure sheet URL first','err');return;}
  const btn=document.getElementById('sync-products-btn');
  if(btn){btn.textContent='⏳ Syncing…';btn.disabled=true;}
  toast('Syncing…','inf');
  try{
    await apiFetchTimeout(url+'?action=forcerefresh&token='+adminToken(),60000);
    const res=await apiFetchTimeout(url+'?action=products',60000);
    if(res&&res.ok&&res.products&&res.products.length){
      localStorage.setItem(LS.PRODUCTS,JSON.stringify(res.products));
      localStorage.setItem(LS.PRODUCTS_TS,String(Date.now()));
      localStorage.removeItem(LS.COMPANIES);
      updateProdStats();
      updateStat('s-products',res.products.length);
      toast(res.products.length+' products synced ✓','ok');
      auditLog('sync','Synced '+res.products.length+' products');
    }else{toast('Sync failed: '+(res&&res.msg||'no products'),'err');}
  }catch(e){toast('Error: '+(e.message||'').slice(0,60),'err');}
  finally{if(btn){btn.textContent='🔄 Sync Products';btn.disabled=false;}}
}

async function syncOffers(){
  const url=localStorage.getItem(LS.SHEET_URL);if(!url)return;
  toast('Syncing offers…','inf');
  try{
    const res=await apiFetchTimeout(url+'?action=offers',30000);
    if(res&&res.ok&&res.products&&res.products.length){
      localStorage.setItem(LS.OFFERS,JSON.stringify(res.products));
      localStorage.setItem(LS.OFFERS_TS,String(Date.now()));
      setElText('a-offers-count',res.products.length);
      toast(res.products.length+' offers synced ✓','ok');
    }else{toast('No offers found','inf');}
  }catch(e){toast('Error: '+(e.message||'').slice(0,50),'err');}
}

function updateProdStats(){
  const cached=localStorage.getItem(LS.PRODUCTS);
  const ts=localStorage.getItem(LS.PRODUCTS_TS);
  const cnt=cached?(function(){try{return JSON.parse(cached).length;}catch(e){return 0;}}()):0;
  const oCached=localStorage.getItem(LS.OFFERS);
  const oCnt=oCached?(function(){try{return JSON.parse(oCached).length;}catch(e){return 0;}}()):0;
  setElText('a-prod-count',cnt||'—');
  setElText('a-sync-time',ts?new Date(Number(ts)).toLocaleString('en-IN'):'Never');
  setElText('a-offers-count',oCnt||'—');
  updateStat('s-products',cnt||0);
}

function filterAdminProducts(){
  const q=(document.getElementById('prod-admin-search')?.value||'').toLowerCase();
  const stockF=document.getElementById('prod-stock-filter')?.value||'all';
  renderAdminProducts(q, stockF);
}

function renderAdminProducts(q, stockFilter){
  const el=document.getElementById('admin-prod-list');if(!el)return;
  const cached=localStorage.getItem(LS.PRODUCTS);
  if(!cached){el.innerHTML='<div style="color:#6b6560;font-size:13px;padding:12px">Sync products first.</div>';return;}
  let products;
  try{products=JSON.parse(cached).map(normaliseAny).filter(function(p){return p&&p.id;});}
  catch(e){el.innerHTML='<p style="color:#b5252b">Cache error — re-sync</p>';return;}
  if(q)products=products.filter(function(p){return (p.displayName||p.namePack||'').toLowerCase().includes(q)||esc(p.masterCode||'').toLowerCase().includes(q);});
  if(stockFilter==='instock')products=products.filter(function(p){return (parseInt(p.stockAvailable)||0)>0;});
  if(stockFilter==='outstock')products=products.filter(function(p){return (parseInt(p.stockAvailable)||0)<=0;});
  setElText('a-prod-count',products.length);
  if(!products.length){el.innerHTML=emptyHTML('🔍','No products found','');return;}
  el.innerHTML=products.slice(0,200).map(function(p){
    const id=p.id||p.masterCode||'';
    const isHid=_hiddenProducts.indexOf(id)>=0;
    const scheme=p.scheme||p['special scheme']||'';
    const stock=parseInt(p.stockAvailable||p.stockNum||0)||0;
    const stockBg=stock>0?'background:#dcfce7;color:#14532d;border:1px solid #86efac':'background:#fee2e2;color:#7f1d1d;border:1px solid #fca5a5';
    const stockLabel=stock>0?'✓ '+stock+' Avail':'✗ Out';
    const pts=p.pts?'₹'+p.pts:'';
    const mrp=p.mrp?'MRP ₹'+p.mrp:'';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#fff;border:1px solid #e8e3dc;border-radius:10px;gap:8px;'+(isHid?'opacity:.45':'')+'">'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.displayName||p.namePack||'—')+'</div>'
        +'<div style="font-size:11px;color:#6b6560;margin-top:2px">'+esc(p.company||'')+(p.masterCode?' · '+esc(p.masterCode):'')+(pts?' · <b style="color:#0a3d3f">'+pts+'</b>':'')+(mrp?' · <span style="color:#aaa;text-decoration:line-through">'+mrp+'</span>':'')+(scheme?' · 🎁 '+esc(scheme):'')+'</div>'
      +'</div>'
      +'<div style="flex-shrink:0;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:5px">'
        +'<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:5px;'+stockBg+'">'+stockLabel+'</span>'
        +'<label style="display:flex;align-items:center;gap:5px;cursor:pointer">'
          +'<span style="font-size:10px;color:'+(isHid?'#b5252b':'#0b6e72')+';font-weight:600">'+(isHid?'Hidden':'Visible')+'</span>'
          +'<div onclick="toggleProductHide(\''+esc(id)+'\',this)" style="width:34px;height:20px;border-radius:10px;background:'+(isHid?'#e5e7eb':'#0b6e72')+';position:relative;cursor:pointer;transition:background .2s">'
            +'<div style="width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:2px;'+(isHid?'left:2px':'right:2px')+';transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>'
          +'</div>'
        +'</label>'
      +'</div>'
    +'</div>';
  }).join('');
}

function toggleProductHide(id){
  const idx=_hiddenProducts.indexOf(id);
  if(idx>=0)_hiddenProducts.splice(idx,1);else _hiddenProducts.push(id);
  localStorage.setItem('jap_hidden_products',JSON.stringify(_hiddenProducts));
  filterAdminProducts();
  toast(idx>=0?'Product shown ✓':'Product hidden ✓','ok');
}

/* ══════════════════════════════════════════════════
   AUDIT LOG
══════════════════════════════════════════════════ */
function auditLog(type, message){
  _auditLog.unshift({type,message,time:new Date().toLocaleString('en-IN'),ts:Date.now()});
  if(_auditLog.length>200)_auditLog=_auditLog.slice(0,200);
  localStorage.setItem('jap_audit_log',JSON.stringify(_auditLog));
}

function renderAuditLog(){
  const el=document.getElementById('audit-log-list');if(!el)return;
  const filter=document.getElementById('audit-filter')?.value||'all';
  let logs=_auditLog;
  if(filter!=='all')logs=logs.filter(function(l){return l.type===filter;});
  if(!logs.length){el.innerHTML='<div style="color:#6b6560;font-size:13px;padding:16px;text-align:center">No audit entries yet.</div>';return;}
  const icons={login:'🔐',order:'📦',sync:'🔄',notif:'🔔'};
  const colors={login:'#e6f0ff',order:'#e8f5e9',sync:'#fff3e0',notif:'#fde8e8'};
  el.innerHTML='<div style="background:#fff;border-radius:12px;border:1px solid #e8e3dc;overflow:hidden">'
    +logs.slice(0,80).map(function(l,i){
      const icon=icons[l.type]||'📝';const bg=colors[l.type]||'#f0f0f0';
      return '<div class="audit-row" style="padding:10px 14px;'+(i>0?'border-top:1px solid #f5f0ec':'')+'">'
        +'<div class="audit-icon" style="background:'+bg+';font-size:14px">'+icon+'</div>'
        +'<div style="flex:1"><div style="font-size:12.5px;font-weight:500">'+esc(l.message)+'</div><div style="font-size:11px;color:#6b6560">'+esc(l.time||'')+'</div></div>'
        +'<span style="font-size:10.5px;color:#6b6560;background:#f5f0ec;padding:2px 8px;border-radius:50px">'+esc(l.type)+'</span>'
      +'</div>';
    }).join('')
  +'</div>';
}

function clearAuditLog(){
  if(!confirm('Clear audit log?'))return;
  _auditLog=[];localStorage.removeItem('jap_audit_log');
  renderAuditLog();toast('Cleared','inf');
}

/* ══════════════════════════════════════════════════
   EXPORT
══════════════════════════════════════════════════ */
function exportExcel(){
  const list=getFilteredOrders();if(!list.length){toast('No orders','err');return;}
  const rows=[['Order No','Date','Party','Mobile','City','Product','Code','Loose','Box','Case','Status','Remarks']];
  list.forEach(function(o){
    const items=o.items||[];
    if(!items.length){rows.push([o.orderNo,o.date,o.partyName,o.partyMobile,o.partyCity,'','','','','',o.status,o.remarks||'']);}
    else{items.forEach(function(item,idx){rows.push([idx===0?o.orderNo:'',idx===0?o.date:'',idx===0?o.partyName:'',idx===0?o.partyMobile:'',idx===0?o.partyCity:'',item.name||'',item.masterCode||'',item.looseQty||0,item.boxQty||0,item.caseQty||0,idx===0?(o.status||''):'',idx===0?(o.remarks||''):'']);});}
  });
  const csv=rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='JAP_Orders_'+todayStr().replace(/\//g,'-')+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  auditLog('sync','Exported '+list.length+' orders to CSV');
  toast(list.length+' orders exported ✓','ok');
}

function exportPDF(){
  const list=getFilteredOrders();if(!list.length){toast('No orders','err');return;}
  const win=window.open('','_blank');if(!win){toast('Allow popups','err');return;}
  let html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JAP Orders</title><style>body{font-family:Arial;font-size:12px;margin:20px}h1{font-size:18px;color:#0b6e72}table{width:100%;border-collapse:collapse;margin-bottom:18px;page-break-inside:avoid}th{background:#0b6e72;color:#fff;padding:7px 9px;text-align:left;font-size:11px}td{padding:6px 9px;border-bottom:1px solid #e8e3dc;font-size:11px}@media print{body{margin:8px}}</style></head><body>';
  html+='<h1>🏥 Jai Ambe Pharma — Orders</h1><p style="color:#888;font-size:11px">Generated: '+todayStr()+' · '+list.length+' orders</p>';
  list.forEach(function(o){
    const items=o.items||[];
    html+='<table><tr style="background:#f7f3ee"><td colspan="4"><strong>'+esc(o.orderNo)+'</strong> — '+esc(o.status||'New')+'</td><td style="text-align:right">'+esc(o.date)+'</td></tr>';
    html+='<tr><td colspan="2">🏪 '+esc(o.partyName||'—')+' · '+esc(o.partyCity||'')+'</td><td colspan="3">📱 '+esc(o.partyMobile||'—')+'</td></tr>';
    if(o.remarks)html+='<tr><td colspan="5" style="color:#888">📝 '+esc(o.remarks)+'</td></tr>';
    html+='<tr><th>Product</th><th>Code</th><th style="text-align:center">Loose</th><th style="text-align:center">Box</th><th style="text-align:center">Case</th></tr>';
    items.forEach(function(i,idx){html+='<tr style="background:'+(idx%2?'#f7f3ee':'#fff')+'"><td>'+esc(i.name||'')+'</td><td style="color:#0b6e72">'+esc(i.masterCode||'—')+'</td><td style="text-align:center">'+(i.looseQty||0)+'</td><td style="text-align:center;font-weight:bold">'+(i.boxQty||0)+'</td><td style="text-align:center">'+(i.caseQty||0)+'</td></tr>';});
    html+='</table>';
  });
  html+='</body></html>';
  win.document.write(html);win.document.close();win.focus();setTimeout(function(){win.print();},600);
  toast('Print dialog opened','ok');
}

function sendDailySummaryWa(){
  const today=adminOrders.filter(function(o){return isToday(o.date);});
  if(!today.length){toast('No orders today','inf');return;}
  let msg='🏥 *JAI AMBE PHARMA — DAILY SUMMARY*\n📅 '+todayStr()+'\n━━━━━━━━━━━━━━\n';
  msg+='📦 Total: '+today.length+' | 🆕 New: '+today.filter(function(o){return o.status==='New';}).length+' | ⏳ Processing: '+today.filter(function(o){return o.status==='Processing';}).length+' | ✅ Done: '+today.filter(function(o){return o.status==='Done';}).length+'\n━━━━━━━━━━━━━━\n\n';
  today.forEach(function(o,idx){msg+='*'+(idx+1)+'. '+o.orderNo+'* — '+(o.partyName||'')+'\n📱 '+(o.partyMobile||'')+' · '+(o.items||[]).length+' products\n\n';});
  msg+='_Jai Ambe Pharma, Hubballi_';
  const a=document.createElement('a');a.href='https://wa.me/'+(localStorage.getItem(LS.WA_NUM)||DEFAULT_WA)+'?text='+encodeURIComponent(msg);
  a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);
}

/* ══════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════ */
function saveUrl(){
  const raw=document.getElementById('sheet-url').value.trim();
  const url=normaliseSheetUrl(raw);
  if(!url){toast('Enter a URL','err');return;}
  if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/i.test(url)){
    toast('Use the Apps Script Web App /exec URL','err');
    return;
  }
  setSheetUrl(url);
  document.getElementById('sheet-url').value=url;
  localStorage.removeItem(LS.PRODUCTS);
  localStorage.removeItem(LS.PRODUCTS_TS);
  localStorage.removeItem(LS.OFFERS);
  localStorage.removeItem(LS.OFFERS_TS);
  localStorage.removeItem(LS.COMPANIES);
  auditLog('sync','Sheet URL updated');
  toast('URL saved!','ok');testConn();
}

async function testConn(){
  const url=localStorage.getItem(LS.SHEET_URL);
  if(!url){toast('Save a URL first','err');return;}
  updateConnBadge('none');toast('Testing…','inf');
  try{
    const clean=normaliseSheetUrl(url);
    const res=await apiFetchTimeout(clean+'?action=ping&_='+Date.now(),12000);
    if(res&&res.ok){updateConnBadge('ok');toast('Connected ✓ '+( res.msg||''),'ok');}
    else{updateConnBadge('err');toast('Error: '+(res&&res.msg||'no response'),'err');}
  }catch(e){
    updateConnBadge('err');
    if((e.message||'').includes('Non-JSON'))toast('Got HTML — redeploy Apps Script as New Version!','err');
    else toast('Connection failed: '+(e.message||'').slice(0,50),'err');
  }
}

function updateConnBadge(state){
  const el=document.getElementById('conn-badge');if(!el)return;
  el.className='conn-badge '+state;
  el.textContent=state==='ok'?'Connected ✓':state==='err'?'Error ✗':'Not configured';
}

function saveWa(){
  const num=document.getElementById('wa-num').value.trim();
  localStorage.setItem(LS.WA_NUM,num||DEFAULT_WA);
  toast('WhatsApp saved','ok');
}

function saveThresholds(){
  _thresholds.reorder=parseInt(document.getElementById('thresh-reorder')?.value||'3');
  _thresholds.slow=parseInt(document.getElementById('thresh-slow')?.value||'2');
  localStorage.setItem('jap_thresholds',JSON.stringify(_thresholds));
  toast('Thresholds saved ✓','ok');
  auditLog('sync','Inventory thresholds updated');
}

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */
function loadStats(){
  const url=localStorage.getItem(LS.SHEET_URL);if(!url)return;
  apiFetchTimeout(url+'?action=stats&token='+adminToken(),20000).then(function(res){
    if(res&&res.ok){adminStats=res;buildCharts();buildAnalytics();buildForecast();buildInventory();buildAutoInsights();}
  }).catch(function(){});
}

function updateStat(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
function setElText(id,t){const el=document.getElementById(id);if(el)el.textContent=t;}
function setElHTML(id,h){const el=document.getElementById(id);if(el)el.innerHTML=h;}

function isThisWeek(dateStr){
  if(!dateStr)return false;const p=dateStr.split('/');if(p.length!==3)return false;
  const d=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));
  const now=new Date(),dow=now.getDay()||7;
  const mon=new Date(now);mon.setDate(now.getDate()-dow+1);mon.setHours(0,0,0,0);
  return d>=mon;
}
function isThisMonth(dateStr){
  if(!dateStr)return false;const p=dateStr.split('/');if(p.length!==3)return false;
  const now=new Date();return parseInt(p[1])===now.getMonth()+1&&parseInt(p[2])===now.getFullYear();
}
function loadingHTML(msg){return '<div class="loading-box"><div class="spinner"></div>'+(msg?'<p>'+esc(msg)+'</p>':'')+'</div>';}
function emptyHTML(icon,title,sub){return '<div style="text-align:center;padding:40px 20px"><div style="font-size:40px;margin-bottom:10px">'+icon+'</div><strong style="font-size:14px">'+esc(title)+'</strong><p style="font-size:13px;color:#6b6560;margin-top:4px">'+esc(sub)+'</p></div>';}
function errorHTML(msg){return '<div style="text-align:center;padding:40px 20px"><div style="font-size:40px">❌</div><strong>Error</strong><p style="font-size:13px;color:#6b6560">'+esc(msg)+'</p><button class="btn btn-sm btn-outline" style="margin-top:12px" onclick="loadOrders()">🔄 Retry</button></div>';}
/* ── AI Configuration ──────────────────────────── */
function saveAIConfig() {
  const provider = document.getElementById('ai-provider-select')?.value || 'claude';
  const apiKey   = (document.getElementById('ai-api-key-input')?.value || '').trim();
  const model    = document.getElementById('ai-model-select')?.value || '';
  if (!apiKey) { toast('Enter an API key', 'err'); return; }
  localStorage.setItem('jap_ai_provider', provider);
  localStorage.setItem('jap_ai_api_key',  apiKey);
  if (model) localStorage.setItem('jap_ai_model', model);
  auditLog('sync', 'AI config updated: '+provider);
  toast('AI configuration saved ✓', 'ok');
}

function onAIProviderChange() {
  const provider = document.getElementById('ai-provider-select')?.value || 'claude';
  const modelSel = document.getElementById('ai-model-select');
  if (!modelSel) return;
  if (provider === 'gemini') {
    modelSel.innerHTML =
      '<option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>'
      +'<option value="gemini-1.5-pro">Gemini 1.5 Pro (Powerful)</option>'
      +'<option value="gemini-1.5-flash">Gemini 1.5 Flash (Balanced)</option>';
  } else {
    modelSel.innerHTML =
      '<option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>'
      +'<option value="claude-opus-4-5">Claude Opus 4.5 (Most Powerful)</option>'
      +'<option value="claude-haiku-4-5">Claude Haiku 4.5 (Fastest)</option>';
  }
  const saved = localStorage.getItem('jap_ai_model');
  if (saved) { for (let i=0;i<modelSel.options.length;i++) if(modelSel.options[i].value===saved){modelSel.selectedIndex=i;break;} }
}

function initAIConfig() {
  const provider = localStorage.getItem('jap_ai_provider') || 'claude';
  const apiKey   = '[key stored server-side]' || '';
  const provSel  = document.getElementById('ai-provider-select');
  const keyInp   = document.getElementById('ai-api-key-input');
  if (provSel) provSel.value = provider;
  if (keyInp)  keyInp.value = apiKey;
  onAIProviderChange();
}

/* ── Stock Mode (3-state) ──────────────────────── */
function saveStockMode(mode) {
  localStorage.setItem('jap_stock_mode', mode);
  // For backward compatibility
  localStorage.setItem(LS.SHOW_STOCK, mode !== 'hidden' ? 'true' : 'false');
  document.querySelectorAll('.stock-mode-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });
  const statusEl = document.getElementById('show-stock-status');
  if (statusEl) {
    statusEl.style.display = 'block';
    const msgs = { exact:'✅ Customers now see exact stock quantity', badge:'✅ Customers see In Stock / Out of Stock badges', hidden:'🚫 Stock information hidden from customers' };
    const bgs  = { exact:'#dcfce7', badge:'#dcfce7', hidden:'#fee2e2' };
    const cols = { exact:'#15803d', badge:'#15803d', hidden:'#b91c1c' };
    statusEl.textContent = msgs[mode] || '';
    statusEl.style.background = bgs[mode] || '#f0f0f0';
    statusEl.style.color = cols[mode] || '#333';
    setTimeout(function(){ statusEl.style.display='none'; }, 3500);
  }
  auditLog('sync', 'Stock display mode set to: '+mode);
  toast('Stock display: ' + mode + ' ✓', 'ok');
}

function initStockModeButtons() {
  const mode = localStorage.getItem('jap_stock_mode') || (localStorage.getItem(LS.SHOW_STOCK) === 'false' ? 'hidden' : 'badge');
  document.querySelectorAll('.stock-mode-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });
}

/* ── Show Stock toggle (legacy compat) ─────────── */
function initShowStockToggle() {
  initStockModeButtons();
  initAIConfig();
}
function applyShowStockUI(isOn, slider, knob) {
  if (!slider) {
    slider = document.getElementById('show-stock-slider');
    knob   = document.getElementById('show-stock-knob');
  }
  if (slider) slider.style.background = isOn ? '#0b6e72' : '#e5e7eb';
  if (knob)   knob.style.left          = isOn ? '27px'   : '3px';
}
function saveShowStock(isOn) {
  saveStockMode(isOn ? 'badge' : 'hidden');
}

function noSheetMsg(){return '<div style="text-align:center;padding:40px 20px"><div style="font-size:40px">⚙️</div><strong>Sheet not configured</strong><p style="font-size:13px;color:#6b6560">Go to Settings tab and add your Apps Script URL</p></div>';}
function formatDuration(secs){if(!secs||isNaN(secs))return '';if(secs<60)return secs+'s';return Math.floor(secs/60)+'m'+(secs%60>0?' '+secs%60+'s':'');}
