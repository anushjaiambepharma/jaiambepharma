(() => {
  const STEPS = ['PIN', 'Login', 'File', 'Review', 'Confirm', 'Result'];
  const PANEL_IDS = ['panel-pin', 'panel-login', 'panel-file', 'panel-review', 'panel-confirm', 'panel-result'];
  const DEFAULT_PLANT = '1172';
  const DESIGNATION_OTHER = '999';

  const state = {
    appPin: '',
    pinRequired: false,
    pnUserId: '',
    pnPassword: '',
    custNo: '',
    fileMode: 'text',
    prepareResult: null,
    reviewLines: [],
    orderDetails: null,
    currentStep: 0,
  };

  const el = (id) => document.getElementById(id);

  function setStep(index) {
    state.currentStep = index;
    renderStepsNav();
    PANEL_IDS.forEach((id, i) => el(id).classList.toggle('hidden', i !== index));
  }

  function renderStepsNav() {
    const nav = el('stepsNav');
    nav.innerHTML = '';
    STEPS.forEach((label, i) => {
      const pill = document.createElement('span');
      pill.className = 'step-pill' + (i === state.currentStep ? ' active' : i < state.currentStep ? ' done' : '');
      pill.textContent = `${i + 1}. ${label}`;
      nav.appendChild(pill);
    });
  }

  async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.appPin) headers['X-App-Pin'] = state.appPin;
    const resp = await fetch(path, { ...options, headers });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
    return data;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- Step 1: PIN ----
  async function init() {
    try {
      const config = await fetch('/api/config').then((r) => r.json());
      state.pinRequired = Boolean(config.pinRequired);
    } catch {
      state.pinRequired = true;
    }
    setStep(state.pinRequired ? 0 : 1);
  }

  el('btnCheckPin').addEventListener('click', async () => {
    const pin = el('appPin').value.trim();
    el('pinError').classList.add('hidden');
    try {
      const resp = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Pin': pin },
        body: '{}',
      });
      if (!resp.ok) throw new Error('Invalid App PIN.');
      state.appPin = pin;
      setStep(1);
    } catch (err) {
      el('pinError').textContent = err.message || 'Invalid PIN.';
      el('pinError').classList.remove('hidden');
    }
  });

  // ---- Step 2: Login + customer ----
  el('btnLoginContinue').addEventListener('click', () => {
    const userId = el('pnUserId').value.trim();
    const password = el('pnPassword').value;
    const custNo = el('custNo').value.trim();
    el('loginError').classList.add('hidden');
    if (!userId || !password || !custNo) {
      el('loginError').textContent = 'Enter your PharmaNET User ID, Password and Customer No.';
      el('loginError').classList.remove('hidden');
      return;
    }
    state.pnUserId = userId;
    state.pnPassword = password;
    state.custNo = custNo;
    setStep(2);
  });

  // ---- Step 3: Order file ----
  document.querySelectorAll('#fileModeTabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#fileModeTabs .tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.fileMode = tab.dataset.mode;
      ['text', 'sheet', 'pdf'].forEach((m) => el(`fileMode-${m}`).classList.toggle('hidden', m !== state.fileMode));
    });
  });

  async function extractSheetRows(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  }

  async function extractPdfText(file) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageTexts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((it) => it.str).join(' '));
    }
    return pageTexts.join('\n');
  }

  el('btnParseMatch').addEventListener('click', async () => {
    const errorEl = el('fileError');
    const progressEl = el('parseProgress');
    errorEl.classList.add('hidden');
    progressEl.classList.remove('hidden');
    progressEl.textContent = 'Extracting order lines...';
    try {
      let parsePayload;
      if (state.fileMode === 'text') {
        const text = el('pasteText').value;
        if (!text.trim()) throw new Error('Paste at least one order line.');
        parsePayload = { mode: 'text', text };
      } else if (state.fileMode === 'sheet') {
        const file = el('sheetFile').files[0];
        if (!file) throw new Error('Choose an Excel file.');
        parsePayload = { mode: 'sheet', rows: await extractSheetRows(file) };
      } else {
        const file = el('pdfFile').files[0];
        if (!file) throw new Error('Choose a PDF file.');
        parsePayload = { mode: 'text', text: await extractPdfText(file) };
      }

      const { lines } = await apiFetch('/api/order/parse-file', { method: 'POST', body: JSON.stringify(parsePayload) });
      if (!lines || lines.length === 0) throw new Error('No order lines could be extracted from that input.');

      progressEl.textContent = 'Logging in to PharmaNET and matching products...';
      const prepareResult = await apiFetch('/api/order/prepare', {
        method: 'POST',
        body: JSON.stringify({
          userId: state.pnUserId,
          password: state.pnPassword,
          plant: DEFAULT_PLANT,
          custNo: state.custNo,
          lines,
        }),
      });

      state.prepareResult = prepareResult;
      state.reviewLines = prepareResult.lines.map((m) => ({
        ...m,
        qty: m.line.qty != null ? m.line.qty : 1,
        resolvedProduct: m.status === 'AUTO_CONFIRMED' ? m.product : null,
        searchOpen: false,
      }));

      populateOrderDetailSelects(prepareResult);
      renderReview();
      setStep(3);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      progressEl.classList.add('hidden');
    }
  });

  // ---- Step 4: Review & match ----
  function populateOrderDetailSelects(prepareResult) {
    el('orderMode').innerHTML = prepareResult.orderModes.map((m) => `<option value="${m.value}">${escapeHtml(m.label)}</option>`).join('');
    el('billToAddr').innerHTML = prepareResult.addresses.billTo.map((a) => `<option value="${a.value}">${escapeHtml(a.label)}</option>`).join('');
    el('shipToAddr').innerHTML = prepareResult.addresses.shipTo.map((a) => `<option value="${a.value}">${escapeHtml(a.label)}</option>`).join('');
    el('designation').innerHTML = prepareResult.designations.map((d) => `<option value="${d.value}">${escapeHtml(d.label)}</option>`).join('');
  }

  el('designation').addEventListener('change', () => {
    el('empOtherWrap').classList.toggle('hidden', el('designation').value !== DESIGNATION_OTHER);
  });

  function renderReview() {
    const confirmed = state.reviewLines.filter((l) => l.resolvedProduct).length;
    el('reviewSummaryGrid').innerHTML = [
      { label: 'Total Lines', value: state.reviewLines.length },
      { label: 'Matched', value: confirmed, cls: 'ok' },
      { label: 'Needs Review', value: state.reviewLines.length - confirmed, cls: state.reviewLines.length - confirmed ? 'warn' : '' },
    ].map((c) => `<div class="summary-card ${c.cls || ''}"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`).join('');

    el('reviewTableBody').innerHTML = state.reviewLines.map((line, i) => renderReviewRow(line, i)).join('');

    state.reviewLines.forEach((line, i) => {
      el(`qty-${i}`).addEventListener('input', (e) => {
        state.reviewLines[i].qty = Number(e.target.value) || 0;
      });
      (line.candidates || []).forEach((cand, ci) => {
        const btn = el(`cand-${i}-${ci}`);
        if (btn) btn.addEventListener('click', () => selectProduct(i, cand));
      });
      const searchInput = el(`search-${i}`);
      if (searchInput) {
        searchInput.addEventListener('input', () => renderSearchResults(i, searchInput.value));
      }
      const changeBtn = el(`change-${i}`);
      if (changeBtn) {
        changeBtn.addEventListener('click', () => {
          state.reviewLines[i].resolvedProduct = null;
          renderReview();
        });
      }
    });
  }

  function selectProduct(i, product) {
    state.reviewLines[i].resolvedProduct = product;
    state.reviewLines[i].matchedBy = state.reviewLines[i].matchedBy || 'MANUAL';
    renderReview();
  }

  function renderSearchResults(i, query) {
    const container = el(`searchResults-${i}`);
    if (!container) return;
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      container.innerHTML = '';
      return;
    }
    const results = (state.prepareResult.productMaster || [])
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
    container.innerHTML = results
      .map((p, ri) => `<button type="button" class="candidate-btn" id="searchResult-${i}-${ri}">${escapeHtml(p.name)} <span class="product-code">(${escapeHtml(p.code)})</span></button>`)
      .join('');
    results.forEach((p, ri) => {
      el(`searchResult-${i}-${ri}`).addEventListener('click', () => selectProduct(i, p));
    });
  }

  function renderReviewRow(line, i) {
    const matchCell = line.resolvedProduct
      ? `<div class="match-cell">
          <span class="match-badge confirmed">${escapeHtml(line.matchedBy || 'MATCHED')}</span>
          <div class="product-name">${escapeHtml(line.resolvedProduct.materialNameFull || line.resolvedProduct.name)}</div>
          <div class="product-code">${escapeHtml(line.resolvedProduct.code)}</div>
          <button type="button" class="candidate-btn" id="change-${i}">Change</button>
        </div>`
      : `<div class="match-cell">
          <span class="match-badge review">NEEDS REVIEW</span>
          <div class="candidate-list">
            ${(line.candidates || []).map((c, ci) => `<button type="button" class="candidate-btn" id="cand-${i}-${ci}">${escapeHtml(c.name)} <span class="product-code">(${escapeHtml(c.code)}, ${Math.round(c.score * 100)}%)</span></button>`).join('')}
          </div>
          <input type="text" class="product-search" id="search-${i}" placeholder="Search full product master..." />
          <div id="searchResults-${i}" class="candidate-list"></div>
        </div>`;

    return `<tr>
      <td>${escapeHtml(line.line.rawText)}</td>
      <td><input type="number" id="qty-${i}" value="${line.qty}" min="1" /></td>
      <td colspan="2">${matchCell}</td>
    </tr>`;
  }

  el('btnReviewContinue').addEventListener('click', () => {
    const errorEl = el('reviewError');
    errorEl.classList.add('hidden');

    const unresolved = state.reviewLines.filter((l) => !l.resolvedProduct);
    if (unresolved.length > 0) {
      errorEl.textContent = `${unresolved.length} line(s) still need a confirmed product before continuing.`;
      errorEl.classList.remove('hidden');
      return;
    }
    const badQty = state.reviewLines.filter((l) => !l.qty || l.qty <= 0);
    if (badQty.length > 0) {
      errorEl.textContent = 'Every line needs a quantity greater than 0.';
      errorEl.classList.remove('hidden');
      return;
    }

    const orderMode = el('orderMode').value;
    const billToAddr = el('billToAddr').value;
    const shipToAddr = el('shipToAddr').value;
    const designation = el('designation').value;
    const empOther = el('empOther').value.trim();
    if (designation === DESIGNATION_OTHER && !empOther) {
      errorEl.textContent = 'Enter a note in the "Other" field for the Others designation.';
      errorEl.classList.remove('hidden');
      return;
    }

    state.orderDetails = {
      orderMode,
      billToAddr,
      shipToAddr,
      designation,
      empOther,
      customerOrderNo: el('customerOrderNo').value.trim(),
      remark: el('remark').value.trim(),
    };

    renderConfirm();
    setStep(4);
  });

  // ---- Step 5: Confirm & submit ----
  function renderConfirm() {
    el('confirmTableBody').innerHTML = state.reviewLines
      .map(
        (l) => `<tr>
          <td>${escapeHtml(l.resolvedProduct.materialNameFull || l.resolvedProduct.name)}</td>
          <td>${escapeHtml(l.resolvedProduct.code)}</td>
          <td>${l.qty}</td>
        </tr>`
      )
      .join('');
  }

  el('btnBackToReview').addEventListener('click', () => setStep(3));

  el('btnSubmitOrder').addEventListener('click', async () => {
    if (!window.confirm('This will save a real Sales Order in PharmaNET. Continue?')) return;

    const btn = el('btnSubmitOrder');
    const progressEl = el('submitProgress');
    const errorEl = el('submitError');
    errorEl.classList.add('hidden');
    btn.disabled = true;
    progressEl.classList.remove('hidden');
    progressEl.textContent = 'Submitting order to PharmaNET...';

    try {
      const result = await apiFetch('/api/order/submit', {
        method: 'POST',
        body: JSON.stringify({
          userId: state.pnUserId,
          password: state.pnPassword,
          plant: DEFAULT_PLANT,
          custNo: state.custNo,
          customerName: state.prepareResult.customer.name,
          orderMode: state.orderDetails.orderMode,
          billToAddr: state.orderDetails.billToAddr,
          shipToAddr: state.orderDetails.shipToAddr,
          designation: state.orderDetails.designation,
          empOther: state.orderDetails.empOther,
          remark: state.orderDetails.remark,
          customerOrderNo: state.orderDetails.customerOrderNo,
          lines: state.reviewLines.map((l) => ({
            qty: l.qty,
            product: l.resolvedProduct,
            normalizedKey: l.normalizedKey,
          })),
        }),
      });

      renderResult(result);
      setStep(5);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      progressEl.classList.add('hidden');
    }
  });

  // ---- Step 6: Result ----
  function renderResult(result) {
    el('resultSummaryGrid').innerHTML = `<div class="summary-card ok"><div class="value">OK</div><div class="label">Order Saved</div></div>`;
    el('resultTableBody').innerHTML = result.orderedLines
      .map(
        (l) => `<tr>
          <td>${escapeHtml(l.materialName)}</td>
          <td>${escapeHtml(l.materialNo)}</td>
          <td>${l.qty}</td>
          <td>${l.rate}</td>
          <td>${l.value}</td>
        </tr>`
      )
      .join('');
  }

  el('btnNewOrder').addEventListener('click', () => window.location.reload());

  init();
})();
