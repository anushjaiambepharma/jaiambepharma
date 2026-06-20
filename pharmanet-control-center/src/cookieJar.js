// Minimal cookie jar for server-side scraping of an ASP.NET WebForms site.
// fetch() in Workers does not persist cookies across requests, so we track
// them manually and attach a Cookie header on every outgoing request.
export class CookieJar {
  constructor() {
    this.cookies = new Map(); // name -> value
  }

  /** Read every Set-Cookie header from a Response and merge into the jar. */
  captureFrom(response) {
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() !== 'set-cookie') continue;
      const firstPair = value.split(';')[0];
      const eq = firstPair.indexOf('=');
      if (eq === -1) continue;
      const name = firstPair.slice(0, eq).trim();
      const val = firstPair.slice(eq + 1).trim();
      if (name) this.cookies.set(name, val);
    }
  }

  /** Build the Cookie header value to send on the next request. */
  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  isEmpty() {
    return this.cookies.size === 0;
  }
}
