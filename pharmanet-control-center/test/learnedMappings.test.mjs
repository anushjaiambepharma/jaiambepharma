import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLearnedMappings, saveLearnedMapping } from '../src/learnedMappings.js';

function fakeKv(initial = {}) {
  let store = initial.mappings ? { learnedProductMappings: JSON.stringify(initial.mappings) } : {};
  return {
    async get(key) {
      return store[key] ?? null;
    },
    async put(key, value) {
      store[key] = value;
    },
  };
}

test('loadLearnedMappings returns {} when nothing has been learned yet', async () => {
  const kv = fakeKv();
  assert.deepEqual(await loadLearnedMappings(kv), {});
});

test('loadLearnedMappings returns {} when no KV binding is configured', async () => {
  assert.deepEqual(await loadLearnedMappings(undefined), {});
});

test('saveLearnedMapping adds a new key without clobbering previously learned ones', async () => {
  const kv = fakeKv({ mappings: { 'abd sus 10ml': 'P001' } });
  await saveLearnedMapping(kv, 'kuffdryl 100ml', 'UPC0000266');
  const mappings = await loadLearnedMappings(kv);
  assert.deepEqual(mappings, { 'abd sus 10ml': 'P001', 'kuffdryl 100ml': 'UPC0000266' });
});

test('saveLearnedMapping is a no-op when no KV binding is configured', async () => {
  await assert.doesNotReject(saveLearnedMapping(undefined, 'abd sus 10ml', 'P001'));
});
