import { CookieJar } from './cookieJar.js';
import { extractAllHiddenFields, parseGridRows, extractViewReportUrl } from './aspxForm.js';
import {
  BASE_URL,
  TRANSACTIONS_PATH,
  INVOICE_PRINT_PATH,
  DEFAULT_PLANT,
  DOC_TYPE_CODE,
  DIVISION_CODE,
  INVOICE_TYPE_CODE,
  BROWSER_TYPE_HEADER_VALUE,
  STATUS,
} from './constants.js';

export class PharmaNetError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const TRANSACTION_COLUMNS = [
  'customerName',
  'divisionNo',
  'divisionName',
  'plantName',
  'documentNo',
  'transactionDate',
  'remark',
];

const INVOICE_COLUMNS = ['code', 'customerName', 'place', 'documentNo', 'documentDate', 'totalAmount'];

export class PharmaNetClient {
  constructor() {
    this.jar = new CookieJar();
    this.loggedIn = false;
  }

  /** GET/POST with manual redirect handling so we never lose a Set-Cookie on a hop. */
  async request(url, options = {}) {
    let currentUrl = url;
    let opts = { ...options };
    let response;
    for (let hop = 0; hop < 5; hop++) {
      const headers = new Headers(opts.headers || {});
      if (!this.jar.isEmpty()) headers.set('Cookie', this.jar.toHeader());
      response = await fetch(currentUrl, { ...opts, headers, redirect: 'manual' });
      this.jar.captureFrom(response);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) break;
        currentUrl = new URL(location, currentUrl).toString();
        opts = { method: 'GET' };
        continue;
      }
      break;
    }
    return response;
  }

  async login(userId, password) {
    const loginUrl = BASE_URL;
    const getResp = await this.request(loginUrl, { method: 'GET' });
    const html = await getResp.text();
    const hidden = extractAllHiddenFields(html);

    const body = new URLSearchParams({
      ...hidden,
      HFBrowserType: BROWSER_TYPE_HEADER_VALUE,
      'LogPhNet$UserName': userId,
      'LogPhNet$Password': password,
      'LogPhNet$btnLogin': 'Login',
    });

    const postResp = await this.request(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const postHtml = await postResp.text();

    const stillOnLoginForm = /LogPhNet\$UserName/i.test(postHtml);
    if (stillOnLoginForm) {
      throw new PharmaNetError(STATUS.FAILED_LOGIN_ERROR, 'PharmaNET login failed. Check User ID/Password.');
    }
    this.loggedIn = true;
  }

  /**
   * Run one search on a report page and return its parsed grid rows plus the
   * hidden fields needed for a follow-up "View Report" AJAX postback.
   */
  async searchTransactions({ docType, division, fromDate, toDate, plant = DEFAULT_PLANT }) {
    const url = `${BASE_URL}${TRANSACTIONS_PATH}`;
    const getResp = await this.request(url, { method: 'GET' });
    const getHtml = await getResp.text();
    const hidden = extractAllHiddenFields(getHtml);

    const body = new URLSearchParams({
      ...hidden,
      'ctl00$ConPhameNet$ddlPlant': plant,
      'ctl00$ConPhameNet$ddlDocType': DOC_TYPE_CODE[docType] || docType,
      'ctl00$ConPhameNet$ddlDivision': DIVISION_CODE[division] || DIVISION_CODE.ALL,
      'ctl00$ConPhameNet$txtFromDate': fromDate,
      'ctl00$ConPhameNet$txtToDate': toDate,
      'ctl00$ConPhameNet$btnGo': 'Go',
    });
    const postResp = await this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const resultHtml = await postResp.text();

    return {
      pageUrl: url,
      // The grid's checkboxes/buttons live inside <select> controls too (plant/doc
      // type/division/customer). Those never show up in extractAllHiddenFields
      // since they aren't <input type="hidden">, but ASP.NET still needs their
      // current values on the follow-up "View Report" postback or it 500s.
      hiddenFields: {
        ...extractAllHiddenFields(resultHtml),
        'ctl00$ConPhameNet$ddlPlant': plant,
        'ctl00$ConPhameNet$ddlDocType': DOC_TYPE_CODE[docType] || docType,
        'ctl00$ConPhameNet$ddlDivision': DIVISION_CODE[division] || DIVISION_CODE.ALL,
        'ctl00$ConPhameNet$ddlCustomer': 'ALL',
      },
      rows: parseGridRows(resultHtml, 'ctl00_ConPhameNet_gvTransactionDetails', TRANSACTION_COLUMNS),
    };
  }

  async searchInvoices({ invoiceType, fromDate, toDate, plant = DEFAULT_PLANT }) {
    const url = `${BASE_URL}${INVOICE_PRINT_PATH}`;
    const getResp = await this.request(url, { method: 'GET' });
    const getHtml = await getResp.text();
    const hidden = extractAllHiddenFields(getHtml);

    const body = new URLSearchParams({
      ...hidden,
      'ctl00$ConPhameNet$ddlPlant': plant,
      'ctl00$ConPhameNet$ddlType': INVOICE_TYPE_CODE[invoiceType] || INVOICE_TYPE_CODE.ALL,
      'ctl00$ConPhameNet$txtFromDate': fromDate,
      'ctl00$ConPhameNet$txtToDate': toDate,
      'ctl00$ConPhameNet$btnGo': 'Go',
    });
    const postResp = await this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const resultHtml = await postResp.text();

    return {
      pageUrl: url,
      hiddenFields: {
        ...extractAllHiddenFields(resultHtml),
        'ctl00$ConPhameNet$ddlPlant': plant,
        'ctl00$ConPhameNet$ddlType': INVOICE_TYPE_CODE[invoiceType] || INVOICE_TYPE_CODE.ALL,
        'ctl00$ConPhameNet$ddlCustomer': 'ALL',
      },
      rows: parseGridRows(resultHtml, 'ctl00_ConPhameNet_gvTransactionDetails', INVOICE_COLUMNS),
    };
  }

  /**
   * Select one grid row's checkbox and trigger the "View Report" postback.
   *
   * This must be a normal (synchronous) form submit, not the ASP.NET AJAX
   * partial-postback (UpdatePanel) request: live testing showed the AJAX path
   * returns a bare "0|error|500||" delta for this control, while submitting
   * btnViewReport as a plain HTML form post returns the full re-rendered page
   * with the same window.open(...) startup script the browser would receive.
   */
  async viewReport(pageUrl, hiddenFields, checkboxName) {
    const body = new URLSearchParams({
      ...hiddenFields,
      [checkboxName]: 'on',
      'ctl00$ConPhameNet$btnViewReport': 'View Report',
    });
    const resp = await this.request(pageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await resp.text();
    const reportUrl = extractViewReportUrl(text);
    if (!reportUrl) {
      throw new PharmaNetError(STATUS.FAILED_PDF_ERROR, 'View Report did not return a document URL.');
    }
    // PharmaNET embeds the row's identifying values (customer/doc no/etc.) as
    // ",VALUE," query params. If row resolution silently fails server-side it
    // still returns 200 + a PDF, just a blank template with none of those
    // values filled in — so an empty bracket here means "wrong document",
    // not "no document", and must be treated as a hard failure.
    if (/=,,/.test(reportUrl) || /=,(&|$)/.test(reportUrl)) {
      throw new PharmaNetError(
        STATUS.FAILED_PDF_ERROR,
        'View Report resolved to a document URL with missing identifiers; refusing to download a possibly blank/incorrect PDF.'
      );
    }
    return reportUrl;
  }

  async downloadPdf(relativeUrl, baseUrl) {
    const url = new URL(relativeUrl, baseUrl).toString();
    const resp = await this.request(url, { method: 'GET' });
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('pdf')) {
      throw new PharmaNetError(STATUS.FAILED_PDF_ERROR, `Expected a PDF but got "${contentType}".`);
    }
    return resp.arrayBuffer();
  }
}
