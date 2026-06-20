import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateBatchesFefo } from '../src/fefoAllocator.js';

const batches = [
  { batch: 'C726002', stockQty: 300, expiry: 'Jan-2028' },
  { batch: 'C726001', stockQty: 120, expiry: 'Dec-2027' },
];

test('allocateBatchesFefo draws down the earliest-expiring batch first', () => {
  const allocations = allocateBatchesFefo(batches, 384, 24);
  assert.deepEqual(allocations, [
    { batch: 'C726001', qty: 120, expiry: 'Dec-2027' },
    { batch: 'C726002', qty: 264, expiry: 'Jan-2028' },
  ]);
});

test('allocateBatchesFefo rejects a requested qty that is not a multiple of the pack size', () => {
  assert.throws(() => allocateBatchesFefo(batches, 385, 24), /multiple of the pack size/);
});

test('allocateBatchesFefo throws when total stock across batches cannot cover the request', () => {
  assert.throws(() => allocateBatchesFefo(batches, 100008, 24), /Not enough stock/);
});

test('allocateBatchesFefo skips zero-stock batches and rounds each split down to a full pack', () => {
  const withEmpty = [
    { batch: 'EMPTY', stockQty: 0, expiry: 'Nov-2027' },
    { batch: 'C726001', stockQty: 120, expiry: 'Dec-2027' },
  ];
  const allocations = allocateBatchesFefo(withEmpty, 96, 24);
  assert.deepEqual(allocations, [{ batch: 'C726001', qty: 96, expiry: 'Dec-2027' }]);
});

test('allocateBatchesFefo sorts batches with unparseable expiry last', () => {
  const mixed = [
    { batch: 'BAD', stockQty: 50, expiry: 'not-a-date' },
    { batch: 'GOOD', stockQty: 50, expiry: 'Jan-2026' },
  ];
  const allocations = allocateBatchesFefo(mixed, 50, 1);
  assert.equal(allocations[0].batch, 'GOOD');
});
