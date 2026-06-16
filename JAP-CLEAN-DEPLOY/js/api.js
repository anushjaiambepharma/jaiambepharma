/* ============================================================
   JAI AMBE PHARMA — api.js  v6 (v20 backend)
   v6 changes:
     - JAP_CACHE_VERSION = 'v22' — bump to wipe stale caches on every device
     - fetchRemoteConfig() pulls Deployment ID / Web App URL / Library URL
       from the CONFIG sheet via ?action=getConfig
     - fetchSchemes() pulls dedicated Schemes sheet rows via ?action=schemes
     - buildSchemeOverlayMap() merges scheme rows over Products feed by code
   ============================================================ */

const JAP_CACHE_VERSION = 'v48';

/** Default party permission flags (sheet columns are source of truth). */
const PARTY_PERM_DEFAULTS = {
  removeAvailability: false,
  showAvailableLabel: false,
  showExactQty: false,
  hideScheme: false,
  hideSpecialScheme: false,
  hideOffers: false,
  hideNotifications: false,
  hideWhatsApp: false
};

const PARTY_PERM_KEYS = Object.keys(PARTY_PERM_DEFAULTS);

const LS = {
  SHEET_URL    : 'jap_sheet_url',
  WA_NUM       : 'jap_wa_num',
  PARTY        : 'jap_party_user',
  CART         : 'jap_cart',
  MY_ORDERS    : 'jap_my_orders',
  FAVORITES    : 'jap_favorites',
  PRODUCTS     : 'jap_products_cache',
  PRODUCTS_TS  : 'jap_products_ts',
  OFFERS       : 'jap_offers_cache',
  OFFERS_TS    : 'jap_offers_ts',
  SCHEMES      : 'jap_schemes_cache',
  SCHEMES_TS   : 'jap_schemes_ts',
  COMPANIES    : 'jap_companies_cache',
  ORDER_QUEUE  : 'jap_order_queue',         // offline orders waiting to sync
  NEAR_EXPIRY  : 'jap_nearexpiry_cache',   // dedicated "Near Expiry" sheet
  NEAR_EXPIRY_TS : 'jap_nearexpiry_ts',
  SPECIAL_SS   : 'jap_specialss_cache',    // dedicated "Special Schemes" sheet
  SPECIAL_SS_TS: 'jap_specialss_ts',
  SHOW_STOCK   : 'jap_show_stock',
  CACHE_VER    : 'jap_cache_version',
  CONFIG       : 'jap_remote_config',
  CONFIG_TS    : 'jap_remote_config_ts',
  TOKEN        : 'jap_token',          // party session token
  ADMIN_TOKEN  : 'jap_admin_token',    // admin session token
  APPROVED     : 'jap_approved',       // '1' once the party is approved
  NOTIF_SEEN   : 'jap_notif_seen_ts',  // last-seen notification timestamp
};

// ── Storage separation (req #5/#6) ────────────────────────────────
// AUTH_KEYS = the "login cookie": who you are + your session. These PERSIST
//   and are NEVER cleared by a data refresh, so an approved device stays
//   logged in forever (req #4).
// DATA_KEYS = the "inside workings": products, schemes, offers, etc. These are
//   refreshed on every entry to the app and may be safely wiped/re-fetched.
const LS_AUTH_KEYS = [LS.TOKEN, LS.ADMIN_TOKEN, LS.APPROVED, LS.PARTY, LS.SHEET_URL, LS.WA_NUM, 'jap_device_id'];
const LS_DATA_KEYS = [LS.PRODUCTS, LS.PRODUCTS_TS, LS.OFFERS, LS.OFFERS_TS, LS.SCHEMES, LS.SCHEMES_TS,
                      LS.COMPANIES, LS.NEAR_EXPIRY, LS.NEAR_EXPIRY_TS, LS.SPECIAL_SS, LS.SPECIAL_SS_TS];

/** Clear ONLY inside-app data — never touches the login/session keys. */
function clearInsideData() {
  try { LS_DATA_KEYS.forEach(function(k){ localStorage.removeItem(k); }); } catch(e) {}
}

// NOTE: the admin password is NOT stored in the client any more — it is held
// server-side in the Apps Script. Admin login posts the password and receives
// a short-lived session token (see adminLogin()).
const DEFAULT_WA = '917019382993';
const SHEET_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbzWeUCoIMQnM4lxK8uGfXDtky-xXlKsTQorBmofCYs7AqGuzE9f5YOswWEE_48V5Mu5/exec'; // updated with live deployment

(function cacheVersionGuard() {
  try {
    const stored = localStorage.getItem(LS.CACHE_VER);
    if (stored !== JAP_CACHE_VERSION) {
      clearAppDataCachesOnLoad();
      localStorage.setItem(LS.CACHE_VER, JAP_CACHE_VERSION);
      console.log('[JAP] Cache version updated to ' + JAP_CACHE_VERSION + ', stale caches cleared.');
    }
  } catch(e) {}
})();

/** Clear product/scheme/config caches on every page load so sheet data is always fresh. */
function clearAppDataCachesOnLoad() {
  try {
    [LS.PRODUCTS, LS.PRODUCTS_TS, LS.OFFERS, LS.OFFERS_TS,
     LS.SCHEMES, LS.SCHEMES_TS, LS.COMPANIES, LS.CONFIG, LS.CONFIG_TS,
     LS.NEAR_EXPIRY, LS.NEAR_EXPIRY_TS, LS.SPECIAL_SS, LS.SPECIAL_SS_TS,
     LS.NOTIF_SEEN, 'jap_last_notif']
      .forEach(k => localStorage.removeItem(k));
    if (typeof sessionStorage !== 'undefined') {
      ['jap_products_session', 'jap_schemes_session'].forEach(k => sessionStorage.removeItem(k));
    }
    clearCachedPartyPermissions();
  } catch(e) {}
}

/** Remove stale permission JSON from local storage — always re-fetch from sheet. */
function clearCachedPartyPermissions() {
  try {
    const raw = localStorage.getItem(LS.PARTY);
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.permissions !== undefined) {
        delete u.permissions;
        localStorage.setItem(LS.PARTY, JSON.stringify(u));
      }
    }
  } catch(e) {}
}

function normaliseSheetUrl(url) {
  const clean = String(url || '').trim();
  if (!clean) return '';
  return clean.split('?')[0].replace(/\/dev$/i, '/exec');
}

function setSheetUrl(url) {
  const clean = normaliseSheetUrl(url);
  if (!clean) return '';
  localStorage.setItem(LS.SHEET_URL, clean);
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => {
          const sw = reg.active || reg.waiting || reg.installing;
          if (sw) sw.postMessage({ type:'SET_SHEET_URL', url:clean });
        })
        .catch(() => {});
    }
  } catch(e) {}
  return clean;
}

(function autoConfig() {
  if (!localStorage.getItem('jap_sheet_url'))
    setSheetUrl(SHEET_URL_DEFAULT);
})();

/* ── Session tokens ───────────────────────────────── */
function partyToken() { return localStorage.getItem(LS.TOKEN) || ''; }
function adminToken() { return localStorage.getItem(LS.ADMIN_TOKEN) || ''; }
function setPartyToken(t) { if (t) localStorage.setItem(LS.TOKEN, t); }
function setAdminToken(t) { if (t) localStorage.setItem(LS.ADMIN_TOKEN, t); }
function clearPartyToken() { localStorage.removeItem(LS.TOKEN); localStorage.removeItem(LS.APPROVED); }

/* ── Device identity (the per-device login secret) ── */
function getDeviceId() {
  let d = localStorage.getItem('jap_device_id');
  if (!d) {
    d = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : ('dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10));
    localStorage.setItem('jap_device_id', d);
  }
  return d;
}
function deviceCode() {
  const d = getDeviceId().replace(/[^a-zA-Z0-9]/g,'');
  return d.slice(-6).toUpperCase();
}
function getBrowserType() {
  const ua = navigator.userAgent || '';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Other';
}

function getDeviceType() {
  const ua = navigator.userAgent || '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac (Laptop/Desktop)';
  if (/Windows/i.test(ua)) return 'Windows (Laptop/Desktop)';
  if (/Linux/i.test(ua)) return 'Linux (Laptop/Desktop)';
  return 'Other';
}

// Stable per-DEVICE fingerprint (same across browsers on one device — it does
// NOT include the browser/userAgent). Used so a device approved once is
// recognised even from a different browser. Not a hardware ID (web can't read
// IMEI), but good enough combined with the mobile number + admin approval.
async function getDeviceFingerprint() {
  try {
    const n = navigator;
    const sc = (typeof screen !== 'undefined') ? screen : {};
    const parts = [
      (sc.width||0) + 'x' + (sc.height||0),
      sc.colorDepth || '',
      (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
      n.platform || '',
      n.hardwareConcurrency || '',
      n.deviceMemory || '',
      n.maxTouchPoints || '',
      (n.language || '')
    ].join('|');
    return (await sha256Hex(parts)).slice(0, 24);
  } catch(e) { return ''; }
}

// Best-effort device model name. Android Chromium exposes the real model
// (e.g. "SM-G991B"); iPhone Safari only reports "iPhone".
async function getDeviceModel() {
  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      const d = await navigator.userAgentData.getHighEntropyValues(['model','platform','platformVersion']);
      const m = (d.model || '').trim();
      const plat = (d.platform || '') + (d.platformVersion ? ' ' + d.platformVersion : '');
      const out = m ? (m + (plat ? ' · ' + plat : '')) : plat;
      if (out && out.trim()) return out.trim();
    }
  } catch(e) {}
  return getDeviceType();
}
async function sha256Hex(str) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  } catch(e) { return ''; }
}

// Append the correct token to a GET data request (party token preferred,
// admin token as a fallback so the admin panel can preview catalogue data).
function dataAuthParam() {
  const t = partyToken() || adminToken();
  return t ? ('&token=' + encodeURIComponent(t)) : '';
}

/* Admin login — sends password to server, stores returned admin token. */
async function adminLogin(pw) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return { ok:false, msg:'No server URL' };
  try {
    const pwHash = await sha256Hex(pw);          // plaintext never leaves the browser
    const res = await apiPost(url, { action:'adminAuth', pwHash });
    if (res && res.ok && res.token) { setAdminToken(res.token); return { ok:true, mustChangePassword: !!res.mustChangePassword }; }
    return { ok:false, msg:(res && res.msg) || 'Login failed' };
  } catch(e) { return { ok:false, msg:String(e) }; }
}

/* Fetch the notification list (notification center). */
async function fetchNotifications() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return [];
  try {
    const res = await apiFetchTimeout(url + '?action=notifications' + dataAuthParam(), 12000);
    if (res && res.ok && Array.isArray(res.notifications)) return res.notifications;
  } catch(e) {}
  return [];
}

/* Fetch company/product remarks (overlay shown near products). */
let _japRemarks = { product:{}, company:{} };
async function fetchRemarks() {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return _japRemarks;
  try {
    const res = await apiFetchTimeout(url + '?action=remarks' + dataAuthParam(), 12000);
    if (res && res.ok) { _japRemarks = { product: res.product||{}, company: res.company||{} }; }
  } catch(e) {}
  return _japRemarks;
}
function remarkFor(p) {
  // product-level wins over company-level
  const mc = String(p.masterCode||'').toLowerCase();
  const pc = String(p.productCode||'').toLowerCase();
  const co = String(p.company||'').toLowerCase();
  const prod = _japRemarks.product || {};
  const comp = _japRemarks.company || {};
  return prod[mc] || prod[pc] || comp[co] || null;   // {remark, hideNoStock} | null
}

/* Fetch party-wise favourites configured in the Google Sheet. */
async function fetchPartyFavourites(mobile, deviceCodeStr) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return [];
  try {
    const res = await apiFetchTimeout(url + '?action=partyFavourites&mobile=' + encodeURIComponent(mobile||'') + '&deviceCode=' + encodeURIComponent(deviceCodeStr||'') + dataAuthParam(), 12000);
    if (res && res.ok && Array.isArray(res.favourites)) return res.favourites;
  } catch(e) {}
  return [];
}

function buildExecUrlFromDeploymentId(id) {
  const dep = String(id || '').trim();
  if (!dep) return '';
  // Already a full URL? strip and re-build defensively
  const m = dep.match(/\/s\/([^/?#]+)/);
  const cleanId = m ? m[1] : dep.replace(/^https?:\/\/.*\/s\//,'').replace(/\/exec.*$/,'').replace(/\/dev.*$/,'');
  if (!cleanId) return '';
  return 'https://script.google.com/macros/s/' + cleanId + '/exec';
}

// Lets the user paste a new URL or Deployment ID from the browser console.
// Returns the canonical URL stored in localStorage.
function setJapUrl(urlOrDeploymentId) {
  let u = String(urlOrDeploymentId || '').trim();
  if (!u) return localStorage.getItem(LS.SHEET_URL) || '';
  if (!/^https?:\/\//i.test(u) && !/\/s\//.test(u)) {
    // Looks like a bare Deployment ID
    u = buildExecUrlFromDeploymentId(u);
  }
  const clean = setSheetUrl(u);
  // Wipe caches so next load hits the new URL
  [LS.PRODUCTS, LS.PRODUCTS_TS, LS.OFFERS, LS.OFFERS_TS,
   LS.SCHEMES, LS.SCHEMES_TS, LS.COMPANIES, LS.CONFIG, LS.CONFIG_TS]
    .forEach(k => localStorage.removeItem(k));
  console.log('[JAP] Switched data source to ' + clean + '. Reloading…');
  try { toast('Switched to new Web App URL. Reloading…', 'ok'); } catch(e) {}
  setTimeout(() => location.reload(), 600);
  return clean;
}


function toast(msg, type = '') {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

/** Normalize Indian mobile to last 10 digits (sheet + app must match). */
function normalizeMobile(m) {
  const d = String(m || '').replace(/\D/g, '');
  if (d.length >= 10) return d.slice(-10);
  return d;
}

async function apiFetchTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    // NOTE: do NOT add Cache-Control/Pragma request headers here. They are not
    // CORS-safelisted, so they force a preflight OPTIONS request that Google
    // Apps Script cannot answer — which silently blocks every GET. cache:
    // 'no-store' already prevents caching without adding any request header.
    const res  = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store'
    });
    const text = await res.text();
    clearTimeout(timer);
    try { return JSON.parse(text); }
    catch(e) { throw new Error('Non-JSON: ' + text.slice(0,120)); }
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Timed out after ' + ms + 'ms');
    throw e;
  }
}

async function apiPost(url, body, ms = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res  = await fetch(url, { method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain'}, body:JSON.stringify(body), signal:controller.signal });
    const text = await res.text();
    clearTimeout(timer);
    try { return JSON.parse(text); }
    catch(e) { throw new Error('Non-JSON: ' + text.slice(0,150)); }
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Timed out after ' + ms + 'ms');
    throw e;
  }
}

// Quota-safe localStorage write — drops big caches and retries if full.
function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch(e) {
    try {
      [LS.PRODUCTS, LS.PRODUCTS_TS, LS.OFFERS, LS.OFFERS_TS, LS.SCHEMES, LS.SCHEMES_TS].forEach(k => localStorage.removeItem(k));
      localStorage.setItem(key, value); return true;
    } catch(e2) { try { console.warn('[JAP] localStorage full; not caching ' + key); } catch(_) {} return false; }
  }
}

async function fetchRemoteConfig({ silent = true } = {}) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return { config:null, urlChanged:false };
  try {
    const res = await apiFetchTimeout(url + '?action=getConfig', 12000);
    if (res && res.ok && res.config) {
      localStorage.setItem(LS.CONFIG,    JSON.stringify(res.config));
      localStorage.setItem(LS.CONFIG_TS, String(Date.now()));

      // Sync WhatsApp / support number from CONFIG.supportMobile.
      // CONFIG is the source of truth — overwrite local LS.WA_NUM whenever it changes.
      var supportMobile = String(res.config.supportMobile || '').trim();
      if (supportMobile && supportMobile !== localStorage.getItem(LS.WA_NUM)) {
        localStorage.setItem(LS.WA_NUM, supportMobile);
        if (!silent) console.log('[JAP] WhatsApp number updated from CONFIG → ' + supportMobile);
      }

      // Resolve the canonical Web App URL — prefer explicit webAppUrl,
      // else construct from deploymentId.
      let remoteUrl = normaliseSheetUrl(res.config.webAppUrl || '');
      if (!remoteUrl && res.config.deploymentId) {
        remoteUrl = buildExecUrlFromDeploymentId(res.config.deploymentId);
      }

      let urlChanged = false;
      if (remoteUrl && remoteUrl !== url) {
        // Validate the new URL with a ping before switching (footgun fix).
        // If the new URL doesn't respond with ok:true, we keep the current one.
        let newUrlOk = false;
        try {
          const pingRes = await apiFetchTimeout(remoteUrl + '?action=ping', 6000);
          newUrlOk = pingRes && pingRes.ok;
        } catch(e) { newUrlOk = false; }

        if (newUrlOk) {
          [LS.PRODUCTS, LS.PRODUCTS_TS, LS.OFFERS, LS.OFFERS_TS,
           LS.SCHEMES, LS.SCHEMES_TS, LS.COMPANIES]
            .forEach(k => localStorage.removeItem(k));
          setSheetUrl(remoteUrl);
          urlChanged = true;
          if (!silent) toast('Web App URL updated from CONFIG sheet', 'ok');
        } else {
          console.warn('[JAP] CONFIG sheet has a new webAppUrl but it failed the ping — keeping current URL to avoid breaking the app.');
        }
      }

      // FIX #5d: Use a SEPARATE key for the remote cache version so the
      // cacheVersionGuard (which checks JAP_CACHE_VERSION) never fires on
      // every refresh. Without this fix, fetchRemoteConfig overwrote
      // LS.CACHE_VER with the sheet value (e.g. 'v26') causing the guard to
      // re-trigger on every single page load.
      const remoteVer = String(res.config.cacheVersion || '').trim();
      const prevRemoteVer = localStorage.getItem('jap_remote_cache_ver') || '';
      if (remoteVer && remoteVer !== prevRemoteVer) {
        [LS.PRODUCTS, LS.PRODUCTS_TS, LS.OFFERS, LS.OFFERS_TS,
         LS.SCHEMES, LS.SCHEMES_TS, LS.COMPANIES]
          .forEach(k => localStorage.removeItem(k));
        localStorage.setItem('jap_remote_cache_ver', remoteVer);
        // Intentionally do NOT write to LS.CACHE_VER — that tracks the JS version.
        if (!silent) toast('Cache refreshed (server bumped version)', 'inf');
      }
      return { config:res.config, urlChanged };
    }
  } catch(e) {
    if (!silent) toast('Could not load CONFIG sheet', 'err');
  }
  return { config:null, urlChanged:false };
}

function getCachedConfig() {
  try { return JSON.parse(localStorage.getItem(LS.CONFIG) || '{}'); }
  catch(e) { return {}; }
}

async function fetchSchemes({ silent = true } = {}) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return [];
  try {
    const res = await apiFetchTimeout(url + '?action=schemes' + dataAuthParam(), 15000);
    if (res && res.ok && Array.isArray(res.schemes)) {
      localStorage.setItem(LS.SCHEMES,    JSON.stringify(res.schemes));
      localStorage.setItem(LS.SCHEMES_TS, String(Date.now()));
      return res.schemes;
    }
  } catch(e) {
    if (!silent) console.warn('fetchSchemes error', e);
  }
  return [];
}

function getCachedSchemes() {
  try { return JSON.parse(localStorage.getItem(LS.SCHEMES) || '[]'); }
  catch(e) { return []; }
}

/* ── Dedicated "Near Expiry" sheet (req #3) ───────────────────────── */
async function fetchNearExpiry({ silent = true } = {}) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return getCachedNearExpiry();
  try {
    const res = await apiFetchTimeout(url + '?action=nearExpiry' + dataAuthParam(), 20000);
    if (res && res.ok && Array.isArray(res.products)) {
      const fn = (res.format === 'array') ? normaliseProductArray : normaliseProduct;
      const list = res.products.map(fn).filter(p => p && p.id);
      safeSetItem(LS.NEAR_EXPIRY, JSON.stringify(list));
      localStorage.setItem(LS.NEAR_EXPIRY_TS, String(Date.now()));
      return list;
    }
  } catch(e) { if (!silent) console.warn('fetchNearExpiry error', e); }
  return getCachedNearExpiry();
}
function getCachedNearExpiry() {
  try { return JSON.parse(localStorage.getItem(LS.NEAR_EXPIRY) || '[]'); }
  catch(e) { return []; }
}

/* ── Dedicated "Special Schemes" sheet (req #3) ───────────────────── */
async function fetchSpecialSchemes({ silent = true } = {}) {
  const url = localStorage.getItem(LS.SHEET_URL);
  if (!url) return getCachedSpecialSchemes();
  try {
    const res = await apiFetchTimeout(url + '?action=specialSchemes' + dataAuthParam(), 20000);
    if (res && res.ok && Array.isArray(res.products)) {
      const fn = (res.format === 'array') ? normaliseProductArray : normaliseProduct;
      const list = res.products.map(fn).filter(p => p && p.id).map(function(p){
        // The scheme text lives in the product's scheme field; surface it as
        // specialScheme so the Special Schemes tab renders it like before.
        var sch = (p.specialScheme || p.scheme || p.productScheme || '').toString().trim();
        if (sch) p.specialScheme = sch;
        return p;
      });
      safeSetItem(LS.SPECIAL_SS, JSON.stringify(list));
      localStorage.setItem(LS.SPECIAL_SS_TS, String(Date.now()));
      return list;
    }
  } catch(e) { if (!silent) console.warn('fetchSpecialSchemes error', e); }
  return getCachedSpecialSchemes();
}
function getCachedSpecialSchemes() {
  try { return JSON.parse(localStorage.getItem(LS.SPECIAL_SS) || '[]'); }
  catch(e) { return []; }
}

function buildSchemeOverlayMap(schemes) {
  const m = {};
  (schemes || []).forEach(s => {
    if (!s || !s.scheme) return;
    if (s.masterCode)  m[String(s.masterCode).toLowerCase()]  = s.scheme;
    if (s.productCode) m[String(s.productCode).toLowerCase()] = s.scheme;
  });
  return m;
}

const CO_PALETTE = [
  { bg:'#fff3e0', color:'#a05000', border:'#f5c070' },
  { bg:'#ede8ff', color:'#5b3fa6', border:'#c4b5fd' },
  { bg:'#e6f0ff', color:'#1a5fb4', border:'#93c5fd' },
  { bg:'#e8f5e9', color:'#145c30', border:'#86efac' },
  { bg:'#fce4ec', color:'#b5252b', border:'#fca5a5' },
  { bg:'#e0f7fa', color:'#00695c', border:'#67e8f9' },
  { bg:'#fff8e1', color:'#f57f17', border:'#fde68a' },
  { bg:'#f3e5f5', color:'#6a1b9a', border:'#d8b4fe' },
];
const _coCache = {};
let   _coIdx   = 0;

function getCompanyStyle(company) {
  const key = (company||'').trim().toLowerCase();
  if (!_coCache[key]) { _coCache[key] = CO_PALETTE[_coIdx % CO_PALETTE.length]; _coIdx++; }
  return _coCache[key];
}

function companyTagHTML(company) {
  const s = getCompanyStyle(company);
  return '<span class="co-tag" style="background:'+s.bg+';color:'+s.color+';border-color:'+s.border+'">'+esc(company)+'</span>';
}

function normaliseAny(p) {
  return Array.isArray(p) ? normaliseProductArray(p) : normaliseProduct(p);
}

function normaliseProductArray(p) {
  if (!Array.isArray(p)) return normaliseProduct(p);
  const masterCode    = String(p[0]  || '').trim();
  const company       = String(p[1]  || '').trim();
  const division      = String(p[2]  || '').trim();
  const category      = String(p[3]  || '').trim();
  const packingType   = String(p[4]  || '').trim();
  const productCode   = String(p[5]  || '').trim();
  const productName   = String(p[6]  || '').trim();
  const productPack   = String(p[7]  || '').trim();
  const namePack      = String(p[8]  || '').trim();
  const composition   = String(p[9]  || '').trim();
  const stripPacking  = String(p[10] || '').trim();
  const looseQty      = String(p[11] || '').trim();
  const boxQty        = String(p[12] || '').trim();
  const caseQty       = String(p[13] || '').trim();
  const rating        = String(p[14] || '').trim();
  const scheme        = String(p[15] || '').trim();
  const stockAvailable= String(p[16] || '').trim();
  const soldInvoices  = String(p[17] || '').trim();
  const avgQtySold    = String(p[18] || '').trim();
  const mrp           = String(p[19] || '').trim();
  const pts           = String(p[20] || '').trim();
  const batch         = String(p[21] || '').trim();
  const expiry        = String(p[22] || '').trim();
  const daysToExpiry  = String(p[23] || '').trim();
  const nearExpiry    = String(p[24] || '').trim() === '1';
  const expiryRate    = String(p[25] || '').trim();
  const ptr           = String(p[26] || '').trim();

  const display = namePack ||
    [productName, productPack].filter(Boolean).join(' ').trim() ||
    masterCode || productCode || 'Unknown';
  const id = masterCode || productCode || String(Math.random());
  const stockNum = parseInt(stockAvailable) || 0;
  const soldNum  = parseInt(soldInvoices)   || 0;

  return {
    id, masterCode, company, division, category, packingType,
    productCode, productName, productPack,
    namePack:display, displayName:display,
    composition, stripPacking, looseQty, boxQty, caseQty, rating,
    scheme, stockAvailable, soldInvoices, avgQtySold,
    mrp, pts, ptr, batch, expiry, daysToExpiry, nearExpiry, expiryRate,
    hasScheme : !!scheme,
    hasStock  : stockNum > 0,
    stockNum, soldNum,
    isUPC     : productCode.startsWith('UPC') || masterCode.startsWith('UPC'),
    searchText: [display, productName, composition, company, division,
                 masterCode, productCode, category, batch]
      .filter(Boolean).join(' ').toLowerCase(),
  };
}

function normaliseProduct(p) {
  if (!p || typeof p !== 'object') return { id:'', displayName:'Unknown', searchText:'' };
  const namePack   = String(p.namePack    || p['product name & pack'] || '').trim();
  const prodName   = String(p.productName || p['product name']        || '').trim();
  const prodPack   = String(p.productPack || p['product pack']        || '').trim();
  const masterCode = String(p.masterCode  || p['master code']         || p['mastercode'] || '').trim();
  const productCode= String(p.productCode || p['product code']        || p['productcode'] || '').trim();
  const display    = namePack || [prodName,prodPack].filter(Boolean).join(' ').trim() || masterCode || productCode || 'Unknown';
  const id         = masterCode || productCode || String(p.id||Math.random()).trim();
  const composition  = String(p.composition  || p['product combination'] || '').trim();
  const looseQty     = String(p.looseQty     || p['loose qty']  || '').trim();
  const boxQty       = String(p.boxQty       || p['box / pack qty'] || '').trim();
  const caseQty      = String(p.caseQty      || p['case qty']   || '').trim();
  const scheme       = String(p.scheme || p.productScheme || p.productscheme || p['product scheme'] || p['Product Scheme'] || p['special scheme'] || p['specialscheme'] || p.offer || p.offers || p['scheme / offer'] || p['scheme/offer'] || '').trim();
  const stripPacking = String(p.stripPacking || p['strip packing'] || '').trim();
  const rating       = String(p.rating       || p['product rating'] || '').trim();
  const mrp          = String(p.mrp  || p['mrp']  || '').trim();
  const pts          = String(p.pts  || p['pts']  || '').trim();
  const stockAvailable = String(p.stockAvailable || p['stock available'] || '').trim();
  const soldInvoices = String(p.soldInvoices || p['product sold in no of invoice'] || '').trim();
  const expiry       = String(p.expiry || p['expiry'] || '').trim();
  const daysToExpiry = String(p.daysToExpiry || '').trim();
  const nearExpiry   = !!p.nearExpiry;
  const expiryRate   = String(p.expiryRate || p['expiry rates'] || '').trim();
  const company      = String(p.company    || '').trim();
  const stockNum     = parseInt(stockAvailable) || 0;
  const soldNum      = parseInt(soldInvoices) || 0;
  return {
    ...p, id, masterCode, productCode,
    displayName:display, namePack:namePack||display,
    productName:prodName, productPack:prodPack,
    composition, looseQty, boxQty, caseQty, scheme, stripPacking, rating,
    mrp, pts, stockAvailable, soldInvoices, expiry, daysToExpiry, nearExpiry, expiryRate,
    company, division:String(p.division||'').trim(),
    category:String(p.category||p['product category']||'').trim(),
    packingType:String(p.packingType||p['packing type']||'').trim(),
    isUPC    : productCode.toUpperCase().startsWith('UPC') || masterCode.toUpperCase().startsWith('UPC'),
    hasScheme: !!scheme,
    hasStock : stockNum > 0,
    stockNum, soldNum,
    searchText:[display,namePack,prodName,prodPack,composition,company,masterCode,productCode]
      .filter(Boolean).join(' ').toLowerCase(),
  };
}

function encodeProductForAttr(p) {
  const mini = {
    id           : String(p.id            || ''),
    masterCode   : String(p.masterCode    || ''),
    productCode  : String(p.productCode   || ''),
    productName  : String(p.productName   || ''),
    productPack  : String(p.productPack   || ''),
    namePack     : String(p.namePack      || p.displayName || ''),
    composition  : String(p.composition   || ''),
    company      : String(p.company       || ''),
    division     : String(p.division      || ''),
    category     : String(p.category      || ''),
    looseQty     : String(p.looseQty      || '0'),
    boxQty       : String(p.boxQty        || '0'),
    caseQty      : String(p.caseQty       || '0'),
    scheme       : String(p.scheme || p['product scheme'] || p['special scheme'] || p.specialscheme || ''),
    rating       : String(p.rating        || ''),
    hasScheme    : !!p.hasScheme,
    mrp          : String(p.mrp           || ''),
    pts          : String(p.pts           || ''),
    stripPacking : String(p.stripPacking  || ''),
    stockAvailable: String(p.stockAvailable || ''),
    soldInvoices : String(p.soldInvoices  || ''),
    expiry       : String(p.expiry        || ''),
    daysToExpiry : String(p.daysToExpiry  || ''),
    nearExpiry   : !!p.nearExpiry,
    hasStock     : !!p.hasStock,
  };
  return "JSON.parse(decodeURIComponent('" + encodeURIComponent(JSON.stringify(mini)) + "'))";
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function todayStr() {
  const d = new Date();
  return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
}
function pad(n) { return String(n).padStart(2,'0'); }

function ratingHTML(rating) {
  const r = parseFloat(rating)||0; if(!r)return '';
  const full=Math.floor(r), half=r-full>=0.5?1:0, empty=5-full-half;
  return '<span class="rating-stars">'+'★'.repeat(full)+(half?'½':'')+'☆'.repeat(empty)+' <span class="rating-num">'+r+'</span></span>';
}
