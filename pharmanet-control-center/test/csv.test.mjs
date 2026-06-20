import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/csv.js';

test('builds a header row plus one row per record', () => {
  const csv = toCsv(['A', 'B'], [{ A: '1', B: '2' }]);
  assert.equal(csv, 'A,B\r\n1,2');
});

test('quotes fields containing commas, quotes, or newlines', () => {
  const csv = toCsv(['A'], [{ A: 'has,comma' }, { A: 'has"quote' }, { A: 'has\nnewline' }]);
  const lines = csv.split('\r\n');
  assert.equal(lines[1], '"has,comma"');
  assert.equal(lines[2], '"has""quote"');
  assert.equal(lines[3], '"has\nnewline"');
});
