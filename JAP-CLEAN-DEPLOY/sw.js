/* ============================================================
   JAI AMBE PHARMA — Service Worker v6 (network-first app shell + Safari-safe)
   Fixed: URL persists across SW restarts via cache
   Background notifications fire even when app is fully closed
   ============================================================ */

const CACHE_NAME   = 'jap-v48';
const CONFIG_CACHE = 'jap-config';
const STATIC_ASSETS = ['/party.html','/css/style.css','/css/jap-premium.css','/js/api.js','/js/party.js','/logo-sm.png','/manifest.json'];

self.addEventListener('install',  e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS).catch(()=>{}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== CONFIG_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('google') || url.hostname.includes('script')) return;
  if (event.request.method !== 'GET') return;

  // Network-FIRST for the app shell (HTML, JS, CSS) so a new deploy is picked
  // up immediately instead of users being stuck on a cached old version.
  var accept = event.request.headers.get('accept') || '';
  var isShell = accept.indexOf('text/html') !== -1 || /\.(js|css)(\?|$)/i.test(url.pathname);
  if (isShell) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          var c = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, c));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-FIRST for everything else (images/logo) — these rarely change.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(r => {
        var c = r.clone();
        if (r && r.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, c));
        return r;
      });
    })
  );
});

/* ── Background sync events ──────────────────────── */
self.addEventListener('periodicsync', e => {
  if (e.tag === 'jap-notif') e.waitUntil(bgCheckNotif());
});
self.addEventListener('sync', e => {
  if (e.tag === 'jap-notif-sync') e.waitUntil(bgCheckNotif());
});

/* ── Push (server-initiated) ─────────────────────── */
self.addEventListener('push', e => {
  if (!e.data) return;
  let d;
  try { d = e.data.json(); } catch(_) { d = { title:'Jai Ambe Pharma', body: e.data.text() }; }
  e.waitUntil(showNotif(d.title || 'Jai Ambe Pharma', d.body || '', d.url || 'party.html'));
});

/* ── Notification click ──────────────────────────── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || (self.registration.scope + 'party.html');
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/party') && 'focus' in c) {
          c.postMessage({ type:'notification', title: e.notification.title });
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

/* ── Messages from page ──────────────────────────── */
self.addEventListener('message', e => {
  const msg = e.data || {};

  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (msg.type === 'SET_SHEET_URL' && msg.url) {
    self._sheetUrl = msg.url;
    // KEY FIX: persist to cache so it survives SW restarts when app is closed
    caches.open(CONFIG_CACHE).then(c =>
      c.put('/sheet-url', new Response(msg.url, { headers:{ 'Content-Type':'text/plain' }}))
    );
  }

  if (msg.type === 'SHOW_NOTIFICATION') {
    showNotif(msg.title, msg.body || '', 'party.html');
  }

  if (msg.type === 'CHECK_NOTIFICATION') {
    bgCheckNotif();
  }

  if (msg.type === 'GET_SHEET_URL' && e.ports[0]) {
    getSheetUrl().then(url => e.ports[0].postMessage({ url: url || null }));
  }
});

/* ── Core: get sheet URL (memory → cache → open window) ── */
async function getSheetUrl() {
  // 1. Already in memory
  if (self._sheetUrl) return self._sheetUrl;

  // 2. Try persistent cache (KEY FIX: works when app is fully closed)
  try {
    const c   = await caches.open(CONFIG_CACHE);
    const res = await c.match('/sheet-url');
    if (res) {
      const url = await res.text();
      if (url) { self._sheetUrl = url; return url; }
    }
  } catch(_) {}

  // 3. Ask an open window (fallback, only if app is open)
  return askClientsForUrl();
}

/* ── Background notification check ──────────────── */
async function bgCheckNotif() {
  try {
    const url = await getSheetUrl();
    if (!url) return;

    var _sig; try { _sig = (typeof AbortSignal!=='undefined' && AbortSignal.timeout) ? AbortSignal.timeout(10000) : undefined; } catch(_){ _sig = undefined; }
    const res  = await fetch(url + '?action=notification', _sig ? { signal:_sig } : {});
    const data = await res.json();
    if (!data?.ok || !data.title) return;

    const key  = data.title + '|' + (data.body || '');
    const nc   = await caches.open('jap-notif');
    const prev = await nc.match('/last');
    const prevKey = prev ? await prev.text() : '';
    if (key === prevKey) return; // same notification, don't re-show

    await nc.put('/last', new Response(key));
    await showNotif(data.title, data.body || '', 'party.html');

    // Also push to any open windows
    const cl = await clients.matchAll({ type:'window' });
    cl.forEach(c => c.postMessage({ type:'NEW_NOTIFICATION', title:data.title, body:data.body||'' }));
  } catch(_) {}
}

/* ── Show notification ───────────────────────────── */
async function showNotif(title, body, url) {
  var targetUrl = /^https?:\/\//i.test(url || '') ? url : (self.registration.scope + (url || 'party.html'));
  return self.registration.showNotification(title, {
    body,
    icon    : self.registration.scope + 'logo-sm.png',
    badge   : self.registration.scope + 'logo-sm.png',
    data    : { url: targetUrl },
    vibrate : [200, 100, 200],
    tag     : 'jap-notif',
    renotify: true,
  });
}

/* ── Ask open windows for sheet URL ─────────────── */
async function askClientsForUrl() {
  try {
    const list = await clients.matchAll({ type:'window', includeUncontrolled:true });
    if (!list.length) return null;
    return new Promise(resolve => {
      const mc = new MessageChannel();
      mc.port1.onmessage = e => resolve(e.data?.url || null);
      list[0].postMessage({ type:'GET_SHEET_URL' }, [mc.port2]);
      setTimeout(() => resolve(null), 1500);
    });
  } catch(_) { return null; }
}