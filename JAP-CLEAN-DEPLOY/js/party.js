/* ============================================================
   JAI AMBE PHARMA — party.js  v9  FINAL
   Bug Fixes:
   - Scroll/pagination: IntersectionObserver now uses .app-body
     as root (not null/viewport) — fixes products not loading on scroll
   - Quick Order: paginated rendering, proper grid bottom padding
   - Offers inputs: iOS touch fix, pointer-events, reflow on tab switch
   - Notifications: 60s polling, browser push, in-app banner, dedup
   - iOS PWA: smart Add-to-Home-Screen popup, standalone detection
   ============================================================ */

let partyUser    = null;
let allProducts  = [];
let allOffers    = []; // legacy cache key — special schemes tab uses allSpecialSchemes
let allSpecialSchemes = [];
let allNearExpiryData     = []; // from dedicated "Near Expiry" sheet (req #3)
let allSpecialSchemesData = []; // from dedicated "Special Schemes" sheet (req #3)
let filtered     = [];
let displayed    = 0;
const PAGE       = 40;
let activeFilter = 'all';
let searchQ      = '';
let sortMode     = 'az';
let cart         = [];
let companies    = [];
let offersFilter = 'all';
let ssFilter     = 'all';
let neFilter     = 'all';
let qoFilter     = 'all';
let _qoSearchTimer = null;

// Quick Order pagination
let qoFiltered  = [];
let qoDisplayed = 0;
const QO_PAGE   = 40;

// Single IntersectionObserver instance — prevents stacking
let _prodObserver = null;
let _qoObserver   = null;

/* ── Init ─────────────────────────────────────────── */
function japPartyDomReady() {
  // NOTE: we deliberately do NOT wipe the data cache on boot any more. Keeping
  // it lets the app paint products instantly (fast), then refresh in the
  // background (req #2/#6). Caches are still refreshed every entry via fetch.

  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(LS.PARTY) || 'null');
  } catch(e) {
    localStorage.removeItem(LS.PARTY);
    localStorage.removeItem(LS.CART);
  }
  if (saved && saved.mobile && saved.name) {
    partyUser = saved;
    if (partyUser.permissions) delete partyUser.permissions;
    const url = localStorage.getItem(LS.SHEET_URL);

    if (partyToken()) {
      // A stored token means this device was approved. Enter immediately.
      // Never block on APPROVED flag — it can be missing on first boot,
      // old devices, or browser partial-clears. Token = proof of approval.
      localStorage.setItem(LS.APPROVED, '1'); // always stamp if token present
      enterApp();
      verifySessionInBackground(); // refresh silently; NEVER logs out
    } else {
      prefillLogin(saved);
    }
  } else if (partyToken()) {
    // FIX #5b: Token exists but profile data is missing (can happen if
    // localStorage was partially cleared). Do NOT show login — try silent
    // re-auth first so the user never sees the login screen on refresh.
    silentReauth().then(ok => {
      if (!ok) {
        fetchNotification();
        setTimeout(checkIOSInstallHint, 3000);
      }
    }).catch(() => {
      fetchNotification();
      setTimeout(checkIOSInstallHint, 3000);
    });
  } else {
    fetchNotification();
    setTimeout(checkIOSInstallHint, 3000);
  }
  const sel = document.getElementById('cols-select');
  if (sel) sel.value = localStorage.getItem('jap_cols') || '2';
  setupScrollObserver();

  // FIX 1: Register service worker and set up background notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      window._swReg = reg;
      const url = localStorage.getItem(LS.SHEET_URL);

      // Send URL to whichever SW state is active
      const sendUrl = (sw) => { if (sw && url) sw.postMessage({ type:'SET_SHEET_URL', url }); };
      sendUrl(reg.active);
      sendUrl(reg.waiting);
      sendUrl(reg.installing);

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (newSW) newSW.addEventListener('statechange', () => { sendUrl(newSW); });
      });

      // Register periodic background sync (Chrome/Android PWA)
      if ('periodicSync' in reg) {
        navigator.permissions.query({ name:'periodic-background-sync' }).then(status => {
          if (status.state === 'granted') {
            reg.periodicSync.register('jap-notif', { minInterval: 15 * 60 * 1000 }).catch(() => {});
          }
        }).catch(() => {});
      }

      // Also trigger a one-time sync to seed the URL into cache immediately
      if ('sync' in reg) reg.sync.register('jap-notif-sync').catch(() => {});

    }).catch(() => {});

    // Listen for messages FROM the service worker
    navigator.serviceWorker.addEventListener('message', e => {
      const msg = e.data || {};
      // SW asks page for sheet URL (when app was closed, SW needs URL)
      if (msg.type === 'GET_SHEET_URL') {
        e.ports?.[0]?.postMessage({ url: localStorage.getItem(LS.SHEET_URL) || null });
      }
      // SW detected a new notification — show in-app banner
      if (msg.type === 'NEW_NOTIFICATION' && msg.title) {
        showNotificationBanner(msg.title, msg.body || '', true);
      }
    });
  }
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', japPartyDomReady);
} else {
  japPartyDomReady();
}

/* ── iOS Install Hint ─────────────────────────────── */
function checkIOSInstallHint() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true;
  const dismissed = localStorage.getItem('jap_ios_hint_dismissed');
  if (isIOS && !isStandalone && !dismissed) {
    const hint = document.getElementById('ios-hint');
    if (hint) hint.style.display = 'block';
  }
}

function dismissIOSHint() {
  localStorage.setItem('jap_ios_hint_dismissed', '1');
  const hint = document.getElementById('ios-hint');
  if (hint) hint.style.display = 'none';
}

/* ── Scroll Observer ──────────────────────────────── */
/*
 * CRITICAL FIX: #page-app is position:fixed + overflow:hidden.
 * .app-body is the ONLY scroll container (overflow-y: auto).
 * IntersectionObserver with root:null (viewport) cannot detect
 * scroll position inside .app-body — it sees the sentinel as
 * always in viewport, loading everything at once.
 * FIX: Use root: appBody so observer tracks .app-body scroll.
 */
function setupScrollObserver() {
  const sentinel = document.getElementById('load-more-sentinel');
  if (!sentinel) return;

  const appBody = document.querySelector('.app-body');

  // Scroll event fallbacks (belt-and-suspenders for old iOS)
  if (appBody) {
    appBody.removeEventListener('scroll', _onAppBodyScroll);
    appBody.addEventListener('scroll', _onAppBodyScroll, { passive: true });
  }
  window.removeEventListener('scroll', _onWindowScroll);
  window.addEventListener('scroll', _onWindowScroll, { passive: true });

  if (!window.IntersectionObserver) return;

  // Disconnect previous observer before creating new one
  if (_prodObserver) { _prodObserver.disconnect(); _prodObserver = null; }

  _prodObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && displayed < filtered.length) loadMore();
  }, {
    root      : appBody || null, // KEY FIX: use app-body, not viewport
    rootMargin: '300px',
    threshold : 0,
  });
  _prodObserver.observe(sentinel);
}

function setupQOScrollObserver() {
  const sentinel = document.getElementById('qo-load-sentinel');
  if (!sentinel) return;

  const appBody = document.querySelector('.app-body');
  if (!window.IntersectionObserver) return;

  if (_qoObserver) { _qoObserver.disconnect(); _qoObserver = null; }

  _qoObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && qoDisplayed < qoFiltered.length) loadMoreQO();
  }, {
    root      : appBody || null,
    rootMargin: '300px',
    threshold : 0,
  });
  _qoObserver.observe(sentinel);
}

function _onAppBodyScroll() {
  const appBody = document.querySelector('.app-body');
  if (!appBody) return;
  const nearBottom = appBody.scrollTop + appBody.clientHeight >= appBody.scrollHeight - 600;
  if (nearBottom) {
    if (displayed < filtered.length) loadMore();
    if (qoDisplayed < qoFiltered.length && document.getElementById('tab-quickorder')?.classList.contains('on')) loadMoreQO();
  }
}
function _onWindowScroll() {
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 600) {
    if (displayed < filtered.length) loadMore();
  }
}

/* ── Notifications ────────────────────────────────── */
async function fetchNotification() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  try {
    const res = await apiFetchTimeout(url + '?action=notification', 6000);
    if (res && res.ok && res.title) showNotificationBanner(res.title, res.body || '', false);
  } catch(e) {}
}

function showNotificationBanner(title, body, inApp) {
  if (inApp) {
    const bar = document.getElementById('app-notif-bar');
    const t   = document.getElementById('app-notif-title');
    const b   = document.getElementById('app-notif-body');
    if (bar && t && b) {
      t.textContent = title;
      b.textContent = body;
      bar.style.display = 'block';
      // Auto-dismiss after 2 seconds so it never sits over the search bar
      clearTimeout(window._notifBarTimer);
      window._notifBarTimer = setTimeout(function(){ bar.style.display = 'none'; }, 2000);
      // Also push native browser notification if granted
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body, icon: '/logo-sm.png', badge: '/logo-sm.png' }); } catch(e) {}
      }
      // Also send to service worker for display
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          try {
            reg.active?.postMessage({ type: 'NOTIFICATION', title, body });
          } catch(e) {}
        }).catch(() => {});
      }
    }
  } else {
    const banner = document.getElementById('notif-banner');
    const t = document.getElementById('notif-title');
    const b = document.getElementById('notif-body');
    if (banner && t && b) { t.textContent = title; b.textContent = body; banner.style.display = 'block'; }
  }
}

/* ── Auth ─────────────────────────────────────────── */
async function doRegister() {
  const name   = (document.getElementById('reg-name')  ?.value || '').trim();
  const mobile = (document.getElementById('reg-mobile') ?.value || '').trim();
  const owner  = (document.getElementById('reg-owner')  ?.value || '').trim();
  const city   = (document.getElementById('reg-city')   ?.value || '').trim();
  const email  = (document.getElementById('reg-email')  ?.value || '').trim();
  const altPhone = (document.getElementById('reg-altphone')?.value || '').trim();
  const errEl  = document.getElementById('login-error');

  if (!name)                    { showErr('Shop name is required'); return; }
  if (!owner)                   { showErr('Owner name is required'); return; }
  if (!city)                    { showErr('City is required'); return; }
  if (!/^\d{10}$/.test(mobile)) { showErr('Enter valid 10-digit mobile'); return; }
  if (altPhone && !/^\d{10}$/.test(altPhone)) { showErr('Alternate phone must be 10 digits'); return; }
  if (errEl) errEl.style.display = 'none';

  const mobNorm = normalizeMobile(mobile);
  partyUser = { name, mobile: mobNorm, city, id: 'P' + Date.now() };
  savePartyProfileLocal();

  const btn = document.getElementById('reg-btn');
  if (btn) { btn.textContent = 'Submitting…'; btn.disabled = true; }

  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) { showErr('App not configured. Please contact support.'); if(btn){btn.textContent='Enter Portal →';btn.disabled=false;} return; }

  try {
    const fp = await getDeviceFingerprint();
    const dmodel = await getDeviceModel();
    let loc = '';
    try {
      if (navigator.geolocation) {
        await new Promise(function(resolve) {
          navigator.geolocation.getCurrentPosition(
            function(pos) { loc = pos.coords.latitude.toFixed(5)+','+pos.coords.longitude.toFixed(5); resolve(); },
            function() { resolve(); },
            { timeout: 4000, maximumAge: 600000 }
          );
        });
      }
    } catch(e) {}
    const res = await apiPost(url, {
      action:'party', name, mobile: mobNorm, city, owner, email, altPhone,
      location: loc, browserType: getBrowserType(), deviceName: dmodel,
      deviceId: getDeviceId(), deviceType: getDeviceType(), fingerprint: fp, deviceModel: dmodel
    });
    if (btn) { btn.textContent = 'Enter Portal →'; btn.disabled = false; }
    if (res && res.ok === false) { showErr(res.msg || 'Could not log in'); return; }
    if (res && res.approved && res.token) {
      toast('Welcome, ' + name + '! 🎉', 'ok');
      applyPartyAuth(res);
      return;
    }
    applyPartyAuth(res || { ok: true, pending: true, deviceCode: deviceCode() });
    if (!document.getElementById('page-pending')) {
      showErr('Registration received. Admin must approve your device on the Devices sheet, then tap Enter Portal again.');
    }
  } catch(e) {
    if (btn) { btn.textContent = 'Enter Portal →'; btn.disabled = false; }
    showErr('Could not reach server. Check internet and that Apps Script is deployed. Then retry.');
  }
}

function prefillLogin(saved) {
  try {
    if (document.getElementById('reg-name'))   document.getElementById('reg-name').value   = saved.name||'';
    if (document.getElementById('reg-mobile')) document.getElementById('reg-mobile').value = saved.mobile||'';
    if (document.getElementById('reg-city'))   document.getElementById('reg-city').value   = saved.city||'';
  } catch(e) {}
}
function forceReLogin(msg) {
  // SAFE: Once a device is approved, it NEVER gets logged out automatically.
  // This function is kept for backward compat but only shows a toast.
  if (msg) toast(msg, 'inf');
  return;  // ← hard stop. Code below never executes.
  _stopPermissionPolling();
  clearPartyToken();
  var app=document.getElementById('page-app'), pend=document.getElementById('page-pending'), auth=document.getElementById('page-auth');
  if (app) app.style.display='none';
  if (pend) pend.style.display='none';
  if (auth) auth.style.display='flex';
  prefillLogin(partyUser||{});
  showErr(msg || 'Please log in again.');
}

/* ── Party permissions (Parties sheet columns → app, live from server) ── */
function parsePartyPermissions(raw) {
  const out = Object.assign({}, PARTY_PERM_DEFAULTS);
  if (!raw) return out;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    PARTY_PERM_KEYS.forEach(k => { if (raw[k] !== undefined && raw[k] !== null) out[k] = !!raw[k]; });
    return out;
  }
  const s = String(raw).trim();
  if (!s || s === '[object Object]') return out;
  try {
    const p = JSON.parse(s);
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      PARTY_PERM_KEYS.forEach(k => { if (p[k] !== undefined && p[k] !== null) out[k] = !!p[k]; });
    }
  } catch(e) {}
  return out;
}

const PERM_HEADER_TO_KEY = {
  hidestockbadge: 'removeAvailability',
  hidestock: 'removeAvailability',
  showavailablelabel: 'showAvailableLabel',
  showexactqty: 'showExactQty',
  hideproductschemes: 'hideScheme',
  hidescheme: 'hideScheme',
  hidespecialschemebanner: 'hideSpecialScheme',
  hidespecialschemestab: 'hideOffers',
  hideoffers: 'hideOffers',
  hidenotifications: 'hideNotifications',
  hidewhatsapp: 'hideWhatsApp'
};

function parsePermsFromPartyRow(party) {
  const out = Object.assign({}, PARTY_PERM_DEFAULTS);
  if (!party || typeof party !== 'object') return out;
  if (party.perms && typeof party.perms === 'object') {
    return parsePartyPermissions(party.perms);
  }
  PARTY_PERM_KEYS.forEach(k => {
    const v = party[k] !== undefined ? party[k] : party[k.toLowerCase()];
    if (v === undefined || v === null || v === '') return;
    if (typeof v === 'boolean') { out[k] = v; return; }
    out[k] = /^true|yes|1|y$/i.test(String(v).trim());
  });
  Object.keys(party).forEach(hk => {
    const mapped = PERM_HEADER_TO_KEY[hk];
    if (!mapped) return;
    const v = party[hk];
    if (v === undefined || v === null || v === '') return;
    if (typeof v === 'boolean') out[mapped] = v;
    else out[mapped] = /^true|yes|1|y$/i.test(String(v).trim());
  });
  if (party.permissions) {
    const parsed = parsePartyPermissions(party.permissions);
    PARTY_PERM_KEYS.forEach(k => {
      if (party[k] !== undefined && party[k] !== '') return;
      out[k] = parsed[k];
    });
  }
  return out;
}

function savePartyProfileLocal() {
  if (!partyUser) return;
  const copy = Object.assign({}, partyUser);
  delete copy.permissions;
  delete copy.perms;
  localStorage.setItem(LS.PARTY, JSON.stringify(copy));
}

function showPermsGate(show) {
  let el = document.getElementById('perms-gate');
  if (!el && show) {
    el = document.createElement('div');
    el.id = 'perms-gate';
    el.innerHTML = '<div class="perms-gate-card"><div class="spinner"></div><p>Loading your account settings…</p></div>';
    const app = document.getElementById('page-app');
    if (app) app.appendChild(el);
  }
  if (el) el.style.display = show ? 'flex' : 'none';
}

function _startPermissionPolling() {
  if (window._permPoll) clearInterval(window._permPoll);
  window._permPoll = setInterval(() => {
    refreshPartyPermissions().then(applyPartyPermissionsUI);
  }, 300000); // 5 min — permissions rarely change
}

function _stopPermissionPolling() {
  if (window._permPoll) { clearInterval(window._permPoll); window._permPoll = null; }
}

async function refreshPartyPermissions() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url || !partyUser || !partyUser.mobile) return false;
  const mob = normalizeMobile(partyUser.mobile);
  const dev = getDeviceId();
  partyUser.mobile = mob;
  try {
    const bust = '&_=' + Date.now() + '&r=' + Math.random().toString(36).slice(2);
    const res = await apiFetchTimeout(
      url + '?action=partyPermissions&mobile=' + encodeURIComponent(mob)
        + '&deviceId=' + encodeURIComponent(dev) + dataAuthParam() + bust,
      15000
    );
    if (res && res.needAuth) {
      console.warn('[JAP] permissions: session not accepted by server');
      return false;
    }
    if (res && res.ok !== false) {
      let perms;
      if (res.perms && typeof res.perms === 'object') perms = parsePartyPermissions(res.perms);
      else if (res.grants && typeof res.grants === 'object') perms = parsePartyPermissions(grantsToAppPermsClient(res.grants));
      else perms = parsePartyPermissions(res.permissions || '');
      partyUser.permissions = perms;
      window._permsLoadedAt = Date.now();
      savePartyProfileLocal();
      return true;
    }
    console.warn('[JAP] partyPermissions failed:', res && res.msg);
  } catch(e) {
    console.warn('[JAP] partyPermissions error:', e.message || e);
  }
  return false;
}

function grantsToAppPermsClient(grants) {
  grants = grants || {};
  return {
    removeAvailability: grants.showStockBadge === false,
    showAvailableLabel: !!grants.showAvailableLabel,
    showExactQty: !!grants.showExactQty,
    hideScheme: grants.showProductSchemes === false,
    hideSpecialScheme: grants.showSpecialSchemeBanner === false,
    hideOffers: grants.showSpecialSchemesTab === false,
    hideNotifications: grants.showNotifications === false,
    hideWhatsApp: grants.showWhatsApp === false
  };
}

async function ensurePartyPermissionsLoaded() {
  if (!partyUser) return true;
  if (!partyUser.permissions) partyUser.permissions = Object.assign({}, PARTY_PERM_DEFAULTS);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await refreshPartyPermissions()) return true;
    await new Promise(r => setTimeout(r, 400 + attempt * 300));
  }
  partyUser.permissions = Object.assign({}, PARTY_PERM_DEFAULTS);
  return true;
}

/* ── Approval / token plumbing ────────────────────── */
function applyPartyAuth(res, opts) {
  opts = opts || {};
  if (!res) {
    if (!opts.silentEnter) showErr('Could not reach server. Please retry.');
    return false;
  }
  if (res.ok === false) {
    if (!opts.silentEnter) showErr(res.msg || 'Could not log in. Please retry.');
    return false;
  }
  if (res.perms && typeof res.perms === 'object') {
    partyUser.permissions = parsePartyPermissions(res.perms);
  }
  if (res.party) {
    if (res.party.id) partyUser.id = res.party.id;
    if (res.party.name) partyUser.name = res.party.name;
    if (res.party.mobile) partyUser.mobile = normalizeMobile(res.party.mobile);
    if (!partyUser.permissions) {
      partyUser.permissions = res.party.perms
        ? parsePartyPermissions(res.party.perms)
        : parsePermsFromPartyRow(res.party);
    }
    savePartyProfileLocal();
    const chip = document.getElementById('party-chip');
    if (chip && partyUser.name) chip.textContent = partyUser.name + (partyUser.city ? ' · ' + partyUser.city : '');
  }
  if (res.approved && res.token) {
    setPartyToken(res.token);
    localStorage.setItem(LS.APPROVED, '1');
    restoreFavouritesFromServer(res.favJson);
    restorePartyOrders();
    mergeSheetFavourites();
    if (!opts.silentEnter) {
      hideAwaitingApproval();
      enterApp();
    }
    return true;
  }
  clearPartyToken();
  if (res.deviceCode) {
    const dc = document.getElementById('pending-devicecode');
    if (dc) dc.textContent = res.deviceCode;
  }
  showAwaitingApproval(res.msg || '');
  return false;
}

async function verifySessionAndEnter() {
  if (!partyUser || !partyUser.mobile) {
    // FIX #5c: Do NOT clear the token — just return; silentReauth will
    // recover the session on the next check.
    return;
  }
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) {
    enterApp();
    return;
  }
  try {
    const fp = await getDeviceFingerprint();
    const dmodel = await getDeviceModel();
    const res = await apiPost(url, {
      action: 'party',
      name: partyUser.name || '',
      mobile: normalizeMobile(partyUser.mobile),
      city: partyUser.city || '',
      deviceId: getDeviceId(),
      deviceType: getDeviceType(),
      fingerprint: fp,
      deviceModel: dmodel
    });
    if (res && res.approved && res.token) {
      applyPartyAuth(res, { silentEnter: true });
      return;
    }
    if (res && res.ok !== false && (res.pending || !res.approved)) {
      // SAFE: don't clear session on 'pending'. User stays in app.
      // They can check back later or admin can approve.
      return;
    }
    if (res && res.needAuth) {
      // SAFE: don't clear on needAuth either — token may still be valid.
      silentReauth().catch(function(){});
      return;
    }
    enterApp();
  } catch(e) {
    enterApp();
  }
}

/* ── Background session refresh (req #4) ───────────────────────────
   Re-confirms approval and refreshes profile/permissions WITHOUT ever
   logging the user out. If the server returns a fresh token we store it;
   otherwise we leave the existing session completely untouched. */
async function verifySessionInBackground() {
  // Lightweight: uses read-only partyStatus instead of heavy action:party.
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url || !partyUser || !partyUser.mobile) return;
  try {
    const mob = normalizeMobile(partyUser.mobile);
    const res = await apiFetchTimeout(
      url + '?action=partyStatus&mobile=' + encodeURIComponent(mob)
          + '&token=' + encodeURIComponent(partyToken() || ''),
      8000
    );
    if (res && res.approved) localStorage.setItem(LS.APPROVED, '1');
  } catch(e) {}
}

/* Silent token refresh used if a data call ever reports needAuth. Keeps the
   user on the current screen; only swaps in a new token if approved. */
async function silentReauth() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url || !partyUser || !partyUser.mobile) return false;
  if (_partyUpsertBusy) return false;
  _partyUpsertBusy = true;
  try {
    const fp = await getDeviceFingerprint();
    const dmodel = await getDeviceModel();
    const res = await apiPost(url, {
      action: 'party', name: partyUser.name || '', mobile: normalizeMobile(partyUser.mobile),
      city: partyUser.city || '', deviceId: getDeviceId(), deviceType: getDeviceType(),
      fingerprint: fp, deviceModel: dmodel
    });
    if (res && res.approved && res.token) { setPartyToken(res.token); localStorage.setItem(LS.APPROVED, '1'); return true; }
  } catch(e) {}
  finally { _partyUpsertBusy = false; }
  return false;
}

function showAwaitingApproval(msg) {
  if (!_pendingCheckInterval) {
    _pendingCheckInterval = setInterval(function(){ recheckApproval(); }, 30000);
  }
  const auth = document.getElementById('page-auth');
  const app  = document.getElementById('page-app');
  const pend = document.getElementById('page-pending');
  if (app)  app.style.display  = 'none';
  if (auth) auth.style.display = 'none';
  if (pend) {
    pend.style.display = 'flex';
    const m = document.getElementById('pending-msg');
    if (m && msg) {
      m.innerHTML = '<p style="margin:0">' + String(msg).replace(/</g,'&lt;') + '</p>';
    }
    const who = document.getElementById('pending-who');
    if (who && partyUser) who.textContent = (partyUser.name||'') + (partyUser.mobile ? (' · ' + partyUser.mobile) : '');
    const dc = document.getElementById('pending-devicecode');
    if (dc) dc.textContent = deviceCode();
  } else {
    // Fallback: no pending screen in DOM — show auth page with a message
    if (auth) auth.style.display = 'flex';
    showErr(msg || 'Your account is awaiting admin approval.');
  }
}
function hideAwaitingApproval() {
  const pend = document.getElementById('page-pending');
  if (pend) pend.style.display = 'none';
}
async function recheckApproval() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url || !partyUser) return;
  const btn = document.getElementById('pending-recheck-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  const fp = await getDeviceFingerprint();
  const dmodel = await getDeviceModel();
  apiPost(url, { action:'party', name:partyUser.name, mobile:normalizeMobile(partyUser.mobile), city:partyUser.city||'', deviceId: getDeviceId(), deviceType: getDeviceType(), fingerprint: fp, deviceModel: dmodel })
    .then(res => {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Check Again'; }
      if (res && res.approved && res.token) { applyPartyAuth(res); }
      else if (res && res.ok === false) { toast(res.msg || 'Could not log in', 'err'); }
      else toast('Still awaiting approval', 'inf');
    })
    .catch(() => { if (btn) { btn.disabled = false; btn.textContent = '🔄 Check Again'; } toast('Could not reach server', 'err'); });
}
function logoutPending() {
  _stopPermissionPolling();
  localStorage.removeItem(LS.PARTY);
  clearPartyToken();
  location.reload();
}

function restoreFavouritesFromServer(favJson) {
  // FIX #1: MERGE server favs with local favs — never overwrite locally-added ones.
  try {
    const local = JSON.parse(localStorage.getItem(LS.FAVORITES) || '[]');
    if (local && local.length) return;          // keep local copy if present
    if (!favJson) return;
    const arr = (typeof favJson === 'string') ? JSON.parse(favJson) : favJson;
    if (!Array.isArray(arr) || !arr.length) return;
    const favs = arr.map(fv => ({
      id: fv.id || fv.mc || fv.masterCode || '',
      name: fv.name || '',
      masterCode: fv.mc || fv.masterCode || '',
      company: fv.company || ''
    })).filter(fv => fv.id || fv.masterCode);
    // Merge: server favs first, then any local-only favs not on server
    const localFavs = getFavourites();
    const serverIds = new Set(favs.map(f => String(f.id||f.masterCode||'').toLowerCase()).filter(Boolean));
    localFavs.forEach(lf => {
      const lid = String(lf.id||lf.masterCode||'').toLowerCase();
      if (lid && !serverIds.has(lid)) favs.push(lf);
    });
    if (favs.length) localStorage.setItem(LS.FAVORITES, JSON.stringify(favs));
  } catch(e) {}
}

async function mergeSheetFavourites() {
  try {
    if (!partyUser) return;
    const sheetFavs = await fetchPartyFavourites(partyUser.mobile, (typeof deviceCode==='function'?deviceCode():''));
    if (!sheetFavs || !sheetFavs.length) return;
    let favs = [];
    try { favs = JSON.parse(localStorage.getItem(LS.FAVORITES) || '[]'); } catch(e) { favs = []; }
    const have = new Set(favs.map(fv => String(fv.id||fv.masterCode||'').toLowerCase()));
    sheetFavs.forEach(sf => {
      const key = String(sf.masterCode||'').toLowerCase();
      if (key && !have.has(key)) { favs.push({ id:sf.masterCode, masterCode:sf.masterCode, name:sf.name||'', company:'' }); have.add(key); }
    });
    localStorage.setItem(LS.FAVORITES, JSON.stringify(favs));
    if (typeof renderQuickOrder === 'function') renderQuickOrder();
  } catch(e) {}
}

function restorePartyOrders() {
  // Always fetch fresh order list + statuses from the server (Fix #2).
  // No early-return guard — we need current status every session.
  try {
    const url = localStorage.getItem(LS.SHEET_URL);
    if (!url || !partyUser) return;
    apiFetchTimeout(url + '?action=partyOrders&mobile=' + encodeURIComponent(partyUser.mobile) + dataAuthParam(), 15000)
      .then(res => {
        if (!res || !res.ok || !Array.isArray(res.orders)) return;
        // Build a map of server orders (source of truth for status)
        const serverMap = {};
        const serverMapped = res.orders.map(o => {
          const mapped = {
            oNo: o.orderNo, date: o.date,
            partyName: o.partyName, partyMobile: o.partyMobile, partyCity: o.partyCity,
            remarks: o.remarks || '',
            status: o.status || 'Sent',   // ← real status from admin (New/Processing/Done)
            items: (o.items || []).map(it => ({
              id: it.masterCode || it.productCode || '',
              name: it.name || '', masterCode: it.masterCode || '', productCode: it.productCode || '',
              company: it.company || '',
              looseQty: parseInt(it.looseQty) || 0, boxQty: parseInt(it.boxQty) || 0, caseQty: parseInt(it.caseQty) || 0,
              offer: it.scheme || ''
            })),
            count: (o.items || []).length
          };
          serverMap[o.orderNo] = true;
          return mapped;
        });
        // Merge: keep any local orders that haven't synced yet (offline queue),
        // then prepend the server list which has authoritative statuses.
        const local = JSON.parse(localStorage.getItem(LS.MY_ORDERS) || '[]');
        const localOnly = local.filter(o => !serverMap[o.oNo]);  // pending/unsynced orders
        const merged = [...localOnly, ...serverMapped];
        if (merged.length) {
          localStorage.setItem(LS.MY_ORDERS, JSON.stringify(merged));
          if (typeof renderMyOrders === 'function') renderMyOrders();
          if (typeof renderQuickOrder === 'function') renderQuickOrder();
        }
      }).catch(() => {});
  } catch(e) {}
}

/* ── Apply party-wise visibility permissions to the UI ── */
function applyPartyPermissionsUI() {
  const perms = parsePartyPermissions(partyUser && partyUser.permissions);
  if (partyUser) partyUser.permissions = perms;
  document.body.dataset.hideStock = perms.removeAvailability ? '1' : '0';

  const ssTab = document.querySelector('[data-tab="specialschemes"]');
  if (ssTab) ssTab.style.display = perms.hideOffers ? 'none' : '';

  const bell = document.getElementById('notif-bell-btn');
  if (bell) bell.style.display = perms.hideNotifications ? 'none' : '';

  const waFab = document.getElementById('global-wa-fab');
  if (waFab) waFab.style.display = perms.hideWhatsApp ? 'none' : '';

  const notifBar = document.getElementById('app-notif-bar');
  if (notifBar && perms.hideNotifications) notifBar.style.display = 'none';

  displayed = 0;
  if (allProducts.length) {
    applyFilter();
    rebuildSpecialSchemesList();
    renderQuickOrder();
    if (document.getElementById('tab-specialschemes')?.classList.contains('on')) renderSpecialSchemes();
    if (document.getElementById('tab-nearexpiry')?.classList.contains('on')) renderNearExpiry();
  }
}

function openGlobalWhatsApp() {
  const num = (localStorage.getItem(LS.WA_NUM) || DEFAULT_WA).replace(/\D/g, '');
  const shop = (partyUser && partyUser.name) ? partyUser.name : 'Party';
  const mob  = (partyUser && partyUser.mobile) ? partyUser.mobile : '';
  const text = encodeURIComponent('Hello Jai Ambe Pharma,\n\nThis is ' + shop + (mob ? ' (' + mob + ')' : '') + '.\nI need assistance.');
  window.open('https://wa.me/' + num + '?text=' + text, '_blank', 'noopener');
}

/* ── Start product & offer loading (called after permissions confirmed) ── */
function startProductLoad() {
  // FIX #2: Render from cache immediately for instant display, then
  // background-fetch everything in parallel (no more serial waits).
  renderMyOrders();
  renderQuickOrder(); // paint from localStorage cache instantly
  loadProducts();     // async — also calls renderQuickOrder when fresh data arrives
  loadDedicatedSheets();
  loadSpecialSchemes();
}

/* ── Dedicated sheets → their own tabs (req #3) ───────────────────────
   Paint from cache instantly, then refresh from the sheet in the background
   and re-render whichever tab is open. */
function loadDedicatedSheets() {
  // 1) instant paint from cache
  try { allNearExpiryData     = getCachedNearExpiry()     || []; } catch(e) { allNearExpiryData = []; }
  try { allSpecialSchemesData = getCachedSpecialSchemes() || []; } catch(e) { allSpecialSchemesData = []; }
  _renderDedicatedIfActive();

  // 2) background refresh
  fetchNearExpiry({ silent:true }).then(function(list) {
    allNearExpiryData = list || [];
    _renderDedicatedIfActive();
  }).catch(function(){});
  fetchSpecialSchemes({ silent:true }).then(function(list) {
    allSpecialSchemesData = list || [];
    _renderDedicatedIfActive();
  }).catch(function(){});
}

function _renderDedicatedIfActive() {
  if (document.getElementById('tab-nearexpiry')?.classList.contains('on'))     renderNearExpiry();
  if (document.getElementById('tab-specialschemes')?.classList.contains('on')) renderSpecialSchemes();
  if (document.getElementById('tab-offers')?.classList.contains('on'))         renderOffers();
}

/* ── Session tracking ─────────────────────────────── */
let _sessionLogged = false;

function _onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    _logSessionToServer();
  } else {
    // User came back — reset start for next segment
    _sessionLogged = false;
    window._loginStartTime = Date.now();
    refreshPartyPermissions().then(applyPartyPermissionsUI);
  }
}

function _onPageUnload() {
  _logSessionToServer();
}

function _logSessionToServer() {
  if (_sessionLogged) return;
  if (!partyUser || !partyUser.mobile || !window._loginStartTime) return;
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  const durationSecs = Math.round((Date.now() - window._loginStartTime) / 1000);
  if (durationSecs < 3) return; // ignore accidental flickers
  _sessionLogged = true;
  const loginTime = window._loginStartTime
    ? new Date(window._loginStartTime).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true})
    : '';
  const payload = JSON.stringify({
    action            : 'logSession',
    token             : partyToken(),
    mobile            : partyUser.mobile,
    name              : partyUser.name   || '',
    city              : partyUser.city   || '',
    loginTime         : loginTime,
    durationSecs      : durationSecs,
    totalOrders       : window._sessionOrders        || 0,
    ordersCount       : window._sessionOrders        || 0,
    productsTabOrders : window._sessionProductsOrdered || 0,
    productsTabCount  : window._sessionProductsOrdered || 0,
    quickBuyOrders    : window._sessionQuickBuyOrdered || 0,
    quickBuyCount     : window._sessionQuickBuyOrdered || 0,
    favsCount         : getFavourites().length,
    favProducts       : getFavourites().map(function(f){ return (f.name||f.masterCode||''); }).join(', ')
  });
  // keepalive fetch is more reliable with Apps Script (follows the 302 redirect
  // that sendBeacon does not). Beacon is only a last-resort fallback.
  try {
    fetch(url, { method:'POST', body:payload, headers:{'Content-Type':'text/plain'}, keepalive:true, redirect:'follow' }).catch(()=>{});
  } catch(e) {
    if (navigator.sendBeacon) { try { navigator.sendBeacon(url, new Blob([payload], {type:'text/plain'})); } catch(_){} }
  }
}

/* ── Favourites sync to server ────────────────────── */
let _favSyncTimer = null;
let _partyUpsertBusy = false;
let _pendingCheckInterval = null; // guards against overlapping action:'party' posts (dup-device fix)
function _scheduleFavSync() {
  if (_favSyncTimer) clearTimeout(_favSyncTimer);
  _favSyncTimer = setTimeout(_syncFavsNow, 2000); // debounce 2 s
}
function _syncFavsNow() {
  if (!partyUser || !partyUser.mobile) return;
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  const favs = getFavourites();
  apiPost(url, {
    action      : 'syncFavourites',
    token       : partyToken(),
    mobile      : partyUser.mobile,
    name        : partyUser.name || '',
    favsCount   : favs.length,
    favProducts : favs.map(function(f){ return (f.name||f.masterCode||''); }).join(', '),
    favJson     : JSON.stringify(favs.map(function(f){ return {id:f.id, name:(f.name||f.displayName||''), mc:(f.masterCode||''), company:(f.company||''), composition:(f.composition||''), boxQty:(f.boxQty||''), caseQty:(f.caseQty||''), mrp:(f.mrp||''), pts:(f.pts||f.price||''), ptr:(f.ptr||'')}; }))
  }).catch(()=>{});
}

function showErr(msg) {
  const errEl = document.getElementById('login-error');
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
}

/* ── Enter App ────────────────────────────────────── */
function enterApp() {
  if (_pendingCheckInterval) { clearInterval(_pendingCheckInterval); _pendingCheckInterval = null; }
  if (!partyUser || !partyUser.name) {
    // FIX #5: Do NOT clear the token — we may still have a valid session.
    // If a token exists, silentReauth will restore the profile on next check.
    const auth = document.getElementById('page-auth');
    if (auth) auth.style.display = 'flex';
    showErr('Please register to continue.');
    return;
  }
  const authEl = document.getElementById('page-auth');
  const appEl  = document.getElementById('page-app');
  const pendEl = document.getElementById('page-pending');
  if (authEl) authEl.style.display = 'none';
  if (pendEl) pendEl.style.display = 'none';
  if (appEl)  appEl.style.display  = 'flex';

  const chip = document.getElementById('party-chip');
  if (chip) chip.textContent = partyUser.name + (partyUser.city ? ' · ' + partyUser.city : '');

  const cols = localStorage.getItem('jap_cols') || '2';
  const sel  = document.getElementById('cols-select');
  if (sel) sel.value = cols;
  setColCount(cols);

  // Re-attach scroll observer after app-body is visible
  setTimeout(setupScrollObserver, 300);

  window._orderStartTime = Date.now();
  window._userLocation   = null;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => { window._userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => {}, { timeout: 8000, maximumAge: 60000 }
    );
  }

  // iOS PWA: ask for notifications after 4s (requires home screen install)
  if (window._shouldAskNotifPermission) setTimeout(requestNotificationPermission, 4000);
  // iOS: Show install popup if not in standalone mode
  setTimeout(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true;
    if (isIOS && !isStandalone && !localStorage.getItem('jap_ios_hint_dismissed')) {
      showIOSInstallPopup();
    }
  }, 8000);

  cart = JSON.parse(localStorage.getItem(LS.CART) || '[]');
  updateBadge();

  // Track login time
  window._loginStartTime = Date.now();
  const sheetUrl2 = localStorage.getItem(LS.SHEET_URL);
  if (sheetUrl2 && partyUser && partyUser.mobile) {
    const loginTime = new Date().toISOString();
    apiPost(sheetUrl2, { action:'logLogin', token:partyToken(), mobile:partyUser.mobile, name:partyUser.name||'', loginTime }).catch(()=>{});
  }

  try { const t = localStorage.getItem(LS.PRODUCTS); if (t) JSON.parse(t); }
  catch(e) { localStorage.removeItem(LS.PRODUCTS); localStorage.removeItem(LS.PRODUCTS_TS); }

  bootstrapAppSession();

  // ── Session tracking ─────────────────────────────
  window._sessionOrders = 0; // incremented on each order submit
  window._loginStartTime = window._loginStartTime || Date.now();

  // Fire when tab/app goes to background (mobile-reliable)
  document.addEventListener('visibilitychange', _onVisibilityChange);
  window.addEventListener('beforeunload', _onPageUnload);

  // FIX 1: Keep SW informed of sheet URL for background polling
  const sheetUrl = localStorage.getItem(LS.SHEET_URL);
  if (sheetUrl && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) reg.active.postMessage({ type:'SET_SHEET_URL', url: sheetUrl });
    }).catch(() => {});
  }
}

async function bootstrapAppSession() {
  if (!partyUser.permissions) partyUser.permissions = Object.assign({}, PARTY_PERM_DEFAULTS);
  applyPartyPermissionsUI();
  const skipLoad = window._skipProductLoad;
  window._skipProductLoad = false;
  if (!skipLoad) startProductLoad();
  ensurePartyPermissionsLoaded().then(function() {
    applyPartyPermissionsUI();
    _startPermissionPolling();
  });
  fetchInAppNotification();
  startNotificationPolling();
}

async function fetchInAppNotification() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  try {
    const res = await apiFetchTimeout(url + '?action=notification', 6000);
    if (res?.ok && res.title) {
      const key = res.title + '|' + (res.body || '');
      const last = localStorage.getItem('jap_last_notif');
      if (key !== last) {
        localStorage.setItem('jap_last_notif', key);
        loadNotificationCenter(false);                 // refresh bell badge
        pushNativeNotification(res.title, res.body || '');
      }
    }
  } catch(e) {}
}

/* ── Notification Center (bell icon) ──────────────── */
let _notifications = [];

function pushNativeNotification(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: body || '', icon: 'logo-sm.png', badge: 'logo-sm.png' });
    }
  } catch(e) {}
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      try { reg.active?.postMessage({ type:'NOTIFICATION', title, body }); } catch(e) {}
    }).catch(() => {});
  }
}

async function loadNotificationCenter(render) {
  _notifications = await fetchNotifications();
  updateNotifBadge();
  if (render) renderNotificationCenter();
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-bell-badge');
  if (!badge) return;
  const seen = Number(localStorage.getItem(LS.NOTIF_SEEN) || 0);
  let unread = 0;
  _notifications.forEach(n => {
    const ts = Date.parse(n.timestamp) || 0;
    if (ts > seen) unread++;
    else if (!ts && !seen) unread++;
  });
  if (unread > 0) { badge.textContent = unread > 9 ? '9+' : String(unread); badge.style.display = 'flex'; }
  else badge.style.display = 'none';
}

function openNotificationCenter() {
  const el = document.getElementById('notif-center');
  if (!el) return;
  el.style.display = 'block';
  renderNotificationCenter();
  localStorage.setItem(LS.NOTIF_SEEN, String(Date.now()));
  updateNotifBadge();
  loadNotificationCenter(true);   // refresh from server
}
function closeNotificationCenter() {
  const el = document.getElementById('notif-center');
  if (el) el.style.display = 'none';
}

function renderNotificationCenter() {
  const list = document.getElementById('notif-center-list');
  if (!list) return;
  if (!_notifications.length) {
    list.innerHTML = '<div style="text-align:center;color:#888;padding:46px 0"><div style="font-size:42px">🔕</div><p>No notifications yet</p></div>';
    return;
  }
  list.innerHTML = _notifications.map((n, i) => {
    const img = n.image ? '<img src="'+esc(n.image)+'" alt="" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;margin-bottom:8px" onerror="this.style.display=&quot;none&quot;">' : '';
    const hasLink = n.link || n.productCode;
    const linkBtn = hasLink ? '<button onclick="notifAction('+i+')" style="margin-top:9px;background:#0b6e72;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit">'+(n.productCode?'View Product →':'Open Link →')+'</button>' : '';
    return '<div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:12px 14px;margin-bottom:10px">'
      + img
      + '<div style="font-weight:700;font-size:14px;color:#0b3d40;margin-bottom:3px">'+esc(n.title||'')+'</div>'
      + (n.description ? '<div style="font-size:12.5px;color:#555;line-height:1.45">'+esc(n.description)+'</div>' : '')
      + (n.timestamp ? '<div style="font-size:10.5px;color:#aaa;margin-top:5px">'+esc(formatNotifTime(n.timestamp))+'</div>' : '')
      + linkBtn
      + '</div>';
  }).join('');
}

function formatNotifTime(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function notifAction(i) {
  const n = _notifications[i];
  if (!n) return;
  if (n.productCode) { closeNotificationCenter(); openProductByCode(n.productCode); return; }
  if (n.link) {
    // Only follow http/https links (block javascript:, data:, etc.)
    if (!/^https?:\/\//i.test(String(n.link).trim())) { toast('This notification has an invalid link', 'err'); return; }
    const a = document.createElement('a'); a.href = n.link; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

/* Deep-link: open a product by its master/product code */
function openProductByCode(code) {
  const c = String(code || '').trim();
  if (!c) return;
  switchTab('products', document.querySelector('[data-tab="products"]'));
  const search = document.getElementById('prod-search');
  if (search) search.value = c;
  if (typeof onSearch === 'function') onSearch();
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.classList.remove('hidden');
  toast('Showing: ' + c, 'inf');
}

/* ── Notification Polling — 60 second interval ────── */
function startNotificationPolling() {
  const _perms = parsePartyPermissions(partyUser && partyUser.permissions);
  if (_perms.hideNotifications) return;
  // Clear any existing interval
  if (window._notifPollInterval) {
    clearInterval(window._notifPollInterval);
    window._notifPollInterval = null;
  }
  // Poll every 60 seconds for new notifications
  // Adaptive poll: starts at 60s, backs off to 5min when no new notifications
  let _notifBackoff = 60000;
  async function _adaptivePoll() {
    const prevLen = _notifications.length;
    await pollSheetNotifications();
    _notifBackoff = _notifications.length > prevLen ? 60000 : Math.min(_notifBackoff * 1.5, 300000);
    window._notifPollTimer = setTimeout(_adaptivePoll, _notifBackoff);
  }
  window._notifPollTimer = setTimeout(_adaptivePoll, 60000);
  // Populate the bell badge immediately on entry
  loadNotificationCenter(false);
}

async function pollSheetNotifications() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  try {
    const res = await apiFetchTimeout(url + '?action=notification', 5000);
    if (!res?.ok || !res.title) return;
    const newKey = res.title + '|' + (res.body || '');
    const oldKey = localStorage.getItem('jap_last_notif');
    if (newKey === oldKey) return; // same — skip
    localStorage.setItem('jap_last_notif', newKey);
    loadNotificationCenter(false);                     // refresh bell badge
    pushNativeNotification(res.title, res.body || '');
  } catch(e) {}
}

/* ── iOS PWA / Notifications ──────────────────────── */
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { subscribeToNotifications(); return; }
  if (Notification.permission === 'denied') return;

  const isIOS        = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true ||
                       window.matchMedia('(display-mode: standalone)').matches;

  // iOS 16.4+ REQUIREMENT: Must be in standalone mode to request notifications
  if (isIOS && !isStandalone) {
    // Can't ask yet — user needs to add to home screen first
    return;
  }

  Notification.requestPermission().then(perm => {
    if (perm === 'granted') {
      toast('Notifications enabled ✓', 'ok');
      subscribeToNotifications();
    }
  });
}

function subscribeToNotifications() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(() => {
    // Polling is already started — nothing else needed for sheet-based notifications
  }).catch(() => {});
}

function showIOSInstallPopup() {
  // Don't show if already standalone or already dismissed this session
  if (window.navigator.standalone === true) return;
  const existing = document.getElementById('ios-install-popup');
  if (existing) { existing.style.display = 'flex'; return; }

  const popup = document.createElement('div');
  popup.id = 'ios-install-popup';
  popup.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box';
  popup.innerHTML = `
    <div style="background:#fff;border-radius:22px;padding:26px 22px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 -4px 40px rgba(0,0,0,.25);position:relative">
      <button onclick="dismissIOSPopup()" style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:22px;color:#aaa;cursor:pointer;line-height:1">×</button>
      <div style="font-size:42px;margin-bottom:10px">📱</div>
      <div style="font-size:17px;font-weight:700;color:#1a1a1a;margin-bottom:8px">Add to Home Screen</div>
      <p style="font-size:13.5px;color:#666;margin-bottom:18px;line-height:1.6">
        Install this app for the best experience and to receive order notifications.
      </p>
      <div style="background:#f0f7ff;border-radius:14px;padding:16px 14px;margin-bottom:18px;text-align:left;line-height:2.1;font-size:13px;color:#1a1a1a">
        <div>1. Tap the <strong>Share</strong> button <span style="font-size:17px">⬆</span> at the bottom</div>
        <div>2. Scroll down and tap <strong>"Add to Home Screen"</strong></div>
        <div>3. Tap <strong>Add</strong> — done! 🎉</div>
      </div>
      <button onclick="dismissIOSPopup()" style="width:100%;padding:14px;background:#0b6e72;color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">
        Got it!
      </button>
    </div>`;
  document.body.appendChild(popup);
}

function dismissIOSPopup() {
  localStorage.setItem('jap_ios_hint_dismissed', '1');
  const el = document.getElementById('ios-install-popup');
  if (el) el.remove();
}

/* ── Refresh ──────────────────────────────────────── */
async function refreshAll() {
  localStorage.removeItem(LS.PRODUCTS_TS);
  localStorage.removeItem(LS.OFFERS_TS);
  localStorage.removeItem(LS.COMPANIES);
  companies   = [];
  allProducts = [];
  showLoadingGrid();
  await loadProducts();
  await loadOffers();
  renderMyOrders();
  fetchInAppNotification();
}

/* ── Products ─────────────────────────────────────── */
async function loadProducts() {
  // Drop a cache that predates the scheme field (one-time upgrade guard).
  const probe = localStorage.getItem(LS.PRODUCTS);
  if (probe) {
    try {
      var sample = JSON.parse(probe)[0];
      if (sample && !Array.isArray(sample) && sample.scheme === undefined) {
        localStorage.removeItem(LS.PRODUCTS);
        localStorage.removeItem(LS.PRODUCTS_TS);
      }
    } catch(e) {}
  }

  function applySchemesOverlayFromCache() {
    try {
      const cachedSchemes = getCachedSchemes();
      if (!cachedSchemes || !cachedSchemes.length) return;
      const sm = buildSchemeOverlayMap(cachedSchemes);
      allProducts.forEach(p => {
        const k1 = (p.masterCode  || '').toLowerCase();
        const k2 = (p.productCode || '').toLowerCase();
        const ov = sm[k1] || sm[k2];
        if (ov) { p.specialScheme = ov; }
      });
    } catch(e) {}
  }

  // ── STEP 1 (FAST PAINT): show cached products immediately if we have them,
  //   so the app feels instant (req #2). No network wait before first paint.
  const cached2 = localStorage.getItem(LS.PRODUCTS);
  let paintedFromCache = false;
  if (cached2) {
    try {
      allProducts = JSON.parse(cached2).map(normaliseAny).filter(p => p && p.id);
      applySchemesOverlayFromCache();
      buildCompaniesFromProducts();
      applyFilter();
      paintedFromCache = true;
      const c = document.getElementById('prod-count');
      if (c) c.textContent = allProducts.length + ' products (updating…)';
      renderQuickOrder(); // products now in memory — Quick Buy can show favourites
    } catch(e) {
      localStorage.removeItem(LS.PRODUCTS);
      showLoadingGrid();
    }
  } else {
    showLoadingGrid();
  }

  // ── STEP 2 (BACKGROUND REFRESH): always re-pull the latest data (req #6).
  //   Pull CONFIG first so a new Web App URL in the CONFIG sheet is honoured
  //   BEFORE fetching products (req #1). If we already painted from cache this
  //   all happens silently in the background.
  try { await fetchRemoteConfig({ silent:true }); } catch(e) { /* best-effort */ }
  const ok = await fetchSheet(paintedFromCache /* bg=true when cache already shown */);
  if (!ok && !paintedFromCache) showEmptyGrid('Could not load products. Tap "Refresh from Sheet" to retry.');
  applyPartyPermissionsUI();
  renderQuickOrder(); // re-render after fresh fetch so new product data shows in Quick Buy
}

function showLoadingGrid() {
  const grid = document.getElementById('prod-grid');
  if (grid) grid.innerHTML = '<div class="loading-box" style="grid-column:1/-1;padding:40px 0"><div class="spinner"></div><p>Loading products…</p></div>';
  const c = document.getElementById('prod-count');
  if (c) c.textContent = 'Loading…';
  const bar = document.getElementById('filter-bar');
  if (bar) bar.innerHTML = '<button class="chip active" onclick="setFilter(\'all\',this)">All</button>';
}

function showEmptyGrid(msg) {
  const grid = document.getElementById('prod-grid');
  if (grid) grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div><strong>No products</strong><p>' + esc(msg) + '</p><button class="btn btn-outline" style="margin-top:12px;padding:10px 20px;font-size:14px" onclick="hardRefresh()">🔄 Refresh from Sheet</button></div>';
  const cnt = document.getElementById('prod-count');
  if (cnt) cnt.textContent = '0 products';
  localStorage.removeItem(LS.COMPANIES);
  companies = [];
  const bar = document.getElementById('filter-bar');
  if (bar) bar.innerHTML = '<button class="chip active" onclick="setFilter(\'all\',this)">All</button>';
}

/* ── Refresh all data (not login) — triggered by the Refresh button ─────────
   Clears the inside-data caches, re-fetches everything from the backend, and
   shows progress on the button itself. Never touches auth/session keys. */
async function doRefreshAll(btn) {
  if (btn) { btn.classList.add('loading'); btn.title = 'Refreshing...'; }
  try {
    // Clear inside data caches only (never auth/session keys per storage separation)
    if (typeof clearInsideData === 'function') clearInsideData();
    else if (typeof clearAppDataCachesOnLoad === 'function') clearAppDataCachesOnLoad();
    await refreshAll();
    // Also refresh the dedicated sheets
    loadDedicatedSheets();
    toast('Updated ✓ All data refreshed', 'ok');
  } catch(e) {
    toast('Refresh failed — check connection', 'err');
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.title = 'Refresh all data'; }
  }
}

async function hardRefresh() {
  localStorage.removeItem(LS.PRODUCTS);
  localStorage.removeItem(LS.PRODUCTS_TS);
  localStorage.removeItem(LS.OFFERS);
  localStorage.removeItem(LS.OFFERS_TS);
  localStorage.removeItem(LS.SCHEMES);
  localStorage.removeItem(LS.SCHEMES_TS);
  localStorage.removeItem(LS.COMPANIES);
  localStorage.removeItem(LS.CONFIG);
  localStorage.removeItem(LS.CONFIG_TS);
  allProducts = [];
  companies   = [];
  showLoadingGrid();
  toast('Fetching from sheet…', 'inf');
  await ensurePartyPermissionsLoaded();
  applyPartyPermissionsUI();
  try { await fetchRemoteConfig({ silent:false }); } catch(e) {}
  const ok = await fetchSheet(false);
  if (ok) {
    toast(allProducts.length + ' products loaded ✓', 'ok');
    await fetchOffers(false);
  } else {
    toast('Sheet unavailable. Check Apps Script URL.', 'err');
    showEmptyGrid('Sheet not reachable. Check Admin → Settings → Test Connection.');
  }
}

function buildCompaniesFromProducts() {
  companies = [...new Set(allProducts.map(p => p.company).filter(Boolean))].sort();
  localStorage.setItem(LS.COMPANIES, JSON.stringify(companies));
  buildFilterChips();
}

async function fetchSheet(bg = true) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return false;

  let hintTimer = null;
  if (!bg) {
    hintTimer = setTimeout(() => {
      const c = document.getElementById('prod-count');
      if (c) c.textContent = 'Loading products… please wait ⏳';
    }, 5000);
  }

  try {
    const res = await apiFetchTimeout(url + '?action=products' + dataAuthParam(), 50000);
    if (hintTimer) clearTimeout(hintTimer);
    if (res && res.needAuth) { silentReauth(); return false; }  // req #4: refresh quietly, do not log out

    if (res?.ok && Array.isArray(res.products) && res.products.length > 0) {
      const fn = (res.format === 'array') ? normaliseProductArray : normaliseProduct;
      const products = res.products
        .map(fn).filter(p => p && p.id)
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

      // ── Schemes overlay (dedicated Schemes sheet) ──
      try {
        try { await fetchRemarks(); } catch(e) {}
        const schemes = await fetchSchemes({ silent:true });
        if (schemes && schemes.length) {
          const sm = buildSchemeOverlayMap(schemes);
          products.forEach(p => {
            const k1 = (p.masterCode  || '').toLowerCase();
            const k2 = (p.productCode || '').toLowerCase();
            const ov = sm[k1] || sm[k2];
            if (ov) { p.specialScheme = ov; }
          });
        }
      } catch(e) {}

      const wasEmpty = allProducts.length === 0;
      safeSetItem(LS.PRODUCTS, JSON.stringify(products));
      localStorage.setItem(LS.PRODUCTS_TS, String(Date.now()));
      allProducts = products;
      buildCompaniesFromProducts();
      rebuildSpecialSchemesList();
      renderQuickOrder();
      if (document.getElementById('tab-specialschemes')?.classList.contains('on')) renderSpecialSchemes();
      if (document.getElementById('tab-nearexpiry')?.classList.contains('on')) renderNearExpiry();

      if (!bg || wasEmpty) {
        applyFilter();
      } else {
        // Background refresh: update count silently, don't disrupt scroll
        const el = document.getElementById('prod-count');
        if (el && !searchQ) el.textContent = products.length + ' products';
      }

      if (!bg) toast(products.length + ' products loaded ✓', 'ok');
      return true;
    }
    if (hintTimer) clearTimeout(hintTimer);
  } catch(e) {
    if (hintTimer) clearTimeout(hintTimer);
    if (!bg) showEmptyGrid('Could not load. Check connection and retry.');
  }
  return false;
}

/* ── Offers ───────────────────────────────────────── */
async function loadOffers() {
  const cached   = localStorage.getItem(LS.OFFERS);
  const ts       = localStorage.getItem(LS.OFFERS_TS);
  const cacheAge = (cached && ts) ? Date.now() - Number(ts) : Infinity;
  const TTL      = 24 * 60 * 60 * 1000;

  // Invalidate cache if it lacks scheme data (v10 upgrade guard)
  if (cached) {
    try {
      var sample = JSON.parse(cached)[0];
      if (sample && !Array.isArray(sample) && sample.scheme === undefined) {
        console.log('Cache lacks scheme field — forcing refresh');
        localStorage.removeItem(LS.OFFERS);
        localStorage.removeItem(LS.OFFERS_TS);
      }
    } catch(e) {}
  }
  const cached2   = localStorage.getItem(LS.OFFERS);
  const ts2       = localStorage.getItem(LS.OFFERS_TS);
  const cacheAge2 = (cached2 && ts2) ? Date.now() - Number(ts2) : Infinity;

  if (cached2 && cacheAge2 < TTL) {
    try { allOffers = mergeOfferRows(JSON.parse(cached2).map(normaliseAny)); } catch(e) { allOffers = schemeProductsFromCatalog(); }
    renderOffers();
    fetchOffers(true);
  } else {
    const ok = await fetchOffers(false);
    if (!ok) { allOffers = schemeProductsFromCatalog(); renderOffers(); }
  }
}

async function fetchOffers(bg = true) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return false;
  try {
    const res = await apiFetchTimeout(url + '?action=offers' + dataAuthParam(), 30000);
    if (res && res.needAuth) { silentReauth(); return false; }  // req #4: refresh quietly, do not log out
    if (res?.ok && Array.isArray(res.products) && res.products.length > 0) {
      const fn = (res.format === 'array') ? normaliseProductArray : normaliseProduct;
      const offers = mergeOfferRows(res.products.map(fn).filter(p => p && p.id));
      safeSetItem(LS.OFFERS, JSON.stringify(offers));
      localStorage.setItem(LS.OFFERS_TS, String(Date.now()));
      allOffers = offers;
      renderOffers();
      return true;
    }
  } catch(e) {}
  const fallback = schemeProductsFromCatalog();
  if (fallback.length) {
    safeSetItem(LS.OFFERS, JSON.stringify(fallback));
    localStorage.setItem(LS.OFFERS_TS, String(Date.now()));
    allOffers = fallback;
    renderOffers();
    return true;
  }
  return false;
}

function schemeProductsFromCatalog() {
  return allProducts
    .map(normaliseAny)
    .filter(p => p && p.id && ((p.scheme || '').toString().trim() || (p.specialScheme || '').toString().trim() || p.hasScheme));
}

function mergeOfferRows(rows) {
  const byId = new Map();
  schemeProductsFromCatalog().forEach(p => byId.set(String(p.id || p.masterCode), p));
  (rows || []).forEach(row => {
    const p = normaliseAny(row);
    if (!p || !p.id) return;
    const hasScheme = (p.scheme || '').toString().trim() || (p.specialScheme || '').toString().trim() || p.hasScheme;
    if (hasScheme) byId.set(String(p.id || p.masterCode), p);
  });
  return [...byId.values()];
}

/* ── Company chips ────────────────────────────────── */
function buildFilterChips() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const allA = activeFilter === 'all' ? 'active' : '';
  const favA = activeFilter === '__favs__' ? 'active' : '';
  const stockA = activeFilter === '__instock__' ? 'active' : '';
  let html = '<button class="chip ' + allA + '" onclick="setFilter(\'all\',this)">All</button>';
  html += '<button class="chip ' + stockA + '" onclick="setFilter(\'__instock__\',this)">In Stock</button>';
  html += '<button class="chip ' + favA + '" onclick="setFilter(\'__favs__\',this)">❤️ Liked</button>';
  companies.forEach(co => {
    const s   = getCompanyStyle(co);
    const isA = activeFilter === co;
    const style = isA
      ? 'background:' + s.color + ';border-color:' + s.color + ';color:#fff'
      : 'background:' + s.bg   + ';border-color:' + s.border + ';color:' + s.color;
    html += '<button class="chip" style="' + style + '" data-co="' + esc(co) + '">' + esc(co) + '</button>';
  });
  bar.innerHTML = html;
  bar.querySelectorAll('[data-co]').forEach(btn => {
    btn.addEventListener('click', function() { setFilter(this.getAttribute('data-co'), this); });
  });
}

/* ── Sort ─────────────────────────────────────────── */
function onSortChange() {
  const val = document.getElementById('sort-select').value;
  if (val === 'favs') {
    // Favourites selected from sort menu — activate the favs filter
    activeFilter = '__favs__';
    sortMode = 'default';
    buildFilterChips(); // highlight the ❤️ Liked chip to match
  } else {
    // Switching away from favs — clear the favs filter if it was set by the dropdown
    if (activeFilter === '__favs__') { activeFilter = 'all'; buildFilterChips(); }
    sortMode = val;
  }
  applyFilter();
}

function sortProducts(list) {
  const arr = [...list];
  if (sortMode === 'za')         return arr.sort((a,b) => (b.displayName||'').localeCompare(a.displayName||''));
  if (sortMode === 'rating')     return arr.sort((a,b) => (parseFloat(b.rating)||0)-(parseFloat(a.rating)||0));
  if (sortMode === 'popular')    return arr.sort((a,b) => (parseInt(b.soldInvoices)||0)-(parseInt(a.soldInvoices)||0));
  if (sortMode === 'stock')      return arr.sort((a,b) => (parseInt(b.stockAvailable)||0)-(parseInt(a.stockAvailable)||0));
  if (sortMode === 'nearexpiry') return arr.sort((a,b) => {
    const da = parseInt(a.daysToExpiry)||9999, db = parseInt(b.daysToExpiry)||9999;
    return da - db;
  });
  // Default: in-stock first → sold invoices → A-Z (server already sorted, just re-apply)
  return arr.sort((a,b) => {
    const sa = parseInt(a.stockAvailable)||0, sb = parseInt(b.stockAvailable)||0;
    if (sb>0 && sa===0) return 1;
    if (sa>0 && sb===0) return -1;
    const pa = parseInt(a.soldInvoices)||0, pb = parseInt(b.soldInvoices)||0;
    if (pb !== pa) return pb - pa;
    return (a.displayName||'').localeCompare(b.displayName||'');
  });
}

/* ── Filter + Search ──────────────────────────────── */
function applyFilter() {
  let list = [...allProducts];
  const hidden = JSON.parse(localStorage.getItem('jap_hidden_products') || '[]');
  if (hidden.length) list = list.filter(p => !hidden.includes(p.id) && !hidden.includes(p.masterCode));
  if (activeFilter === '__favs__') {
    const favIds = new Set(getFavourites().map(f => String(f.id)));
    list = list.filter(p => favIds.has(String(p.id)));
  } else if (activeFilter === '__instock__') {
    list = list.filter(p => parseInt(p.stockAvailable||0) > 0);
  } else if (activeFilter !== 'all') {
    list = list.filter(p => p.company === activeFilter || p.division === activeFilter);
  }
  if (searchQ) {
    const terms = searchQ.toLowerCase().trim().split(/\s+/).filter(Boolean);
    list = list.filter(p => terms.every(t => (p.searchText || '').includes(t)));
  }
  list      = sortProducts(list);
  filtered  = list;
  displayed = 0;
  const grid = document.getElementById('prod-grid');
  if (grid) {
    grid.innerHTML = '';
    grid.setAttribute('data-cols', localStorage.getItem('jap_cols') || '2');
  }
  const count = document.getElementById('prod-count');
  if (count) count.textContent = list.length + ' product' + (list.length !== 1 ? 's' : '');
  loadMore();
  // IMPORTANT: Re-setup observer AFTER DOM is updated
  setTimeout(setupScrollObserver, 50);
}

function setFilter(f, el) {
  activeFilter = f;
  // Keep sort dropdown in sync — show ❤️ Favourites when favs filter is active
  const sel = document.getElementById('sort-select');
  if (sel) sel.value = (f === '__favs__') ? 'favs' : (sortMode || 'default');
  buildFilterChips();
  applyFilter();
}

function onSearch() {
  searchQ = (document.getElementById('prod-search')?.value || '').trim().toLowerCase();
  document.getElementById('search-clear')?.classList.toggle('hidden', !searchQ);
  applyFilter();
  if (document.getElementById('tab-nearexpiry')?.classList.contains('on')) renderNearExpiry();
}

function clearSearch() {
  const inp = document.getElementById('prod-search');
  if (inp) inp.value = '';
  searchQ = '';
  document.getElementById('search-clear')?.classList.add('hidden');
  applyFilter();
}

/* ── Paginated grid render ────────────────────────── */
function loadMore() {
  const slice = filtered.slice(displayed, displayed + PAGE);
  const grid  = document.getElementById('prod-grid');
  if (!grid) return;
  slice.forEach(p => grid.insertAdjacentHTML('beforeend', pcardHTML(p, 'prod')));
  displayed += slice.length;
}

/* ── Special Schemes (Schemes sheet only — independent of Offers / product scheme) ── */
async function loadSpecialSchemes() {
  await fetchSchemes({ silent: true });
  rebuildSpecialSchemesList();
  if (document.getElementById('tab-specialschemes')?.classList.contains('on')) renderSpecialSchemes();
}

function rebuildSpecialSchemesList() {
  // Prefer the dedicated "Special Schemes" sheet you manage (req #3).
  if (allSpecialSchemesData && allSpecialSchemesData.length) {
    allSpecialSchemes = allSpecialSchemesData.map(function(p) {
      const copy = Object.assign({}, p);
      copy.specialScheme = (p.specialScheme || p.scheme || '').toString().trim();
      copy.scheme = '';
      copy.productScheme = '';
      return copy;
    });
    return;
  }
  // Fallback (backward compatible): overlay schemes onto the main catalogue.
  const overlay = buildSchemeOverlayMap(getCachedSchemes());
  allSpecialSchemes = allProducts.filter(function(p) {
    const k = String(p.masterCode || p.productCode || '').toLowerCase();
    return k && overlay[k];
  }).map(function(p) {
    const k = String(p.masterCode || p.productCode || '').toLowerCase();
    const copy = Object.assign({}, p);
    copy.specialScheme = overlay[k];
    copy.scheme = '';
    copy.productScheme = '';
    return copy;
  });
}

function buildSSFilterChips() {
  const bar = document.getElementById('ss-filter-bar');
  if (!bar) return;
  const cos = [...new Set(allSpecialSchemes.map(p => p.company).filter(Boolean))].sort();
  const allA = ssFilter === 'all' ? 'active' : '';
  let html = '<button class="chip ' + allA + '" onclick="setSSFilter(\'all\',this)">All</button>';
  cos.forEach(co => {
    const s = getCompanyStyle(co);
    const isA = ssFilter === co;
    const style = isA ? 'background:'+s.color+';border-color:'+s.color+';color:#fff' : 'background:'+s.bg+';border-color:'+s.border+';color:'+s.color;
    html += '<button class="chip" style="'+style+'" data-co="'+esc(co)+'">'+esc(co)+'</button>';
  });
  bar.innerHTML = html;
  bar.querySelectorAll('[data-co]').forEach(btn => {
    btn.addEventListener('click', function() { setSSFilter(this.getAttribute('data-co'), this); });
  });
}

function setSSFilter(f, el) {
  ssFilter = f;
  document.querySelectorAll('#ss-filter-bar .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderSpecialSchemes();
}

function renderSpecialSchemes() {
  const grid = document.getElementById('special-schemes-grid');
  const empty = document.getElementById('special-schemes-empty');
  if (!grid) return;
  if (!allProducts.length && !(allSpecialSchemesData && allSpecialSchemesData.length)) {
    if (empty) empty.classList.remove('hidden');
    if (grid) grid.innerHTML = '<div style="padding:30px;text-align:center;grid-column:1/-1"><strong>No special schemes yet</strong><p style="color:#888;font-size:13px;margin-top:6px">Admin: add products to the Special Schemes sheet in Google Sheets.</p></div>';
    return;
  }
  rebuildSpecialSchemesList();
  buildSSFilterChips();
  const ssQ = (document.getElementById('ss-search')?.value || '').trim().toLowerCase();
  let list = ssFilter === 'all' ? allSpecialSchemes : allSpecialSchemes.filter(p => p.company === ssFilter);
  if (ssQ) {
    const terms = ssQ.split(/\s+/).filter(Boolean);
    list = list.filter(p => { const t = ((p.searchText||'')+' '+(p.displayName||'')).toLowerCase(); return terms.every(w=>t.includes(w)); });
  }
  list = list.sort((a, b) => (a.company || '').localeCompare(b.company || '') || (a.displayName || '').localeCompare(b.displayName || ''));
  if (!list.length) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  renderSchemeTable(grid, list, 'ss', 'Special Scheme');
}

function renderSchemeTable(container, list, prefix, schemeLabel) {
  const byCompany = new Map();
  list.forEach(p => {
    const co = p.company || 'Other';
    if (!byCompany.has(co)) byCompany.set(co, []);
    byCompany.get(co).push(p);
  });
  let html = '<div class="qo-table-wrap"><table class="qo-table"><colgroup><col><col class="col-qty"><col class="col-qty"><col class="col-qty"><col class="col-total"></colgroup>'
    + '<thead><tr><th style="text-align:left">Product / '+esc(schemeLabel)+'</th><th>Loose</th><th>Box</th><th>Case</th><th style="background:#1e40af">Total</th></tr></thead><tbody>';
  byCompany.forEach((products, company) => {
    const s = getCompanyStyle(company);
    html += '<tr class="qo-company-row" style="background:'+s.color+'"><td colspan="5"><span style="font-weight:700;font-size:12.5px">'+esc(company)+'</span> <span style="opacity:.65;font-size:11px">('+products.length+')</span></td></tr>';
    products.forEach(p => {
      const inCart = cart.some(c => String(c.id) === String(p.id));
      const safeId = String(p.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const realId = esc(String(p.id));
      const boxSize = parseInt(p.boxQty) || 0;
      const caseSize = parseInt(p.caseQty) || 0;
      const sch = (p.specialScheme || p.scheme || '').toString().trim();
      html += '<tr id="pc-'+prefix+'-'+safeId+'"'+(inCart?' class="qo-added"':'')+'>'
        + '<td><div class="qo-pname">'+esc(p.name||p.displayName||p.masterCode)+'</div>'
        + (p.composition ? '<div class="qo-comp">'+esc(p.composition)+'</div>' : '')
        + (sch ? '<div class="qo-scheme">🎁 '+esc(sch)+'</div>' : '') + '</td>';
      if (inCart) {
        html += '<td colspan="3" style="text-align:center"><div class="added-badge">✓ In Cart</div></td><td></td>';
      } else {
        const oi = 'updateTableTotal(\''+prefix+'\',\''+safeId+'\','+boxSize+','+caseSize+');scheduleAutoSave(\''+prefix+'\',\''+safeId+'\',\''+realId+'\')';
        html += '<td style="text-align:center"><input class="qty-input" id="ql-'+prefix+'-'+safeId+'" type="number" min="0" value="0" inputmode="numeric" onfocus="qFocus(this)" onblur="qBlur(this)" oninput="'+oi+'"></td>'
          + '<td style="text-align:center"><input class="qty-input" id="qb-'+prefix+'-'+safeId+'" type="number" min="0" value="0" inputmode="numeric" onfocus="qFocus(this)" onblur="qBlur(this)" oninput="'+oi+'"></td>'
          + '<td style="text-align:center"><input class="qty-input" id="qc-'+prefix+'-'+safeId+'" type="number" min="0" value="0" inputmode="numeric" onfocus="qFocus(this)" onblur="qBlur(this)" oninput="'+oi+'"></td>'
          + '<td style="text-align:center;background:#eff6ff"><span id="tbl-total-'+prefix+'-'+safeId+'" style="font-weight:700;font-size:14px;color:#1a5fb4">0</span></td>';
      }
      html += '</tr>';
    });
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/* ── Near Expiry tab ──────────────────────────────── */
function getNearExpiryProducts() {
  // Prefer the dedicated "Near Expiry" sheet you manage (req #3).
  if (allNearExpiryData && allNearExpiryData.length) return allNearExpiryData.slice();
  // Fallback (backward compatible): auto-detect from the main catalogue.
  return allProducts.filter(function(p) {
    if (p.nearExpiry) return true;
    const d = parseInt(p.daysToExpiry, 10);
    return !isNaN(d) && d >= 0 && d <= 90;
  });
}

function buildNearExpiryFilterChips() {
  const bar = document.getElementById('ne-filter-bar');
  if (!bar) return;
  const list = getNearExpiryProducts();
  const cos = [...new Set(list.map(p => p.company).filter(Boolean))].sort();
  const allA = neFilter === 'all' ? 'active' : '';
  let html = '<button class="chip '+allA+'" onclick="setNearExpiryFilter(\'all\',this)">All</button>';
  cos.forEach(co => {
    const s = getCompanyStyle(co);
    const isA = neFilter === co;
    const style = isA ? 'background:'+s.color+';border-color:'+s.color+';color:#fff' : 'background:'+s.bg+';border-color:'+s.border+';color:'+s.color;
    html += '<button class="chip" style="'+style+'" data-co="'+esc(co)+'">'+esc(co)+'</button>';
  });
  bar.innerHTML = html;
  bar.querySelectorAll('[data-co]').forEach(btn => {
    btn.addEventListener('click', function() { setNearExpiryFilter(this.getAttribute('data-co'), this); });
  });
}

function setNearExpiryFilter(f, el) {
  neFilter = f;
  document.querySelectorAll('#ne-filter-bar .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderNearExpiry();
}

function renderNearExpiry() {
  const grid = document.getElementById('ne-grid');
  if (!grid) return;
  buildNearExpiryFilterChips();
  let list = getNearExpiryProducts();
  if (neFilter !== 'all') list = list.filter(p => p.company === neFilter);
  const neQ = (document.getElementById('ne-search-input') ? document.getElementById('ne-search-input').value : '').trim().toLowerCase();
  const neSearchQ = neQ || searchQ;
  if (neSearchQ) {
    const terms = neSearchQ.split(/\s+/).filter(Boolean);
    list = list.filter(p => terms.every(t => (p.searchText || '').includes(t)));
  }
  list = list.sort((a, b) => (parseInt(a.daysToExpiry) || 9999) - (parseInt(b.daysToExpiry) || 9999));
  const cols = localStorage.getItem('jap_cols') || '2';
  grid.setAttribute('data-cols', cols);
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">✅</div><strong>No near-expiry items</strong><p>Products within 90 days of expiry will appear here</p></div>';
    return;
  }
  grid.innerHTML = list.map(p => pcardHTML(p, 'ne')).join('');
}

/* ── Offers render (legacy — kept for cache compat) ─ */
function buildOffersFilterChips() {
  const bar = document.getElementById('offers-filter-bar');
  if (!bar || !allOffers.length) return;
  const cos  = [...new Set(allOffers.map(p => p.company).filter(Boolean))].sort();
  const allA = offersFilter === 'all' ? 'active' : '';
  let html = '<button class="chip ' + allA + '" onclick="setOffersFilter(\'all\',this)">All</button>';
  cos.forEach(co => {
    const s   = getCompanyStyle(co);
    const isA = offersFilter === co;
    const style = isA
      ? 'background:' + s.color + ';border-color:' + s.color + ';color:#fff'
      : 'background:' + s.bg   + ';border-color:' + s.border + ';color:' + s.color;
    html += '<button class="chip" style="' + style + '" data-co="' + esc(co) + '">' + esc(co) + '</button>';
  });
  bar.innerHTML = html;
  bar.querySelectorAll('[data-co]').forEach(btn => {
    btn.addEventListener('click', function() { setOffersFilter(this.getAttribute('data-co'), this); });
  });
}

function setOffersFilter(f, el) {
  offersFilter = f;
  document.querySelectorAll('#offers-filter-bar .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderOffers();
}

function renderOffers() {
  const grid = document.getElementById('offers-grid');
  if (!grid) return;
  buildOffersFilterChips();
  const offersQ = (document.getElementById('offers-search')?.value || '').trim().toLowerCase();
  let list = offersFilter === 'all' ? allOffers : allOffers.filter(p => p.company === offersFilter);
  if (offersQ) {
    const terms = offersQ.split(/\s+/).filter(Boolean);
    list = list.filter(p => { const t = ((p.searchText||'')+' '+(p.displayName||'')).toLowerCase(); return terms.every(w=>t.includes(w)); });
  }
  const hidden = JSON.parse(localStorage.getItem('jap_hidden_products') || '[]');
  list = list.filter(p => !hidden.includes(p.id) && !hidden.includes(p.masterCode));
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🎁</div><strong>No offers right now</strong></div>';
    return;
  }
  grid.setAttribute('data-cols', localStorage.getItem('jap_cols') || '2');
  grid.innerHTML = '';
  list.forEach(p => grid.insertAdjacentHTML('beforeend', pcardHTML(p, 'ofs')));
  fixOffersInputs(grid);
}

/*
 * iOS FIX: inputs inside position:fixed > overflow:hidden > overflow-y:auto
 * can become non-interactive on Safari. Forcing a GPU layer with
 * translateZ(0) and explicit pointer-events restores interactivity.
 */
function fixOffersInputs(grid) {
  if (!grid) return;
  grid.querySelectorAll('.qty-input').forEach(inp => {
    inp.style.pointerEvents  = 'auto';
    inp.style.webkitUserSelect = 'text';
    inp.style.userSelect     = 'text';
    inp.style.touchAction    = 'manipulation';
    // iOS WebKit fix: force input to be interactive
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('autocorrect',  'off');
    inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('spellcheck',   'false');
    // Remove any readonly that might have snuck in
    inp.removeAttribute('readonly');
    inp.removeAttribute('disabled');
  });
  // Force GPU layer on the grid to fix iOS position:fixed input bug
  grid.style.transform = 'translateZ(0)';
  grid.style.webkitTransform = 'translateZ(0)';
}


/* ── Favourites ───────────────────────────────────── */
function getFavourites() {
  try { return JSON.parse(localStorage.getItem(LS.FAVORITES)||'[]'); } catch(e){ return []; }
}
function saveFavourites(favs) {
  localStorage.setItem(LS.FAVORITES, JSON.stringify(favs));
}
function isFavourite(id) {
  return getFavourites().some(f => String(f.id) === String(id));
}
function toggleFavourite(p, prefix) {
  let favs = getFavourites();
  const id = String(p.id);
  const exists = favs.findIndex(f => String(f.id) === id);
  if (exists >= 0) {
    favs.splice(exists, 1);
  } else {
    favs.push({
      id: p.id,
      masterCode: p.masterCode||'',
      name: (p.displayName||p.namePack||p.productName||p.masterCode||'').trim(),
      composition: p.composition||'',
      company: p.company||'',
      division: p.division||'',
      boxQty: p.boxQty||'',
      caseQty: p.caseQty||'',
      scheme: p.scheme||'',
      mrp: p.mrp||'',
      pts: p.pts||'',
      _addedAt: Date.now()
    });
  }
  saveFavourites(favs);
  _scheduleFavSync(); // sync to server (debounced)
  // Refresh fav button state
  const safeId = String(p.id).replace(/[^a-zA-Z0-9_-]/g,'_');
  const btn = document.querySelector('#pc-'+prefix+'-'+safeId+' .fav-btn');
  if (btn) {
    btn.classList.toggle('active', exists < 0);
    btn.title = exists < 0 ? 'Remove from Favourites' : 'Add to Favourites';
    btn.textContent = '❤';
  }
  toast(exists >= 0 ? 'Removed from Favourites' : '❤️ Added to Favourites & Quick Buy', 'inf');
  // Re-render Quick Order so the new fav appears
  if (document.getElementById('tab-quickorder')?.classList.contains('on')) {
    renderQuickOrder();
  }
}

/* ── Product Card HTML ────────────────────────────── */
function pcardHTML(p, prefix) {
  const inCart  = cart.some(c => String(c.id) === String(p.id));
  const safeP   = encodeProductForAttr(p);
  const name    = (p.displayName||p.namePack||'').trim() || [p.productName,p.productPack].filter(Boolean).join(' ') || p.masterCode || '';
  const safeId  = String(p.id).replace(/[^a-zA-Z0-9_-]/g,'_');
  const realId  = esc(String(p.id));

  // Party-wise permissions (set by admin, stored in partyUser.permissions)
  const perms = parsePartyPermissions(partyUser && partyUser.permissions);

  // Company/product custom remark + hide-No-Stock (from the Remarks sheet)
  const _rk = (typeof remarkFor === 'function') ? remarkFor(p) : null;
  const _remarkText = (_rk && _rk.remark) ? _rk.remark : '';
  const _hideNoStock = !!(_rk && _rk.hideNoStock);

  // Stock display priority: product remark → company remark → standard badge
  const stockNum = parseInt(p.stockAvailable)||0;
  let stockBadge = '';
  let remarkBadge = '';
  if (!perms.removeAvailability) {
    if (_remarkText) {
      stockBadge = '<span class="badge-remark" style="background:#fff3cd;color:#92400e;border:1px solid #fde68a;border-radius:6px;padding:2px 8px;font-size:10.5px;font-weight:700">📌 '+esc(_remarkText)+'</span>';
    } else {
      const stockMode = perms.showExactQty ? 'exact' : (perms.showAvailableLabel ? 'available' : 'badge');
      const inLabel  = stockMode === 'available' ? 'Available' : 'In Stock';
      const outLabel = stockMode === 'available' ? 'Not Available' : 'No Stock';
      if (stockNum > 0) {
        stockBadge = (stockMode === 'exact')
          ? '<span class="badge-stock-in">✓ '+stockNum+' pcs</span>'
          : '<span class="badge-stock-in">✓ '+inLabel+'</span>';
      } else if (!_hideNoStock) {
        stockBadge = (stockMode === 'exact')
          ? '<span class="badge-stock-out">'+outLabel+'</span>'
          : '<span class="badge-stock-out">'+outLabel+'</span>';
      }
    }
  }

  // REQ 4: Popularity from sold invoices
  const soldNum = parseInt(p.soldInvoices)||0;
  let popularBadge = '';
  if (soldNum >= 10)      popularBadge = '<span class="badge-popular">🔥 Hot · '+soldNum+' sales</span>';
  else if (soldNum >= 3)  popularBadge = '<span class="badge-popular" style="background:#e6f0ff;color:#1a5fb4;">📦 '+soldNum+' sales</span>';

  // Near expiry badge
  const daysNum = parseInt(p.daysToExpiry);
  let nearExpiryBadge = '';
  if (p.nearExpiry || (daysNum >= 0 && daysNum <= 90)) {
    const urgency = daysNum <= 15 ? 'background:#fde8e8;color:#b5252b;border:1px solid #fca5a5' : 'background:#fff3cd;color:#92400e;border:1px solid #fde68a';
    nearExpiryBadge = '<div class="badge-near-expiry" style="'+urgency+'">⚠️ Exp: '+esc(p.expiry||'')+(daysNum>=0?' ('+daysNum+'d)':'')+'</div>';
  }

  // Regular product scheme on cards — hidden if party permission hideScheme is set
  const schemeVal = (!perms.hideScheme)
    ? (p.scheme
        || p.productScheme
        || p['product scheme']
        || p['Product Scheme']
        || p['special scheme']
        || p.specialscheme
        || p.offer
        || p.offers
        || ''
      ).toString().trim()
    : '';
  const specialVal = (!perms.hideScheme && !perms.hideSpecialScheme) ? (p.specialScheme || '').toString().trim() : '';
  const generalBanner = schemeVal
    ? '<div class="scheme-banner"><span class="scheme-banner-icon">🏷️</span><span class="scheme-banner-text">'+esc(schemeVal)+'</span></div>'
    : '';
  const specialBanner = specialVal
    ? '<div class="scheme-banner scheme-special"><span class="scheme-banner-icon">🎁</span><span class="scheme-banner-text"><b>SPECIAL:</b> '+esc(specialVal)+'</span></div>'
    : '';
  const scheme = generalBanner + specialBanner;

  // Size row
  const sizeParts = [];
  if (p.stripPacking && p.stripPacking!=='0') sizeParts.push('Strip: <b>'+esc(p.stripPacking)+'</b>');
  if (p.boxQty       && p.boxQty      !=='0') sizeParts.push('Box: <b>'  +esc(p.boxQty)      +'</b>');
  if (p.caseQty      && p.caseQty     !=='0') sizeParts.push('Case: <b>' +esc(p.caseQty)     +'</b>');

  const priceHTML = (p.ptr||p.mrp||p.pts)
    ? '<div class="price-row">'
        +(p.ptr ? '<span class="price-ptr" style="background:#e8f5e9;color:#145c30;border-radius:4px;padding:1px 6px;font-size:11.5px;font-weight:800">PTR ₹'+esc(p.ptr)+'</span> ' : '')
        +(p.mrp ? '<span class="price-mrp">MRP ₹'+esc(p.mrp)+'</span>' : '')
        +(p.pts ? '<span class="price-pts">PTS ₹'+esc(p.pts)+'</span>' : '')
      +'</div>'
    : '';

  const sizeBar = sizeParts.length
    ? '<div class="size-info" style="margin-bottom:5px;font-size:11px">'+sizeParts.join(' · ')+'</div>'
    : '';

  const bps = parseInt(p.boxQty)||0;
  const cps = parseInt(p.caseQty)||0;

  const bottom = inCart
    ? '<div class="added-badge">✓ In Cart</div>'
    : sizeBar
      +'<div class="qty-group">'
        +qtyInputHTML('ql',prefix,safeId,realId,bps,cps)
        +qtyInputHTML('qb',prefix,safeId,realId,bps,cps)
        +qtyInputHTML('qc',prefix,safeId,realId,bps,cps)
      +'</div>'
      +nearExpiryBadge
      +'<div class="total-qty-bar" id="tq-'+prefix+'-'+safeId+'">'
        +'<span class="tq-label">Total Qty</span>'
        +'<span class="tq-num" id="tqn-'+prefix+'-'+safeId+'">0</span>'
      +'</div>';

  const borderCls = stockNum > 0 ? ' pcard-instock' : '';

  const isFav = isFavourite(p.id);
  const favBtn = '<button class="fav-btn'+(isFav?' active':'')+'" onclick="toggleFavourite('+safeP+',\''+prefix+'\');event.stopPropagation()" title="'+(isFav?'Remove from Favourites':'Add to Favourites')+'" type="button">❤</button>';

  // Company accent
  const cs = getCompanyStyle(p.company||'');
  const companyBadge = p.company
    ? '<span class="badge-company" style="background:'+cs.bg+';color:'+cs.color+';border-color:'+cs.border+'">'
        +'<span class="badge-company-dot" style="background:'+cs.color+'"></span>'
        +esc(p.company)
      +'</span>'
    : '';

  return '<div class="pcard'+borderCls+'" id="pc-'+prefix+'-'+safeId+'" style="--co-accent:'+cs.color+'">'
    +favBtn
    +'<div class="pcard-badges">'+companyBadge+stockBadge+remarkBadge+popularBadge+'</div>'
    +'<div class="pcard-top">'
      +'<div class="pcard-name">'+esc(name)+'</div>'
      +(p.composition ? '<div class="pcard-comp">'+esc(p.composition)+'</div>' : '')
      +priceHTML
    +'</div>'
    +scheme
    +'<div class="pcard-bottom">'+bottom+'</div>'
    +'</div>';
}

function _lastQty(id, type) {
  try { for (const ord of JSON.parse(localStorage.getItem(LS.MY_ORDERS)||'[]')) { const it=(ord.items||[]).find(i=>String(i.id)===String(id)||i.masterCode===String(id)); if(it)return parseInt(it[type+'Qty'])||0; } } catch(e){}
  return 0;
}
function qtyInputHTML(pfx, prefix, safeId, realId, bps, cps) {
  const labels = { ql: 'Loose', qb: 'Box', qc: 'Case' };
  const bpsVal = bps || 0;
  const cpsVal = cps || 0;
  return '<div class="qty-field"><span class="qty-label">' + labels[pfx] + '</span>'
    + '<input class="qty-input" id="' + pfx + '-' + prefix + '-' + safeId + '" '
    + 'type="number" min="0" value="0" inputmode="numeric" pattern="[0-9]*" '
    + 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" '
    + 'onfocus="qFocus(this)" onblur="qBlur(this)" '
    + 'oninput="updateTotalQtyDisplay(\''+prefix+'\',\''+safeId+'\','+bpsVal+','+cpsVal+');scheduleAutoSave(\'' + prefix + '\',\'' + safeId + '\',\'' + realId + '\')">'
    + '</div>';
}

/* ── Update Total Qty Display on Product Card ─────── */
function updateTotalQtyDisplay(prefix, safeId, bps, cps) {
  const l = parseInt(document.getElementById('ql-'+prefix+'-'+safeId)?.value) || 0;
  const b = parseInt(document.getElementById('qb-'+prefix+'-'+safeId)?.value) || 0;
  const c = parseInt(document.getElementById('qc-'+prefix+'-'+safeId)?.value) || 0;
  const total = l + b*(bps||1) + c*(cps||1);
  const numEl = document.getElementById('tqn-'+prefix+'-'+safeId);
  const barEl = document.getElementById('tq-'+prefix+'-'+safeId);
  if (numEl) numEl.textContent = total;
  if (barEl) barEl.classList.toggle('tq-active', total > 0);
}

/* ── Qty helpers ──────────────────────────────────── */
function qFocus(inp) { if (inp.value === '0') inp.value = ''; inp.select(); }
function qBlur(inp)  { if (inp.value === '' || isNaN(parseInt(inp.value))) inp.value = '0'; }

/* Auto-calculate Total Qty in Quick Order / Special Schemes tables */
function updateTableTotal(prefix, safeId, boxSize, caseSize) {
  const l = parseInt(document.getElementById('ql-' + prefix + '-' + safeId)?.value) || 0;
  const b = parseInt(document.getElementById('qb-' + prefix + '-' + safeId)?.value) || 0;
  const c = parseInt(document.getElementById('qc-' + prefix + '-' + safeId)?.value) || 0;
  const total = l + (b * (boxSize || 1)) + (c * (caseSize || 1));
  const el = document.getElementById('tbl-total-' + prefix + '-' + safeId)
          || document.getElementById('qo-total-' + safeId);
  if (el) el.textContent = total;
}
function updateQOTotal(safeId, boxSize, caseSize) {
  updateTableTotal('qo', safeId, boxSize, caseSize);
}

/* ── Auto-save debounce ───────────────────────────── */
const _autoSaveTimers = {};

function scheduleAutoSave(prefix, safeId, realId) {
  const key = prefix + '_' + safeId;
  clearTimeout(_autoSaveTimers[key]);
  _autoSaveTimers[key] = setTimeout(() => {
    const id = realId || safeId;
    const p  = allProducts.find(x => String(x.id) === id || String(x.masterCode) === id)
            || allSpecialSchemes.find(x => String(x.id) === id || String(x.masterCode) === id)
            || allOffers.find(x => String(x.id) === id || String(x.masterCode) === id);
    if (!p) return;
    const l  = parseInt(document.getElementById('ql-' + prefix + '-' + safeId)?.value) || 0;
    const b  = parseInt(document.getElementById('qb-' + prefix + '-' + safeId)?.value) || 0;
    const cs = parseInt(document.getElementById('qc-' + prefix + '-' + safeId)?.value) || 0;
    if (l + b + cs === 0) {
      // Qty cleared to zero — pull the product out of the cart entirely.
      const existed = cart.some(c => String(c.id) === String(p.id));
      if (existed) {
        cart = cart.filter(c => String(c.id) !== String(p.id));
        saveCart();
        updateBadge();
        if (typeof renderCart === 'function') renderCart();
      }
      return;
    }
    const source = (prefix === 'qo') ? 'quickbuy' : 'products';
    addToCartSilent(p, prefix, safeId, l, b, cs, source);
  }, 1000);
}

function addToCartSilent(p, prefix, safeId, l, b, cs, source) {
  const name = (p.displayName || p.namePack || p.productName || '').trim();
  const item = { id:p.id, masterCode:p.masterCode||'', productCode:p.productCode||'', name, composition:p.composition||'', company:p.company||'', division:p.division||'', looseQty:l, boxQty:b, caseQty:cs, boxPackSize:parseInt(p.boxQty)||0, casePackSize:parseInt(p.caseQty)||0, offer:(p.scheme||'').toString().trim(), remark:'', _source: source||'products' };
  const idx  = cart.findIndex(c => String(c.id) === String(p.id));
  if (idx >= 0) { item.remark = cart[idx].remark || ''; cart[idx] = item; } else cart.push(item);
  saveCart();
  const tqBar = document.querySelector('#pc-' + prefix + '-' + safeId + ' .total-qty-bar');
  if (tqBar) { tqBar.style.background='#dcfce7'; setTimeout(()=>{ tqBar.style.background=''; }, 1200); }
}

/* ── Cart ─────────────────────────────────────────── */
function addToCart(p, prefix) {
  const safeId = String(p.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const l  = parseInt(document.getElementById('ql-' + prefix + '-' + safeId)?.value) || 0;
  const b  = parseInt(document.getElementById('qb-' + prefix + '-' + safeId)?.value) || 0;
  const cs = parseInt(document.getElementById('qc-' + prefix + '-' + safeId)?.value) || 0;
  if (l + b + cs === 0) { toast('Enter at least one quantity', 'err'); return; }
  const name = (p.displayName || p.namePack || '').trim() || [p.productName, p.productPack].filter(Boolean).join(' ') || '';
  const item = { id:p.id, masterCode:p.masterCode||'', productCode:p.productCode||'', name, composition:p.composition||'', company:p.company||'', division:p.division||'', looseQty:l, boxQty:b, caseQty:cs, boxPackSize:parseInt(p.boxQty)||0, casePackSize:parseInt(p.caseQty)||0, offer:(p.scheme||'').toString().trim(), remark:'', _source:'products' };
  const idx  = cart.findIndex(c => String(c.id) === String(p.id));
  if (idx >= 0) { item.remark = cart[idx].remark || ''; cart[idx] = item; } else cart.push(item);
  saveCart();
  toast((name || p.masterCode).slice(0, 28) + ' added ✓', 'ok');
  document.querySelectorAll('[id^="pc-"][id$="-' + safeId + '"] .pcard-bottom')
    .forEach(bot => { bot.innerHTML = '<div class="added-badge">✓ In Cart</div>'; });
}

function removeFromCart(id) {
  cart = cart.filter(c => String(c.id) !== String(id));
  saveCart(); renderCart(); refreshCards();
}
function clearCart() {
  if (!cart.length) return;
  if (!confirm('Clear all ' + cart.length + ' item(s) from cart?')) return;
  cart = []; saveCart(); renderCart(); refreshCards(); toast('Cart cleared', 'inf');
}
function saveCart() { localStorage.setItem(LS.CART, JSON.stringify(cart)); updateBadge(); }
function updateBadge() {
  const dot = document.getElementById('cart-dot');
  if (dot) {
    dot.textContent = cart.length;
    dot.classList.toggle('hidden', cart.length === 0);
  }
  // Fix 7: also update topbar cart count
  const top = document.getElementById('topbar-cart-count');
  if (top) top.textContent = cart.length > 0 ? cart.length : '';
}

function renderCart() {
  const empty   = document.getElementById('cart-empty');
  const list    = document.getElementById('cart-list');
  const submitB = document.getElementById('cart-submit-box');
  const hasItems = cart.length > 0;
  if (empty)   empty.style.display   = hasItems ? 'none'  : 'block';
  if (list)    list.style.display    = hasItems ? 'flex'  : 'none';
  if (submitB) submitB.style.display = hasItems ? 'block' : 'none';
  // Show approx order total (PTR * qty)
  try {
    let tot = 0;
    cart.forEach(function(ci){
      const live = allProducts.find(function(px){return String(px.id)===String(ci.id);});
      const rate = parseFloat((live&&(live.ptr||live.mrp))||ci.ptr||ci.mrp||0);
      const bps = parseInt((live&&live.boxQty)||ci.boxPackSize||1);
      const cps = parseInt((live&&live.caseQty)||ci.casePackSize||1);
      tot += rate*((parseInt(ci.looseQty)||0)+(parseInt(ci.boxQty)||0)*bps+(parseInt(ci.caseQty)||0)*cps);
    });
    const tl = document.getElementById('cart-total-value');
    if (tl) tl.textContent = tot>0?'Approx Total: Rs '+tot.toFixed(2):'';
  } catch(e){}
  const countLbl = document.getElementById('cart-count-label');
  if (countLbl) countLbl.textContent = cart.length;
  if (!hasItems) return;
  if (list) {
    list.innerHTML = cart.map((item, idx) => {
      const safeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g,'_');
      const escapedId = String(item.id).replace(/'/g,"\\'");
      const schemeText = (item.offer||item.scheme||'').toString().trim();
      return '<div class="cart-item">'
        + '<div class="cart-item-body">'
          + '<div class="cart-item-name">' + esc(item.name || item.masterCode) + '</div>'
          + (item.composition ? '<div class="cart-item-comp" style="font-size:11px;color:#6b6560;margin-top:1px">' + esc(item.composition) + '</div>' : '')
          + (schemeText ? '<div style="font-size:10.5px;color:#145c30;font-weight:600;margin-top:2px">🎁 '+esc(schemeText)+'</div>' : '')
          // Editable qty inputs
          + '<div class="cart-qty-edit">'
            + '<div class="cart-qty-field"><span class="cart-qty-label">Loose</span><input class="cart-qty-input" type="number" inputmode="numeric" pattern="[0-9]*" min="0" value="'+Number(item.looseQty)+'" onchange="updateCartQty(\''+safeId+'\',\'loose\',this.value)" onfocus="if(this.value===\'0\')this.value=\'\'" onblur="if(this.value===\'\')this.value=\'0\'"></div>'
            + '<div class="cart-qty-field"><span class="cart-qty-label">Box</span><input class="cart-qty-input" type="number" inputmode="numeric" pattern="[0-9]*" min="0" value="'+Number(item.boxQty)+'" onchange="updateCartQty(\''+safeId+'\',\'box\',this.value)" onfocus="if(this.value===\'0\')this.value=\'\'" onblur="if(this.value===\'\')this.value=\'0\'"></div>'
            + '<div class="cart-qty-field"><span class="cart-qty-label">Case</span><input class="cart-qty-input" type="number" inputmode="numeric" pattern="[0-9]*" min="0" value="'+Number(item.caseQty)+'" onchange="updateCartQty(\''+safeId+'\',\'case\',this.value)" onfocus="if(this.value===\'0\')this.value=\'\'" onblur="if(this.value===\'\')this.value=\'0\'"></div>'
          + '</div>'
          // Product-wise remark
          + '<input class="cart-item-remark-input" type="text" placeholder="📝 Remark for this product (optional)…" value="'+esc(item.remark||'')+'" oninput="updateCartRemark(\''+escapedId+'\',this.value)">'
        + '</div>'
        + '<button class="cart-remove" onclick="removeFromCart(\'' + escapedId + '\')" type="button">✕</button>'
        + '</div>';
    }).join('');
  }
}

function updateCartQty(safeId, type, val) {
  const num = Math.max(0, parseInt(val)||0);
  const idx = cart.findIndex(c => String(c.id).replace(/[^a-zA-Z0-9_-]/g,'_') === safeId);
  if (idx < 0) return;
  if (type === 'loose') cart[idx].looseQty = num;
  if (type === 'box')   cart[idx].boxQty   = num;
  if (type === 'case')  cart[idx].caseQty  = num;
  // If every quantity is now zero, drop the product from the cart.
  const l = parseInt(cart[idx].looseQty) || 0;
  const b = parseInt(cart[idx].boxQty)   || 0;
  const c = parseInt(cart[idx].caseQty)  || 0;
  if (l + b + c === 0) {
    cart.splice(idx, 1);
    saveCart();
    renderCart();
    refreshCards();
    return;
  }
  saveCart();
}

function updateCartRemark(id, remark) {
  const idx = cart.findIndex(c => String(c.id) === id);
  if (idx < 0) return;
  cart[idx].remark = remark;
  saveCart();
}


function refreshCards() {
  document.querySelectorAll('.pcard').forEach(card => {
    const parts  = card.id.split('-');
    const safeId = parts.slice(2).join('-');
    const prefix = parts[1];
    const inC    = cart.some(c => String(c.id).replace(/[^a-zA-Z0-9_-]/g, '_') === safeId);
    const bot    = card.querySelector('.pcard-bottom');
    if (!bot) return;
    if (inC) { bot.innerHTML = '<div class="added-badge">✓ In Cart</div>'; return; }
    const src = prefix === 'ofs' ? allOffers : allProducts;
    const p   = src.find(pr => String(pr.id).replace(/[^a-zA-Z0-9_-]/g, '_') === safeId);
    if (!p) return;
    const rId = esc(String(p.id));
    const bps = parseInt(p.boxQty)||0;
    const cps = parseInt(p.caseQty)||0;
    const sizeParts2 = [];
    if (p.stripPacking && p.stripPacking!=='0') sizeParts2.push('Strip: <b>'+esc(p.stripPacking)+'</b>');
    if (p.boxQty   && p.boxQty  !=='0') sizeParts2.push('Box: <b>'  +esc(p.boxQty)  +'</b>');
    if (p.caseQty  && p.caseQty !=='0') sizeParts2.push('Case: <b>' +esc(p.caseQty) +'</b>');
    const sizeBar2 = sizeParts2.length ? '<div class="size-info" style="margin-bottom:5px;font-size:11px">'+sizeParts2.join(' · ')+'</div>' : '';
    bot.innerHTML = sizeBar2
      + '<div class="qty-group">'
      + qtyInputHTML('ql', prefix, safeId, rId, bps, cps)
      + qtyInputHTML('qb', prefix, safeId, rId, bps, cps)
      + qtyInputHTML('qc', prefix, safeId, rId, bps, cps)
      + '</div>'
      + '<div class="total-qty-bar" id="tq-'+prefix+'-'+safeId+'">'
        + '<span class="tq-label">Total Qty</span>'
        + '<span class="tq-num" id="tqn-'+prefix+'-'+safeId+'">0</span>'
      + '</div>';
  });
}

/* ── Submit Mail Order ─────────────────────────────── */
async function submitOrder() {
  if (!cart.length) { toast('Cart is empty', 'err'); return; }
  // Switch to cart tab for order confirmation
  switchTab('cart', document.querySelector('[data-tab="cart"]'));
  // Scroll to submit box
  setTimeout(() => {
    const box = document.getElementById('cart-submit-box');
    if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

async function doSendMailOrder() {
  if (!cart.length) { toast('Cart is empty', 'err'); return; }
  const orderNo = 'JAP-' + String(Date.now()).slice(-7);
  const date    = todayStr();
  const remarks = (document.getElementById('delivery-remarks')?.value || '').trim();

  // Save to My Orders so the user can re-send it to WhatsApp later from the Orders tab.
  const myOrders = JSON.parse(localStorage.getItem(LS.MY_ORDERS) || '[]');
  myOrders.unshift({ oNo:orderNo, date, partyName:partyUser.name, partyMobile:partyUser.mobile, partyCity:partyUser.city||'', remarks, items:[...cart], count:cart.length });
  // No cap — full history kept server-side
  localStorage.setItem(LS.MY_ORDERS, JSON.stringify(myOrders));

  // Session tracking
  window._sessionOrders = (window._sessionOrders||0) + 1;
  const fromQB   = cart.filter(i => i._source === 'quickbuy').length;
  const fromProd = cart.length - fromQB;
  window._sessionProductsOrdered = (window._sessionProductsOrdered||0) + fromProd;
  window._sessionQuickBuyOrdered = (window._sessionQuickBuyOrdered||0) + fromQB;

  // Disable the submit button + show progress while we send.
  const sendBtn = document.getElementById('send-mail-order-btn') || document.querySelector('#cart-submit-box button');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.dataset._label = sendBtn.innerHTML; sendBtn.innerHTML = '⏳ Placing order…'; }
  toast('Placing order…', 'inf');

  const url   = localStorage.getItem(LS.SHEET_URL);
  const dSecs = window._orderStartTime ? Math.round((Date.now()-window._orderStartTime)/1000) : 0;
  const loc   = window._userLocation ? window._userLocation.lat.toFixed(5)+','+window._userLocation.lng.toFixed(5) : '';

  // IMPORTANT: await the POST so the e-mail is actually sent before we navigate
  // away. (A fire-and-forget fetch would be cancelled by the redirect.)
  // Post to backend — queue if offline so no order is ever silently lost (Fix #3)
  const orderPayload = { action:'order', token:partyToken(),
    partyName:partyUser.name, partyMobile:partyUser.mobile, partyCity:partyUser.city||'',
    items:cart.map(item => ({...item, scheme:item.offer||item.scheme||''})),
    orderNo, remarks, location:loc, durationSecs:dSecs };

  if (url) {
    try {
      await apiPost(url, orderPayload);
    } catch(e) {
      // Offline or backend unavailable — add to sync queue (Fix #3)
      _queueOrder(orderNo, orderPayload);
    }
  } else {
    _queueOrder(orderNo, orderPayload);
  }

  // Clear cart + refresh views
  cart = [];
  if (document.getElementById('delivery-remarks')) document.getElementById('delivery-remarks').value = '';
  saveCart(); renderCart(); refreshCards(); renderMyOrders(); renderQuickOrder();
  window._orderStartTime = Date.now();

  // Stay inside the app — switch back to Products tab.
  switchTab('products', document.querySelector('[data-tab="products"]'));
}

/* Build the WhatsApp order text from a stored order object */
function buildOrderWAMessage(o) {
  let msg = '🏥 *JAI AMBE PHARMA*\n📋 *Order:* ' + (o.oNo||'') + ' | 📅 ' + (o.date||'') + '\n━━━━━━━━━━━━━━━━━━━━━━\n';
  msg += '🏪 *' + (o.partyName||'') + '*' + (o.partyCity ? ' · ' + o.partyCity : '') + '\n';
  msg += '📱 ' + (o.partyMobile||'') + '\n';
  if (o.remarks) msg += '📝 ' + o.remarks + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━━━\n';
  (o.items||[]).forEach((item, i) => {
    const q = [];
    if (item.looseQty > 0) q.push('L:' + item.looseQty);
    if (item.boxQty   > 0) q.push('B:' + item.boxQty);
    if (item.caseQty  > 0) q.push('C:' + item.caseQty);
    msg += (i+1) + '. ' + (item.name || item.masterCode || '').slice(0, 40) + (item.masterCode ? ' (' + item.masterCode + ')' : '') + '\n   ' + q.join(' | ') + '\n';
  });
  let waTotal = 0;
  (o.items||[]).forEach(function(item){
    const live = allProducts.find(function(px){return String(px.id)===String(item.id)||px.masterCode===item.masterCode;});
    const rate = parseFloat((live&&(live.ptr||live.mrp))||item.ptr||item.mrp||0);
    const bps = parseInt((live&&live.boxQty)||item.boxPackSize||1);
    const cps = parseInt((live&&live.caseQty)||item.casePackSize||1);
    waTotal += rate*((parseInt(item.looseQty)||0)+(parseInt(item.boxQty)||0)*bps+(parseInt(item.caseQty)||0)*cps);
  });
  if (waTotal > 0) msg += '\n\nApprox. Total: Rs ' + waTotal.toFixed(2);
  msg += '\n\n_Jai Ambe Pharma B2B Portal, Hubballi_';
  return msg;
}

/* Send an existing order to WhatsApp (from the My Orders tab) */
function sendOrderToWhatsApp(oNo) {
  const waSent = JSON.parse(localStorage.getItem('jap_wa_sent')||'[]');
  if (waSent.includes(oNo) && !confirm('Already sent to WhatsApp. Send again?')) return;
  const o = JSON.parse(localStorage.getItem(LS.MY_ORDERS)||'[]').find(x => x.oNo === oNo);
  if (!o) { toast('Order not found', 'err'); return; }
  const msg = buildOrderWAMessage(o);
  const num = localStorage.getItem(LS.WA_NUM) || DEFAULT_WA;
  const a = document.createElement('a');
  a.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
  a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// JAP_HOMEPAGE_URL removed — after ordering we stay inside the app (Fix #1).
let _redirectTimer = null;

function showThankYou(orderNo, items) {
  const d = document.getElementById('thankyou-dialog');
  if (!d) {
    // No dialog in DOM — just redirect to homepage.
    switchTab('products', document.querySelector('[data-tab="products"]'));
    return;
  }
  const n = document.getElementById('thankyou-name');
  const o = document.getElementById('thankyou-order');
  if (n) n.textContent = partyUser.name;
  if (o) {
    o.textContent = 'Order ' + orderNo + ' / ' + (items||[]).length + ' products';
    o.style.cursor='pointer'; o.title='Tap to copy order number';
    o.onclick=function(){if(navigator.clipboard)navigator.clipboard.writeText(orderNo).then(function(){toast('Order no. copied!','ok');}).catch(function(){});};
  }
  d.style.display = 'flex';
  // Auto-redirect to the homepage after the confirmation has been shown.
  clearTimeout(_redirectTimer);
  _redirectTimer = setTimeout(() => closeThankYou(), 8000); // 8s to read summary, then tab-switch
}
function closeThankYou() {
  const d = document.getElementById('thankyou-dialog');
  if (d) d.style.display = 'none';
  // Whatever brought us here, send the user to the homepage now.
  clearTimeout(_redirectTimer);
  switchTab('products', document.querySelector('[data-tab="products"]'));
}
function quickWAOrder() {
  if (!cart.length) { toast('Cart is empty — add products first', 'err'); return; }
  submitOrder();
}

/* ── My Orders ────────────────────────────────────── */
function renderMyOrders() {
  const myOrders = JSON.parse(localStorage.getItem(LS.MY_ORDERS) || '[]');
  const el = document.getElementById('myorders-list');
  if (!el) return;
  if (!myOrders.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><strong>No orders yet</strong></div>';
    return;
  }
  el.innerHTML = myOrders.map(o =>
    '<div class="order-card" style="margin-bottom:12px">'
      + '<div class="order-card-hd"><div class="order-no">' + esc(o.oNo) + '</div>'
        + (function(st){
            if(st==='Done')       return '<span class="badge" style="background:#e8f5e9;color:#145c30">✅ Done</span>';
            if(st==='Processing') return '<span class="badge" style="background:#fff3e0;color:#e65100">⏳ Processing</span>';
            if(st==='pending')    return '<span class="badge" style="background:#fff8e1;color:#b8860b">⚠️ Pending Sync</span>';
            return '<span class="badge badge-sent">📤 Sent</span>';
          })(o.status||'Sent')
        + '</div>'
      + '<div class="order-meta">📅 ' + esc(o.date) + ' · ' + o.count + ' product' + (o.count!==1?'s':'') + (o.remarks?'<br>📝 '+esc(o.remarks):'') + '</div>'
      + '<div class="order-items" style="border-bottom:none">'
        + o.items.map(i => {
            const q=[];
            if(i.looseQty>0)q.push('L:'+i.looseQty);
            if(i.boxQty>0)q.push('B:'+i.boxQty);
            if(i.caseQty>0)q.push('C:'+i.caseQty);
            return '<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0"><span>' + esc((i.name||i.masterCode||'').slice(0,36)) + '</span><span style="color:var(--teal);font-weight:600;white-space:nowrap;margin-left:8px">' + q.join('·') + '</span></div>';
          }).join('')
      + '</div>'
      + '<div style="padding:8px 15px 12px;display:flex;gap:8px;flex-wrap:wrap">'
        + '<button class="reorder-btn" onclick="quickReorder(\'' + esc(o.oNo) + '\')" type="button" style="flex:1">🔁 Quick Reorder</button>'
        + '<button class="reorder-btn" onclick="sendOrderToWhatsApp(\'' + esc(o.oNo) + '\')" type="button" style="flex:1;background:#25d366;border-color:#25d366;color:#fff">📲 Send to WhatsApp</button>'
      + '</div>'
    + '</div>'
  ).join('');
}

function quickReorder(oNo) {
  const o = JSON.parse(localStorage.getItem(LS.MY_ORDERS)||'[]').find(x=>x.oNo===oNo);
  if (!o) { toast('Order not found','err'); return; }
  let skipped = 0;
  o.items.forEach(item => {
    const live = allProducts.find(p => String(p.id)===String(item.id)||p.masterCode===item.masterCode);
    if (live && parseInt(live.stockAvailable||0)===0) { skipped++; return; }
    const i=cart.findIndex(c=>String(c.id)===String(item.id));
    if(i>=0)cart[i]={...item};else cart.push({...item});
  });
  saveCart(); renderCart(); refreshCards();
  const added = o.items.length - skipped;
  toast(added+' items added'+(skipped?' ('+skipped+' no-stock skipped)':''),'ok');
  switchTab('cart', document.querySelector('[data-tab="cart"]'));
}

function clearAllOrders() {
  if (!confirm('Clear all order history?')) return;
  localStorage.removeItem(LS.MY_ORDERS);
  renderMyOrders(); renderQuickOrder();
  toast('Cleared','inf');
}

/* ── Quick Order — tabular, company-grouped ──────── */
function setQOFilter(f, el) { qoFilter = f; renderQuickOrder(); }

function buildQOCompanyChips(products) {
  const bar = document.getElementById('qo-filter-bar');
  if (!bar) return;
  const cos  = [...new Set(products.map(p=>p.company).filter(Boolean))].sort();
  const allA = qoFilter==='all'?'active':'';
  let html = '<button class="chip ' + allA + '" onclick="setQOFilter(\'all\',this)">All</button>';
  cos.forEach(co => {
    const s = getCompanyStyle(co);
    const isA = qoFilter===co;
    const style = isA?'background:'+s.color+';border-color:'+s.color+';color:#fff':'background:'+s.bg+';border-color:'+s.border+';color:'+s.color;
    html += '<button class="chip" style="' + style + '" data-co="' + esc(co) + '">' + esc(co) + '</button>';
  });
  bar.innerHTML = html;
  bar.querySelectorAll('[data-co]').forEach(btn => {
    btn.addEventListener('click', function(){ setQOFilter(this.getAttribute('data-co'),this); });
  });
}

function renderQuickOrder() {
  const myOrders = JSON.parse(localStorage.getItem(LS.MY_ORDERS)||'[]');
  const favs     = getFavourites();
  const grid  = document.getElementById('quick-order-grid');
  const empty = document.getElementById('quick-order-empty');
  if (!grid) return;
  if (!myOrders.length && !favs.length) { grid.innerHTML=''; if(empty)empty.classList.remove('hidden'); return; }
  if (empty) empty.classList.add('hidden');

  const seen = new Map();

  // First: add favourites (pinned at top)
  favs.forEach(fav => {
    const id = String(fav.id||fav.masterCode||'');
    if (!id) return;
    const full = allProducts.find(p => String(p.id)===id || String(p.masterCode)===id);
    seen.set(id, {
      id,
      masterCode : fav.masterCode||(full?.masterCode)||'',
      namePack   : fav.name||(full?.displayName)||(full?.namePack)||'',
      displayName: fav.name||(full?.displayName)||(full?.namePack)||'',
      name       : fav.name||(full?.displayName)||(full?.namePack)||'',
      composition: fav.composition||(full?.composition)||'',
      company    : fav.company||(full?.company)||'',
      boxQty     : fav.boxQty||(full?.boxQty)||'',
      caseQty    : fav.caseQty||(full?.caseQty)||'',
      scheme     : fav.scheme||(full?.scheme)||'',
      mrp        : fav.mrp||(full?.mrp)||'',
      pts        : fav.pts||(full?.pts)||'',
      _isFav     : true,
      _lastLoose : 0, _lastBox: 0, _lastCase: 0, _orderDate: '',
    });
  });

  // Then: merge in order history (skip already-seen)
  myOrders.forEach(order => {
    (order.items||[]).forEach(item => {
      const id = String(item.id||item.masterCode||'');
      if (!id||seen.has(id)) return;
      const full = allProducts.find(p => String(p.id)===id || String(p.masterCode)===id);
      seen.set(id, {
        id,
        masterCode : item.masterCode||(full?.masterCode)||'',
        namePack   : item.name||(full?.displayName)||(full?.namePack)||'',
        displayName: item.name||(full?.displayName)||(full?.namePack)||'',
        name       : item.name||(full?.displayName)||(full?.namePack)||'',
        composition: item.composition||(full?.composition)||'',
        company    : item.company||(full?.company)||'',
        boxQty     : full?.boxQty||'',
        caseQty    : full?.caseQty||'',
        scheme     : full?.scheme||'',
        _lastLoose : Number(item.looseQty)||0,
        _lastBox   : Number(item.boxQty)||0,
        _lastCase  : Number(item.caseQty)||0,
        _orderDate : order.date||'',
      });
    });
  });

  let all = [...seen.values()];
  buildQOCompanyChips(all);
  if (qoFilter!=='all') all = all.filter(p=>p.company===qoFilter);
  all.sort((a,b)=>{
    const ca = a.company||'', cb = b.company||'';
    if (ca !== cb) return ca.localeCompare(cb);
    return (a.name||'').localeCompare(b.name||'');
  });

  // Group by company
  const byCompany = new Map();
  all.forEach(p => {
    const co = p.company||'Other';
    if (!byCompany.has(co)) byCompany.set(co, []);
    byCompany.get(co).push(p);
  });

  // ── Single table with one sticky header across all companies ──
  let html = '<div class="qo-table-wrap">'
    + '<table class="qo-table">'
    + '<colgroup><col><col class="col-qty"><col class="col-qty"><col class="col-qty"><col class="col-total"></colgroup>'
    + '<thead><tr>'
    + '<th style="text-align:left">Product / Composition</th>'
    + '<th>Loose</th><th>Box</th><th>Case</th>'
    + '<th style="background:#1e40af">Total</th>'
    + '</tr></thead><tbody>';

  byCompany.forEach((products, company) => {
    const s = getCompanyStyle(company);
    // Company name as a full-width row inside tbody
    html += '<tr class="qo-company-row" style="background:' + s.color + '">'
      + '<td colspan="5">'
      + '<span style="font-weight:700;font-size:12.5px;letter-spacing:.02em">' + esc(company) + '</span>'
      + ' <span style="opacity:.65;font-size:11px;font-weight:400">(' + products.length + ')</span>'
      + '</td></tr>';

    products.forEach(p => {
      const inCart  = cart.some(c=>String(c.id)===String(p.id));
      const safeId  = String(p.id).replace(/[^a-zA-Z0-9_-]/g,'_');
      const realId  = esc(String(p.id));
      const boxSize  = parseInt(p.boxQty)||0;
      const caseSize = parseInt(p.caseQty)||0;
      const schemeVal = (p.scheme||'').toString().trim();
      const isFavRow  = isFavourite(p.id) || p._isFav;
      const rowCls = inCart ? 'qo-added' : (isFavRow ? 'qo-fav-row qo-swipe-row' : '');
      html += '<tr id="pc-qo-' + safeId + '"' + (rowCls ? ' class="'+rowCls+'"' : '')
        + (isFavRow ? ' data-fav-id="'+esc(String(p.id))+'"' : '') + '>'
        + '<td>'
          + '<div class="qo-pname">' + esc(p.name||p.masterCode) + '</div>'
          + (isFavRow ? '<span onclick="removeFavoriteById(\'' + esc(String(p.id)) + '\');renderQuickOrder();" title="Remove from favourites" style="float:right;cursor:pointer;font-size:16px;padding:0 4px;color:#e11d48" aria-label="Remove favourite">💔</span>' : '')
          + (p.composition?'<div class="qo-comp">'+esc(p.composition)+'</div>':'')
          + ((boxSize||caseSize)?'<div class="qo-pack-info">'+(boxSize?'<span>\ud83d\udce6 B:'+boxSize+'</span>':'')+(caseSize?'<span>\ud83d\uddc3\ufe0f C:'+caseSize+'</span>':'')+'</div>':'')
          + (schemeVal?'<div class="qo-scheme">\ud83c\udff7\ufe0f '+esc(schemeVal)+'</div>':'')
          + (p._lastLoose||p._lastBox||p._lastCase?'<div class="qo-last">Last: '
              +[p._lastLoose?'L:'+p._lastLoose:'',p._lastBox?'B:'+p._lastBox:'',p._lastCase?'C:'+p._lastCase:''].filter(Boolean).join(' \xb7 ')
            +'</div>':'')
        + '</td>';
      if (inCart) {
        html += '<td colspan="3" style="text-align:center"><div class="added-badge">\u2713 In Cart</div></td>'
              + '<td></td>';
      } else {
        const oi = 'updateTableTotal(\'qo\',\''+safeId+'\','+boxSize+','+caseSize+');scheduleAutoSave(\'qo\',\''+safeId+'\',\''+realId+'\')';
        html += '<td style="text-align:center"><input class="qty-input" id="ql-qo-'+safeId+'" type="number" min="0" value="0" inputmode="numeric" autocomplete="off" onfocus="qFocus(this)" onblur="qBlur(this)" oninput="'+oi+'"></td>'
              + '<td style="text-align:center"><input class="qty-input" id="qb-qo-'+safeId+'" type="number" min="0" value="0" inputmode="numeric" autocomplete="off" onfocus="qFocus(this)" onblur="qBlur(this)" oninput="'+oi+'"></td>'
              + '<td style="text-align:center"><input class="qty-input" id="qc-qo-'+safeId+'" type="number" min="0" value="0" inputmode="numeric" autocomplete="off" onfocus="qFocus(this)" onblur="qBlur(this)" oninput="'+oi+'"></td>'
              + '<td style="text-align:center;background:#eff6ff"><span id="tbl-total-qo-'+safeId+'" style="font-weight:700;font-size:14px;color:#1a5fb4">0</span></td>';
      }
      html += '</tr>';
    });
  });

  html += '</tbody></table></div>';

  grid.innerHTML = html;
  qoFiltered  = all;
  qoDisplayed = all.length; // All rendered at once in table mode
  initQOSwipeRows();
}

function initQOSwipeRows() {
  document.querySelectorAll('.qo-swipe-row[data-fav-id]').forEach(function(row) {
    if (row._swipeBound) return;
    row._swipeBound = true;
    let startX = 0;
    row.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
    row.addEventListener('touchend', function(e) {
      const dx = e.changedTouches[0].clientX - startX;
      row.style.transform = '';
      if (Math.abs(dx) >= 100) removeFavoriteById(row.getAttribute('data-fav-id'));
    });
    row.addEventListener('mousedown', function(e) { startX = e.clientX; });
    row.addEventListener('mouseup', function(e) {
      const dx = e.clientX - startX;
      if (Math.abs(dx) >= 100) removeFavoriteById(row.getAttribute('data-fav-id'));
    });
  });
}

function removeFavoriteById(id) {
  if (!id) return;
  let favs = getFavourites();
  const n = favs.length;
  favs = favs.filter(function(f) { return String(f.id) !== String(id); });
  if (favs.length === n) return;
  saveFavourites(favs);
  _scheduleFavSync();
  toast('Removed from Quick Buy ❤️', 'inf');
  renderQuickOrder();
}

function onQuickBuySearch() {
  clearTimeout(_qoSearchTimer);
  _qoSearchTimer = setTimeout(function() {
    const q = (document.getElementById('qo-search')?.value || '').trim().toLowerCase();
    if (q.length < 2) return;
    const terms = q.split(/\s+/).filter(Boolean);
    const match = allProducts.find(function(p) {
      return terms.every(function(t) { return (p.searchText || '').includes(t); });
    });
    if (!match) return;
    if (!isFavourite(match.id)) toggleFavourite(match, 'qo');
    const inp = document.getElementById('qo-search');
    if (inp) inp.value = '';
    renderQuickOrder();
  }, 450);
}

function loadMoreQO() { /* no-op: table mode renders all at once */ }

function clearQuickOrderHistory() {
  if (!confirm('Clear history?')) return;
  localStorage.removeItem(LS.MY_ORDERS);
  renderMyOrders(); renderQuickOrder();
  toast('Cleared','inf');
}

/* ── Per-row count ────────────────────────────────── */
function setColCount(n) {
  document.querySelectorAll('.product-grid').forEach(g=>g.setAttribute('data-cols',n));
  localStorage.setItem('jap_cols',n);
}

/* ── PWA / Install ────────────────────────────────── */
let _dp = null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); _dp=e; });
window.addEventListener('appinstalled', ()=>{ _dp=null; toast('App installed ✓','ok'); });
function installApp(){ if(_dp){ _dp.prompt(); _dp.userChoice.then(()=>{ _dp=null; }); } else { showIOSInstallPopup(); } }

/* ── Tab switching ────────────────────────────────── */
/* ── Offline order queue (Fix #3) ─────────────────────────────────────
   Orders that fail to POST (offline, backend down) are stored here and
   auto-retried when the device comes back online. Each queued order gets
   a ⚠️ "Pending Sync" badge in the Orders tab until confirmed. */
function _queueOrder(orderNo, payload) {
  try {
    const q = JSON.parse(localStorage.getItem(LS.ORDER_QUEUE) || '[]');
    if (!q.find(x => x.orderNo === orderNo)) {
      q.push({ orderNo, payload, queuedAt: Date.now() });
      localStorage.setItem(LS.ORDER_QUEUE, JSON.stringify(q));
      // Mark the local order as pending sync
      const orders = JSON.parse(localStorage.getItem(LS.MY_ORDERS) || '[]');
      const idx = orders.findIndex(o => o.oNo === orderNo);
      if (idx >= 0) { orders[idx].status = 'pending'; localStorage.setItem(LS.MY_ORDERS, JSON.stringify(orders)); }
      renderMyOrders();
      toast('⚠️ Offline — order saved. Will sync when back online.', 'inf');
    }
  } catch(e) {}
}

async function syncOrderQueue() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return;
  try {
    const q = JSON.parse(localStorage.getItem(LS.ORDER_QUEUE) || '[]');
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      try {
        await apiPost(url, item.payload);
        // Synced — update local status to 'Sent'
        const orders = JSON.parse(localStorage.getItem(LS.MY_ORDERS) || '[]');
        const idx = orders.findIndex(o => o.oNo === item.orderNo);
        if (idx >= 0) { orders[idx].status = 'Sent'; localStorage.setItem(LS.MY_ORDERS, JSON.stringify(orders)); }
        toast('✅ Order ' + item.orderNo + ' synced to server', 'ok');
      } catch(e) {
        remaining.push(item); // still offline — keep in queue
      }
    }
    localStorage.setItem(LS.ORDER_QUEUE, JSON.stringify(remaining));
    renderMyOrders();
  } catch(e) {}
}

// Auto-sync when device comes back online
window.addEventListener('online', function() {
  setTimeout(syncOrderQueue, 2000); // small delay so connection is stable
  toast('🌐 Back online — syncing pending orders…', 'inf');
});

function switchTab(tab, el) {
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('on'));
  document.getElementById('tab-'+tab)?.classList.add('on');
  document.querySelectorAll('.bnav-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  const cols = localStorage.getItem('jap_cols')||'2';
  // Show sticky filter bar only on Products tab
  const sf = document.getElementById('sticky-filters');
  if (sf) sf.style.display = (tab === 'products') ? 'block' : 'none';
  if(tab==='cart')       renderCart();
  if(tab==='myorders')   renderMyOrders();
  if(tab==='quickorder') { renderQuickOrder(); setTimeout(setupQOScrollObserver, 100); }
  if(tab==='specialschemes') { renderSpecialSchemes(); }
  if(tab==='offers') {
    renderOffers();
    document.getElementById('offers-grid')?.setAttribute('data-cols', cols);
  }
  if(tab==='nearexpiry') {
    renderNearExpiry();
    document.getElementById('ne-grid')?.setAttribute('data-cols', cols);
  }
  if(tab==='products') setTimeout(setupScrollObserver, 100);
  const sticky = document.getElementById('sticky-search');
  if (sticky) sticky.style.display = (tab === 'products' || tab === 'nearexpiry') ? 'block' : 'none';
  document.querySelector('.app-body')?.scrollTo(0,0);
}
