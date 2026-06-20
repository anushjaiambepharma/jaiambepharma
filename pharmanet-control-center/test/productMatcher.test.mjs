import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductName, matchProduct, matchOrderLines } from '../src/productMatcher.js';

test('normalizeProductName collapses sus/syp and ml spacing variants to the same key', () => {
  const variants = ['abd sus 10 ml', 'abd syp 10 ml', 'abd sus 10ml', 'abd syp 10ml', 'ABD SYP 10 ML'];
  const keys = variants.map(normalizeProductName);
  assert.equal(new Set(keys).size, 1);
  assert.equal(keys[0], 'abd sus 10ml');
});

test('matchProduct auto-confirms an exact normalized match against the product master', () => {
  const master = [{ code: 'P001', name: 'ABD Susp 10ml' }];
  const result = matchProduct('abd syp 10 ml', master);
  assert.equal(result.status, 'AUTO_CONFIRMED');
  assert.equal(result.product.code, 'P001');
});

test('matchProduct auto-confirms via a previously-learned mapping even with no master match', () => {
  const master = [{ code: 'P001', name: 'Totally Different Listed Name' }];
  const learned = { 'abd sus 10ml': 'P001' };
  const result = matchProduct('abd syp 10ml', master, learned);
  assert.equal(result.status, 'AUTO_CONFIRMED');
  assert.equal(result.product.code, 'P001');
});

test('matchProduct returns ranked candidates for review when nothing matches exactly or is learned', () => {
  const master = [
    { code: 'P001', name: 'ABZ Suspension 10ml' },
    { code: 'P002', name: 'Completely Unrelated Product' },
  ];
  const result = matchProduct('abd sus 10ml', master);
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.ok(result.candidates.length >= 1);
  assert.equal(result.candidates[0].code, 'P001');
});

test('matchProduct returns no candidates when nothing is close enough', () => {
  const master = [{ code: 'P002', name: 'Completely Unrelated Product' }];
  const result = matchProduct('abd sus 10ml', master);
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.deepEqual(result.candidates, []);
});

test('matchOrderLines applies matching across a list of parsed lines', () => {
  const master = [{ code: 'P001', name: 'ABD Susp 10ml' }];
  const lines = [
    { rawText: 'abd sus 10 ml', qty: 5 },
    { rawText: 'abd syp 10ml', qty: 2 },
  ];
  const results = matchOrderLines(lines, master);
  assert.equal(results.length, 2);
  assert.equal(results[0].status, 'AUTO_CONFIRMED');
  assert.equal(results[0].line.qty, 5);
  assert.equal(results[1].status, 'AUTO_CONFIRMED');
});
