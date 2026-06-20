(() => {
  const STEPS = ['PIN', 'Login', 'Upload', 'Validate', 'Results'];
  const PROCESS_LOG_COLUMNS = [
    'RowNumber', 'TaskType', 'DocumentType', 'PartyName', 'CustomerCode', 'DocumentNumber',
    'FromDate', 'ToDate', 'Division', 'Status', 'PDFFileName', 'ErrorMessage', 'ProcessedAt',
  ];

  const state = {
    appPin: '',
    pinRequired: false,
    pnUserId: '',
    pnPassword: '',
    file: null,
    validatedRows: null,
    summary: null,
    currentStep: 0,
  };

  const el = (id) => document.getElementById(id);

  function setStep(index) {
    state.currentStep = index;
    renderStepsNav();
    ['panel-pin', 'panel-login', 'panel-upload', 'panel-summary', 'panel-results'].forEach((id, i) => {
      el(id).classList.toggle('hidden', i !== index);
    });
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

  function formatCellValue(v) {
    if (v instanceof Date) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dd = String(v.getDate()).padStart(2, '0');
      return `${dd}-${months[v.getMonth()]}-${v.getFullYear()}`;
    }
    return v === undefined || v === null ? '' : String(v).trim();
  }

  function escapeCsvField(value) {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function toCsv(columns, rows) {
    const lines = [columns.join(',')];
    for (const row of rows) lines.push(columns.map((c) => escapeCsvField(row[c])).join(','));
    return lines.join('\r\n');
  }

  function downloadBlob(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function base64ToBlob(base64, mime) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // ---- Step 1: PIN ----
  async function init() {
    try {
      const config = await fetch('/api/config').then((r) => r.json());
      state.pinRequired = Boolean(config.pinRequired);
    } catch {
      state.pinRequired = true; // fail closed
    }
    if (!state.pinRequired) {
      setStep(1);
    } else {
      setStep(0);
    }
  }

  el('btnCheckPin').addEventListener('click', async () => {
    const pin = el('appPin').value.trim();
    el('pinError').classList.add('hidden');
    try {
      await apiFetchWithPin(pin);
      state.appPin = pin;
      setStep(1);
    } catch (err) {
      el('pinError').textContent = err.message || 'Invalid PIN.';
      el('pinError').classList.remove('hidden');
    }
  });

  async function apiFetchWithPin(pin) {
    const resp = await fetch('/api/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Pin': pin },
      body: '{}',
    });
    if (!resp.ok) throw new Error('Invalid App PIN.');
  }

  // ---- Step 2: Login ----
  el('btnLoginContinue').addEventListener('click', () => {
    const userId = el('pnUserId').value.trim();
    const password = el('pnPassword').value;
    if (!userId || !password) {
      alert('Enter your PharmaNET User ID and Password.');
      return;
    }
    state.pnUserId = userId;
    state.pnPassword = password;
    setStep(2);
  });

  // ---- Step 3: Upload ----
  el('excelFile').addEventListener('change', (e) => {
    state.file = e.target.files[0] || null;
    el('btnValidate').disabled = !state.file;
  });

  el('btnValidate').addEventListener('click', async () => {
    el('uploadError').classList.add('hidden');
    if (!state.file) return;
    try {
      const buffer = await state.file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = wb.Sheets['Download_Documents'];
      if (!sheet) throw new Error('Sheet "Download_Documents" was not found in the uploaded workbook.');

      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
      if (aoa.length === 0) throw new Error('The Download_Documents sheet is empty.');
      const headers = aoa[0].map((h) => String(h).trim());
      const dataRows = aoa.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
      const rowObjects = dataRows.map((r) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = formatCellValue(r[i])));
        return obj;
      });

      const result = await apiFetch('/api/validate', { method: 'POST', body: JSON.stringify({ headers, rows: rowObjects }) });
      if (!result.structureValid) {
        throw new Error(`Missing required columns: ${result.missingColumns.join(', ')}`);
      }

      state.validatedRows = result.rows;
      state.summary = result.summary;
      renderSummary(result);
      setStep(3);
    } catch (err) {
      el('uploadError').textContent = err.message;
      el('uploadError').classList.remove('hidden');
    }
  });

  function renderSummary(result) {
    const s = result.summary;
    const cards = [
      { label: 'Total Rows', value: s.totalRows },
      { label: 'Ready Rows', value: s.readyRows, cls: 'ok' },
      { label: 'Invalid Rows', value: s.invalidRows, cls: s.invalidRows ? 'danger' : '' },
      { label: 'Duplicate Rows', value: s.duplicateRows, cls: s.duplicateRows ? 'warn' : '' },
      { label: 'Invoices', value: s.invoicesToDownload },
      { label: 'Credit Notes', value: s.creditNotesToDownload },
      { label: 'Debit Notes', value: s.debitNotesToDownload },
    ];
    el('summaryGrid').innerHTML = cards
      .map((c) => `<div class="summary-card ${c.cls || ''}"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`)
      .join('');

    el('rowsTableBody').innerHTML = result.rows
      .map(
        (r) => `<tr>
          <td>${r.rowNumber}</td>
          <td><span class="status-tag status-${r.status}">${r.status}</span></td>
          <td>${r.TaskType}</td><td>${r.DocumentType}</td><td>${escapeHtml(r.PartyName)}</td>
          <td>${escapeHtml(r.DocumentNumber)}</td><td>${r.FromDate}</td><td>${r.ToDate}</td>
          <td>${escapeHtml(r.errors.join(' '))}</td>
        </tr>`
      )
      .join('');

    el('btnRunAll').disabled = s.readyRows === 0;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- Step 4: Run All ----
  el('btnRunAll').addEventListener('click', async () => {
    const btn = el('btnRunAll');
    const progress = el('runProgress');
    btn.disabled = true;
    progress.classList.remove('hidden');
    progress.textContent = 'Logging in and processing PharmaNET requests. This can take a while for large files — do not close this tab.';

    try {
      const dataUrl = await fileToDataUrl(state.file);
      const sourceExcelBase64 = dataUrl.split(',')[1];

      const result = await runAllStreaming(
        {
          userId: state.pnUserId,
          password: state.pnPassword,
          rows: state.validatedRows,
          sourceExcelBase64,
          sourceExcelName: state.file.name,
        },
        (completed, total, status, party) => {
          progress.textContent = `Processed ${completed} / ${total} — ${status}: ${party}`;
        }
      );

      state.runResult = result;
      renderResults(result);
      setStep(4);
    } catch (err) {
      progress.textContent = 'Run All failed: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  });

  // Run All can take several minutes for a few hundred rows. The server
  // streams one NDJSON line per row as it's processed (instead of one
  // buffered response at the end) so the connection stays visibly alive;
  // read it line-by-line and surface progress as it arrives.
  async function runAllStreaming(body, onProgress) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.appPin) headers['X-App-Pin'] = state.appPin;
    const resp = await fetch('/api/run-all', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${resp.status})`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.type === 'progress') {
          onProgress(msg.completed, msg.total, msg.status, msg.party);
        } else if (msg.type === 'done') {
          return { summary: msg.summary, log: msg.log, failedRows: msg.failedRows, zipBase64: msg.zipBase64 };
        } else if (msg.type === 'error') {
          throw new Error(msg.message);
        }
      }
    }
    throw new Error('Run All connection ended before a result was received.');
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderResults(result) {
    const s = result.summary;
    const cards = [
      { label: 'Total Rows', value: s.totalRows },
      { label: 'Success', value: s.success, cls: 'ok' },
      { label: 'Failed', value: s.failed, cls: s.failed ? 'danger' : '' },
      { label: 'Skipped', value: s.skipped, cls: s.skipped ? 'warn' : '' },
    ];
    el('resultSummaryGrid').innerHTML = cards
      .map((c) => `<div class="summary-card ${c.cls || ''}"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`)
      .join('');

    el('resultsTableBody').innerHTML = result.log
      .map(
        (r) => `<tr>
          <td>${r.RowNumber}</td>
          <td><span class="status-tag status-${r.Status}">${r.Status}</span></td>
          <td>${r.DocumentType}</td><td>${escapeHtml(r.PartyName)}</td><td>${escapeHtml(r.DocumentNumber)}</td>
          <td>${escapeHtml(r.PDFFileName)}</td><td>${escapeHtml(r.ErrorMessage)}</td>
        </tr>`
      )
      .join('');
  }

  el('btnDownloadZip').addEventListener('click', () => {
    if (!state.runResult) return;
    downloadBlob(base64ToBlob(state.runResult.zipBase64, 'application/zip'), 'PharmaNET_Output.zip');
  });

  el('btnDownloadFailed').addEventListener('click', () => {
    if (!state.runResult) return;
    downloadBlob(toCsv(PROCESS_LOG_COLUMNS, state.runResult.failedRows), 'Failed_Rows.csv', 'text/csv');
  });

  el('btnDownloadLog').addEventListener('click', () => {
    if (!state.runResult) return;
    downloadBlob(toCsv(PROCESS_LOG_COLUMNS, state.runResult.log), 'Process_Log.csv', 'text/csv');
  });

  init();
})();
