import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGenericOrderCartRow, buildGenericOrderPayload } from '../src/genericOrderBuilder.js';

const baseRow = {
  plant: '1172',
  custNo: '9005148',
  divisionNo: '27',
  orderMode: '5',
  customerOrderNo: '',
  docType: 'ZOD6',
  billToAddr: '1',
  institution: '0',
  materialNo: '9174',
  qty: '120',
  materialName: 'SOREGEL 10GM (Combo)',
  rate: '11.25',
  matFlag: 'X',
  taxClass: 'T',
  batch: 'C726001',
  empNo: '0',
  empOther: '',
};

test('buildGenericOrderCartRow emits exactly 21 "|!|"-delimited fields in the documented order', () => {
  const row = buildGenericOrderCartRow(baseRow);
  const fields = row.split('|!|');
  assert.equal(fields.length, 21);
  assert.deepEqual(fields, [
    '1172', '9005148', '27', '5', '', 'ZOD6', '1', '0', '9174', '120', 'SOREGEL 10GM (Combo)',
    '0', '9174', '11.25', 'X', '0', 'T', '9174-C726001', 'C726001', '0', '',
  ]);
});

test('buildGenericOrderCartRow treats missing optional fields as empty rather than the literal string "undefined"', () => {
  const row = buildGenericOrderCartRow({ ...baseRow, customerOrderNo: undefined, institution: undefined, empOther: undefined });
  const fields = row.split('|!|');
  assert.equal(fields[4], ''); // customerOrderNo
  assert.equal(fields[7], '0'); // institution defaults to '0'
  assert.equal(fields[20], ''); // empOther
});

test('buildGenericOrderCartRow keys the duplicate-check field on "materialNo-batch"', () => {
  const row = buildGenericOrderCartRow({ ...baseRow, materialNo: '9174', batch: 'C726002' });
  assert.equal(row.split('|!|')[17], '9174-C726002');
});

test('buildGenericOrderPayload joins multiple cart rows with "#@#", one per FEFO-split batch', () => {
  const payload = buildGenericOrderPayload([
    baseRow,
    { ...baseRow, qty: '264', batch: 'C726002' },
  ]);
  const rows = payload.split('#@#');
  assert.equal(rows.length, 2);
  assert.ok(rows[0].includes('C726001'));
  assert.ok(rows[1].includes('C726002'));
});
