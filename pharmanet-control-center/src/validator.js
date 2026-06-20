import { ALL_DOC_TYPES, DIVISION_CODE, TRANSACTION_DOC_TYPES, INVOICE_DOC_TYPE } from './constants.js';

export const REQUIRED_COLUMNS = [
  'TaskType',
  'DocumentType',
  'PartyName',
  'CustomerCode',
  'DocumentNumber',
  'FromDate',
  'ToDate',
  'Division',
  'InvoiceType',
  'DownloadRequired',
  'Remarks',
];

const DATE_RE = /^\d{2}-[A-Za-z]{3}-\d{4}$/;
const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseDdMmmYyyy(value) {
  const m = String(value).trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const month = MONTH_INDEX[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(m[3]), month, Number(m[1]));
}

function normalize(value) {
  return String(value ?? '').trim();
}

function duplicateKey(row) {
  return [row.DocumentType, row.PartyName, row.DocumentNumber, row.FromDate, row.ToDate, row.Division]
    .map((v) => normalize(v).toUpperCase())
    .join('|');
}

/**
 * Validate the headers + rows of the Download_Documents sheet.
 * `rows` is an array of plain objects keyed by column name, 1 per Excel row.
 */
export function validateDownloadDocuments(headers, rows) {
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingColumns.length > 0) {
    return {
      structureValid: false,
      missingColumns,
      rows: [],
      summary: emptySummary(),
    };
  }

  const seen = new Set();
  const validatedRows = rows.map((row, idx) => {
    const rowNumber = idx + 2; // account for header row in the spreadsheet
    const errors = [];
    const taskType = normalize(row.TaskType).toUpperCase();
    const docType = normalize(row.DocumentType).toUpperCase();
    const partyName = normalize(row.PartyName);
    const fromDate = normalize(row.FromDate);
    const toDate = normalize(row.ToDate);
    const division = normalize(row.Division).toUpperCase() || 'ALL';
    const downloadRequired = normalize(row.DownloadRequired).toUpperCase() || 'YES';

    if (taskType !== 'DOWNLOAD') {
      errors.push(`TaskType "${row.TaskType}" is not supported (expected DOWNLOAD).`);
    }
    if (!ALL_DOC_TYPES.includes(docType)) {
      errors.push(`DocumentType "${row.DocumentType}" is not one of: ${ALL_DOC_TYPES.join(', ')}.`);
    }
    if (!partyName) {
      errors.push('PartyName is required.');
    }
    if (!fromDate || !DATE_RE.test(fromDate)) {
      errors.push('FromDate must be in DD-MMM-YYYY format (e.g. 01-Jun-2026).');
    }
    if (!toDate || !DATE_RE.test(toDate)) {
      errors.push('ToDate must be in DD-MMM-YYYY format (e.g. 20-Jun-2026).');
    }
    if (fromDate && toDate && DATE_RE.test(fromDate) && DATE_RE.test(toDate)) {
      const from = parseDdMmmYyyy(fromDate);
      const to = parseDdMmmYyyy(toDate);
      if (from && to && to < from) {
        errors.push('ToDate is before FromDate.');
      }
    }
    if (division && !DIVISION_CODE[division]) {
      errors.push(`Division "${row.Division}" is not recognised.`);
    }
    if (!['YES', 'NO'].includes(downloadRequired)) {
      errors.push('DownloadRequired must be YES or NO.');
    }
    if (!normalize(row.DocumentNumber) && !partyName) {
      errors.push('Either DocumentNumber or PartyName must be provided to match the document.');
    }

    const key = duplicateKey(row);
    const isDuplicate = errors.length === 0 && seen.has(key);
    if (errors.length === 0) seen.add(key);

    let status;
    if (errors.length > 0) status = 'INVALID';
    else if (isDuplicate) status = 'DUPLICATE';
    else if (downloadRequired === 'NO') status = 'SKIPPED_NOT_REQUIRED';
    else status = 'READY';

    return {
      rowNumber,
      TaskType: taskType,
      DocumentType: docType,
      PartyName: partyName,
      CustomerCode: normalize(row.CustomerCode),
      DocumentNumber: normalize(row.DocumentNumber),
      FromDate: fromDate,
      ToDate: toDate,
      Division: division,
      InvoiceType: normalize(row.InvoiceType).toUpperCase() || 'ALL',
      DownloadRequired: downloadRequired,
      Remarks: normalize(row.Remarks),
      errors,
      status,
    };
  });

  const summary = {
    totalRows: validatedRows.length,
    readyRows: validatedRows.filter((r) => r.status === 'READY').length,
    invalidRows: validatedRows.filter((r) => r.status === 'INVALID').length,
    duplicateRows: validatedRows.filter((r) => r.status === 'DUPLICATE').length,
    skippedRows: validatedRows.filter((r) => r.status === 'SKIPPED_NOT_REQUIRED').length,
    invoicesToDownload: validatedRows.filter((r) => r.status === 'READY' && r.DocumentType === INVOICE_DOC_TYPE).length,
    creditNotesToDownload: validatedRows.filter(
      (r) => r.status === 'READY' && ['CREDIT_NOTE', 'CREDIT_NOTE_TAX', 'RATE_CREDIT'].includes(r.DocumentType)
    ).length,
    debitNotesToDownload: validatedRows.filter(
      (r) => r.status === 'READY' && ['DEBIT_NOTE', 'DEBIT_NOTE_TAX', 'RATE_DEBIT'].includes(r.DocumentType)
    ).length,
  };

  return { structureValid: true, missingColumns: [], rows: validatedRows, summary };
}

function emptySummary() {
  return {
    totalRows: 0,
    readyRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    skippedRows: 0,
    invoicesToDownload: 0,
    creditNotesToDownload: 0,
    debitNotesToDownload: 0,
  };
}

export function isTransactionDocType(docType) {
  return TRANSACTION_DOC_TYPES.has(docType);
}
