import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractNumbers, parseTextLines, parseSheetRows } from '../src/orderFileParser.js';

test('extractNumbers pulls every number out of a line, ignoring attached units', () => {
  assert.deepEqual(extractNumbers('ABD-400 1 TAB (ALU-ALU) UPC0000005 2500'), [400, 1, 5, 2500]);
  assert.deepEqual(extractNumbers('no numbers here'), []);
});

test('parseTextLines splits on newlines and defaults qty to the last number on each line', () => {
  const lines = parseTextLines('ABD-400 1 TAB (ALU-ALU) UPC0000005 2500\n\nKUFFDRYL 100ML UPC0000266 120\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].rawText, 'ABD-400 1 TAB (ALU-ALU) UPC0000005 2500');
  assert.equal(lines[0].qty, 2500);
  assert.equal(lines[1].qty, 120);
});

test('parseTextLines returns null qty for lines with no numbers at all', () => {
  const lines = parseTextLines('some product with no quantity');
  assert.equal(lines[0].qty, null);
  assert.deepEqual(lines[0].numbers, []);
});

test('parseSheetRows uses header names to find the product and qty columns', () => {
  const rows = [
    ['Sr No', 'Product Name', 'Box Qty', 'Total', 'PTS', 'Net Rate'],
    [1, 'ABD-400 1 TAB UPC0000005', 25, 2500, 2.9, 2.9],
    [2, 'KUFFDRYL 100ML UPC0000266', 8, 120, 11.25, 11.25],
  ];
  const lines = parseSheetRows(rows);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].rawText, 'ABD-400 1 TAB UPC0000005');
  assert.equal(lines[0].qty, 2500);
  assert.equal(lines[1].qty, 120);
});

test('parseSheetRows skips fully blank rows', () => {
  const rows = [
    ['Product Name', 'Qty'],
    ['ABD-400', 100],
    ['', ''],
    [null, null],
  ];
  const lines = parseSheetRows(rows);
  assert.equal(lines.length, 1);
});

test('parseSheetRows returns [] for fewer than 2 rows (no data beyond a header)', () => {
  assert.deepEqual(parseSheetRows([['Product Name', 'Qty']]), []);
  assert.deepEqual(parseSheetRows([]), []);
});
