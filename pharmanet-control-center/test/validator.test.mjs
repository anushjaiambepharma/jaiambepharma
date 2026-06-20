import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDownloadDocuments, REQUIRED_COLUMNS } from '../src/validator.js';

function baseRow(overrides = {}) {
  return {
    TaskType: 'DOWNLOAD',
    DocumentType: 'INVOICE',
    PartyName: 'AMBIKA MEDICINES',
    CustomerCode: '',
    DocumentNumber: 'C72012600387',
    FromDate: '01-Jun-2026',
    ToDate: '20-Jun-2026',
    Division: 'ALL',
    InvoiceType: 'ALL',
    DownloadRequired: 'YES',
    Remarks: '',
    ...overrides,
  };
}

test('flags missing required columns', () => {
  const result = validateDownloadDocuments(['TaskType'], []);
  assert.equal(result.structureValid, false);
  assert.deepEqual(result.missingColumns, REQUIRED_COLUMNS.filter((c) => c !== 'TaskType'));
});

test('marks a fully valid row as READY', () => {
  const result = validateDownloadDocuments(REQUIRED_COLUMNS, [baseRow()]);
  assert.equal(result.rows[0].status, 'READY');
  assert.equal(result.summary.readyRows, 1);
  assert.equal(result.summary.invoicesToDownload, 1);
});

test('rejects unknown DocumentType', () => {
  const result = validateDownloadDocuments(REQUIRED_COLUMNS, [baseRow({ DocumentType: 'BOGUS' })]);
  assert.equal(result.rows[0].status, 'INVALID');
  assert.match(result.rows[0].errors.join(), /DocumentType/);
});

test('rejects bad date format', () => {
  const result = validateDownloadDocuments(REQUIRED_COLUMNS, [baseRow({ FromDate: '2026-06-01' })]);
  assert.equal(result.rows[0].status, 'INVALID');
});

test('rejects ToDate before FromDate', () => {
  const result = validateDownloadDocuments(REQUIRED_COLUMNS, [baseRow({ FromDate: '20-Jun-2026', ToDate: '01-Jun-2026' })]);
  assert.equal(result.rows[0].status, 'INVALID');
});

test('detects duplicate rows', () => {
  const result = validateDownloadDocuments(REQUIRED_COLUMNS, [baseRow(), baseRow()]);
  assert.equal(result.rows[0].status, 'READY');
  assert.equal(result.rows[1].status, 'DUPLICATE');
  assert.equal(result.summary.duplicateRows, 1);
});

test('rows with DownloadRequired=NO are skipped, not counted as ready', () => {
  const result = validateDownloadDocuments(REQUIRED_COLUMNS, [baseRow({ DownloadRequired: 'NO' })]);
  assert.equal(result.rows[0].status, 'SKIPPED_NOT_REQUIRED');
  assert.equal(result.summary.readyRows, 0);
});

test('counts credit and debit notes separately from invoices', () => {
  const rows = [
    baseRow({ DocumentType: 'CREDIT_NOTE', DocumentNumber: 'CN1' }),
    baseRow({ DocumentType: 'DEBIT_NOTE', DocumentNumber: 'DN1' }),
    baseRow({ DocumentType: 'INVOICE', DocumentNumber: 'INV1' }),
  ];
  const result = validateDownloadDocuments(REQUIRED_COLUMNS, rows);
  assert.equal(result.summary.creditNotesToDownload, 1);
  assert.equal(result.summary.debitNotesToDownload, 1);
  assert.equal(result.summary.invoicesToDownload, 1);
});

test('requires at least PartyName or DocumentNumber', () => {
  const result = validateDownloadDocuments(REQUIRED_COLUMNS, [baseRow({ PartyName: '', DocumentNumber: '' })]);
  assert.equal(result.rows[0].status, 'INVALID');
});
