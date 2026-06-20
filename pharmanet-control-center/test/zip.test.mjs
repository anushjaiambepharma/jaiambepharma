import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildOutputZip } from '../src/zip.js';

test('builds the PharmaNET_Output folder structure with logs and PDFs', () => {
  const pdfBytes = new TextEncoder().encode('%PDF-1.4 fake').buffer;
  const zipBytes = buildOutputZip({
    pdfFiles: [{ path: 'Invoices/Invoice_AMBIKA_MEDICINES_C72012600387.pdf', bytes: pdfBytes }],
    processLogCsv: 'RowNumber,Status\r\n1,SUCCESS',
    failedRowsCsv: 'RowNumber,Status',
    summaryJson: { totalRows: 1, success: 1, failed: 0, skipped: 0 },
    sourceExcelBytes: new TextEncoder().encode('fake-xlsx').buffer,
    sourceExcelName: 'input.xlsx',
  });

  const entries = unzipSync(zipBytes);
  const names = Object.keys(entries);
  assert.ok(names.includes('PharmaNET_Output/Invoices/Invoice_AMBIKA_MEDICINES_C72012600387.pdf'));
  assert.ok(names.includes('PharmaNET_Output/Logs/Process_Log.csv'));
  assert.ok(names.includes('PharmaNET_Output/Logs/Failed_Rows.csv'));
  assert.ok(names.includes('PharmaNET_Output/Logs/Summary.json'));
  assert.ok(names.includes('PharmaNET_Output/Source/input.xlsx'));

  const summary = JSON.parse(strFromU8(entries['PharmaNET_Output/Logs/Summary.json']));
  assert.equal(summary.success, 1);
});
