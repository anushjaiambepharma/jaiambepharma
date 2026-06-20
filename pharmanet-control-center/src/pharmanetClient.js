import { CookieJar } from './cookieJar.js';
import { extractAllHiddenFields, extractSelectOptions, extractLabelText, parseGridRows, extractViewReportUrl } from './aspxForm.js';
import { buildNormalOrderPayload } from './salesOrderBuilder.js';
import { buildGenericOrderPayload } from './genericOrderBuilder.js';
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

const NORMAL_ORDER_PATH = 'frmNormalRateOrder.aspx';
const GENERIC_ORDER_PATH = 'frmGenericOrder.aspx';
const WEBMETHOD_PATH = 'Webmethod.aspx';

/** Material option text: "<Name> || <SAP code> || Avail. Stock [ <qty> ] || <flag>". */
function parseGenericMaterialOption(opt) {
  const parts = opt.text.split('||').map((p) => p.trim());
  const stockMatch = (parts[2] || '').match(/\[\s*([\d.,]+)\s*\]/);
  return {
    code: opt.value,
    name: parts[0] || '',
    sapCode: parts[1] || '',
    availableQty: stockMatch ? Number(stockMatch[1].replace(/,/g, '')) : 0,
    matFlag: parts[3] || '',
    optionText: opt.text,
  };
}

/** Batch option text: "<Batch>|Exp:<Mon-YYYY>|STK BAL:<qty>|MRP:<rate>|PTS:<rate>|". */
function parseGenericBatchOption(opt) {
  const parts = opt.text.split('|').map((p) => p.trim());
  const find = (prefix) => {
    const part = parts.find((p) => p.toUpperCase().startsWith(prefix));
    return part ? part.slice(prefix.length).trim() : '';
  };
  return {
    batch: opt.value,
    expiry: find('EXP:'),
    stockQty: Number(find('STK BAL:').replace(/,/g, '')) || 0,
    mrp: Number(find('MRP:')) || 0,
    pts: Number(find('PTS:')) || 0,
  };
}

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

  /**
   * Call one of PharmaNET's ASP.NET PageMethods (Webmethod.aspx/<method>).
   * The page wraps the real payload in `{ d: "<json-or-plain-string>" }` —
   * callers decide whether `.d` itself needs a second JSON.parse, since some
   * methods (e.g. getpharmadate) return a plain string instead of a Table.
   */
  async callWebMethod(method, payload) {
    const resp = await this.request(`${BASE_URL}${WEBMETHOD_PATH}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const { d } = await resp.json();
    if (d === 'Expire') {
      throw new PharmaNetError(STATUS.FAILED_LOGIN_ERROR, 'PharmaNET session expired.');
    }
    return d;
  }

  /**
   * Visit the Normal Order page once per session before calling its
   * Webmethods — live testing showed the server expects this navigation
   * (it primes session state the page methods rely on).
   */
  async openNormalOrderPage() {
    await this.request(`${BASE_URL}${NORMAL_ORDER_PATH}`, { method: 'GET' });
  }

  async getCustomersForNormalOrder(plant = DEFAULT_PLANT) {
    const d = await this.callWebMethod('getcustomerfornormalorder', { plantid: plant });
    if (d == null || d === '1') return [];
    return JSON.parse(d).Table;
  }

  async getPharmaDate(plant = DEFAULT_PLANT) {
    return this.callWebMethod('getpharmadate', { plantid: plant });
  }

  async getMaterialsForCustomer(custNo, plant = DEFAULT_PLANT) {
    const d = await this.callWebMethod('getmaterial', { ncustsupno: custNo, nplantno: plant });
    if (d == null || d === '0') return [];
    return JSON.parse(d).Table;
  }

  async getMaterialRate(materialNo, qty, plant = DEFAULT_PLANT) {
    const d = await this.callWebMethod('GetMaterialRate', { nPlantNo: plant, nMaterialNo: materialNo, iQty: qty });
    const table = JSON.parse(d).Table;
    return table[0] ? Number(table[0].mMaterialRate) : null;
  }

  async getOrderModes() {
    const d = await this.callWebMethod('fillordermode', {});
    if (d == null || d === '0') return [];
    return JSON.parse(d).Table;
  }

  async getBillShipAddresses(custNo) {
    const d = await this.callWebMethod('FillBillToShipTo', { PlantCustSuppNo: custNo });
    if (d == null || d === '0') return { billTo: [], shipTo: [] };
    const table = JSON.parse(d).Table;
    return {
      billTo: table.filter((a) => a.cAddressType === 'B'),
      shipTo: table.filter((a) => a.cAddressType !== 'B'),
    };
  }

  async getCashDiscount(custNo, plant = DEFAULT_PLANT) {
    const d = await this.callWebMethod('GetCashDiscount', { plantid: plant, custid: custNo });
    const table = JSON.parse(d).Table;
    return table[0] ? table[0].fCashDiscount : '0.00';
  }

  /** Resolves a quantity against the customer/material's qty-multiple rule (e.g. round to nearest 100). */
  async getQtyMultiFactor({ plant = DEFAULT_PLANT, custNo, divisionNo, materialNo, orderDate, qty }) {
    const d = await this.callWebMethod('getRateOrderQtymultifactor', {
      nPlantNo: plant,
      nCustSupNo: custNo,
      nDivisionNo: divisionNo,
      nMaterialNo: materialNo,
      dOrderDate: orderDate,
      nQty: qty,
    });
    if (d == null || d === '0') return null;
    return JSON.parse(d).Table[0];
  }

  async getEmployeeForDesignation({ plant = DEFAULT_PLANT, custNo, designationNo }) {
    const d = await this.callWebMethod('GetEmployeeByCustomerAndDesignation', {
      nPlantNo: plant,
      PlantCustSuppNo: custNo,
      DesignationNo: designationNo,
    });
    if (d == null || d === '0') return null;
    return JSON.parse(d).Table[0];
  }

  /**
   * Create a real Normal Order ("Sales Order") on PharmaNET. `order.lines`
   * carry product + qty only — there is no rate field here by design; rate
   * must already be the value PharmaNET's own GetMaterialRate returned.
   */
  async createSalesOrder(order) {
    const strarray = buildNormalOrderPayload(order);
    const d = await this.callWebMethod('OrderInsertDataForNormalRateOrder', { strarray });
    return d;
  }

  /**
   * Generic Order ("Combo"/division-specific materials, frmGenericOrder.aspx)
   * has no JSON webmethods for its dropdowns or its save — everything is a
   * plain classic-ASP.NET full postback. `__EVENTTARGET` set to the changed
   * control's full name triggers a complete re-render that includes the
   * newly-populated dropdown(s), exactly like a browser onchange postback
   * would. Each step's hiddenFields (ViewState etc.) must be carried into
   * the next step's POST body or the server rejects it.
   */
  async openGenericOrderPage() {
    const resp = await this.request(`${BASE_URL}${GENERIC_ORDER_PATH}`, { method: 'GET' });
    const html = await resp.text();
    return extractAllHiddenFields(html);
  }

  async selectGenericCustomer({ hiddenFields, plant = DEFAULT_PLANT, custNo }) {
    const body = new URLSearchParams({
      ...hiddenFields,
      __EVENTTARGET: 'ctl00$ConPhameNet$ddlCustomer',
      __EVENTARGUMENT: '',
      'ctl00$ConPhameNet$ddlPlant': plant,
      'ctl00$ConPhameNet$ddlCustomer': custNo,
    });
    const resp = await this.request(`${BASE_URL}${GENERIC_ORDER_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const html = await resp.text();
    return {
      hiddenFields: extractAllHiddenFields(html),
      materials: extractSelectOptions(html, 'ctl00$ConPhameNet$DDlMaterial')
        .filter((o) => o.value !== '0')
        .map(parseGenericMaterialOption),
      billTo: extractSelectOptions(html, 'ctl00$ConPhameNet$ddlBillToAddress').filter((o) => o.value !== '0'),
      shipTo: extractSelectOptions(html, 'ctl00$ConPhameNet$ddlShipToAddress').filter((o) => o.value !== '0'),
      institutions: extractSelectOptions(html, 'ctl00$ConPhameNet$ddlInstitution').filter((o) => o.value !== '0'),
    };
  }

  /** Selecting a material returns its batch list plus its division/doc-type/tax-class/pack-size (all per-material, not fixed constants). */
  async selectGenericMaterial({ hiddenFields, plant = DEFAULT_PLANT, custNo, materialNo }) {
    const body = new URLSearchParams({
      ...hiddenFields,
      __EVENTTARGET: 'ctl00$ConPhameNet$DDlMaterial',
      __EVENTARGUMENT: '',
      'ctl00$ConPhameNet$ddlPlant': plant,
      'ctl00$ConPhameNet$ddlCustomer': custNo,
      'ctl00$ConPhameNet$DDlMaterial': materialNo,
    });
    const resp = await this.request(`${BASE_URL}${GENERIC_ORDER_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const html = await resp.text();
    const hidden = extractAllHiddenFields(html);
    return {
      hiddenFields: hidden,
      batches: extractSelectOptions(html, 'ctl00$ConPhameNet$ddlBatch')
        .filter((o) => o.value !== '0')
        .map(parseGenericBatchOption),
      divisionNo: hidden['ctl00$ConPhameNet$HDivisionNo'],
      docType: hidden['ctl00$ConPhameNet$HidDocType'],
      taxClass: hidden['ctl00$ConPhameNet$HDTaxClass'],
      packSize: Number(hidden['ctl00$ConPhameNet$hdnpcksz']) || 1,
      materialName: hidden['ctl00$ConPhameNet$HMaterialName'],
    };
  }

  /**
   * Saves a real Generic Order. `order.lines` are already-built cart rows
   * (one per material+batch — the same material split across several
   * batches for FEFO is several rows sharing one rate, exactly like the
   * page's own "Add" button recomputes one blended rate per material
   * across all its batch rows). `hiddenFields` must be the latest state
   * returned by selectGenericMaterial/selectGenericCustomer for this order.
   */
  async createGenericOrder(order) {
    const {
      hiddenFields,
      plant = DEFAULT_PLANT,
      custNo,
      billToAddr,
      shipToAddr,
      institution = '0',
      designation,
      orderMode,
      customerOrderNo = '',
      empNo = '0',
      empOther = '',
      remark = '',
      lines,
    } = order;

    const body = new URLSearchParams({
      ...hiddenFields,
      'ctl00$ConPhameNet$ddlPlant': plant,
      'ctl00$ConPhameNet$ddlCustomer': custNo,
      'ctl00$ConPhameNet$ddlBillToAddress': billToAddr,
      'ctl00$ConPhameNet$ddlShipToAddress': shipToAddr,
      'ctl00$ConPhameNet$ddlInstitution': institution,
      'ctl00$ConPhameNet$drpDesignation': designation,
      'ctl00$ConPhameNet$DDCOrderMode$DropDownList1': orderMode,
      'ctl00$ConPhameNet$txtCustOrderNo': customerOrderNo,
      'ctl00$ConPhameNet$txtOther': empOther,
      'ctl00$ConPhameNet$hdnEmpNo': empNo,
      'ctl00$ConPhameNet$HdrRemarks$txthdrRemarks': remark,
      'ctl00$ConPhameNet$hidval': buildGenericOrderPayload(lines),
      'ctl00$ConPhameNet$btnSave': 'Save',
    });
    const resp = await this.request(`${BASE_URL}${GENERIC_ORDER_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const html = await resp.text();
    return extractLabelText(html, 'ctl00_lblError') || 'Generic Order saved.';
  }
}
