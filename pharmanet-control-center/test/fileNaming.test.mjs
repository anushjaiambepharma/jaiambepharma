import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFileName, sanitizeForFilename, folderFor } from '../src/fileNaming.js';

test('builds the documented filename pattern', () => {
  const used = new Set();
  const name = buildFileName('INVOICE', 'AMBIKA MEDICINES', 'C72012600387', used);
  assert.equal(name, 'Invoice_AMBIKA_MEDICINES_C72012600387.pdf');
});

test('credit/debit note labels match spec examples', () => {
  const used = new Set();
  assert.equal(buildFileName('CREDIT_NOTE', 'R K PHARMA', '1172C26DF00083', used), 'CreditNote_R_K_PHARMA_1172C26DF00083.pdf');
  assert.equal(buildFileName('DEBIT_NOTE', 'BALAJI PHARMA', '1172D26DF00044', used), 'DebitNote_BALAJI_PHARMA_1172D26DF00044.pdf');
});

test('adds numeric suffix on filename collision', () => {
  const used = new Set();
  const first = buildFileName('INVOICE', 'AMBIKA MEDICINES', 'C72012600387', used);
  const second = buildFileName('INVOICE', 'AMBIKA MEDICINES', 'C72012600387', used);
  assert.equal(first, 'Invoice_AMBIKA_MEDICINES_C72012600387.pdf');
  assert.equal(second, 'Invoice_AMBIKA_MEDICINES_C72012600387_2.pdf');
});

test('sanitizes unsafe filename characters and spaces', () => {
  assert.equal(sanitizeForFilename('R/K: PHARMA*?'), 'R_K_PHARMA');
});

test('maps document types to output folders', () => {
  assert.equal(folderFor('INVOICE'), 'Invoices');
  assert.equal(folderFor('CREDIT_NOTE_TAX'), 'CreditNotes');
  assert.equal(folderFor('RATE_DEBIT'), 'DebitNotes');
});
