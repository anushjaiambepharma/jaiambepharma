/**
 * JAP static site — Cloudflare Worker (replace your current worker script with this).
 *
 * DO NOT add redirects to /party or /admin here. Those paths must be served
 * by static assets (party.html / admin.html) or you get ERR_TOO_MANY_REDIRECTS.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Optional: pretty URLs without redirect loops (internal rewrite only)
    if (url.pathname === '/party' || url.pathname === '/party/') {
      return env.ASSETS.fetch(new URL('/party.html', request.url));
    }
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return env.ASSETS.fetch(new URL('/admin.html', request.url));
    }

    return env.ASSETS.fetch(request);
  },
};
