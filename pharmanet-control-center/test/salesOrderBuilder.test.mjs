import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderLineRecord, buildNormalOrderPayload } from '../src/salesOrderBuilder.js';

const baseLine = {
  customerName: 'TEST CUSTOMER',
  customerNo: '1000001',
  divisionNo: '27',
  materialName: 'TEST MATERIAL 100ML',
  materialNo: '9999',
  templateValue: '3',
  qty: '100',
  plant: '1172',
  orderDate: '20-Jun-2026',
  customerOrderDate: '20-Jun-2026',
  dispatchedDate: '20-Jun-2026',
  remark: '',
  orderMode: '5',
  divisionName: 'ACTIMA',
  customerOrderNo: '',
  billToAddr: '1',
  shipToAddr: '2',
  discount: '0.00',
  chequeBookId: '0',
  instrumentNo: '',
  matFlag: 'B',
  taxOrExm: 'T',
  rate: '10.00',
  value: '1000.00',
  empNo: '0',
  empOther: 'Admin',
};

test('buildOrderLineRecord emits exactly 26 "$"-delimited fields prefixed with "#" in the documented order', () => {
  const record = buildOrderLineRecord(baseLine);
  assert.ok(record.startsWith('#'));
  const fields = record.slice(1).split('$');
  assert.equal(fields.length, 26);
  assert.deepEqual(fields, [
    'TEST CUSTOMER', '1000001', '27', 'TEST MATERIAL 100ML', '9999', '3', '100', '1172',
    '20-Jun-2026', '20-Jun-2026', '20-Jun-2026', '', '5', 'ACTIMA', '', '1', '2', '0.00',
    '0', '', 'B', 'T', '10.00', '1000.00', '0', 'Admin',
  ]);
});

test('buildOrderLineRecord treats missing fields as empty rather than the literal string "undefined"', () => {
  const record = buildOrderLineRecord({ ...baseLine, remark: undefined, customerOrderNo: null });
  const fields = record.slice(1).split('$');
  assert.equal(fields[11], ''); // remark
  assert.equal(fields[14], ''); // customerOrderNo
});

test('buildNormalOrderPayload concatenates one "#"-prefixed record per line, sharing the order-level fields', () => {
  const payload = buildNormalOrderPayload({
    customerName: baseLine.customerName,
    customerNo: baseLine.customerNo,
    plant: baseLine.plant,
    orderDate: baseLine.orderDate,
    customerOrderDate: baseLine.customerOrderDate,
    dispatchedDate: baseLine.dispatchedDate,
    remark: '',
    orderMode: '5',
    customerOrderNo: '',
    billToAddr: '1',
    shipToAddr: '2',
    discount: '0.00',
    chequeBookId: '0',
    instrumentNo: '',
    empNo: '0',
    empOther: 'Admin',
    templateValue: '3',
    lines: [
      { divisionNo: '27', divisionName: 'ACTIMA', materialName: 'MAT A', materialNo: '1', qty: '100', matFlag: 'B', taxOrExm: 'T', rate: '2.90', value: '290.00' },
      { divisionNo: '71', divisionName: 'INNOVA', materialName: 'MAT B', materialNo: '2', qty: '50', matFlag: 'B', taxOrExm: 'T', rate: '27.00', value: '1350.00' },
    ],
  });

  const records = payload.split('#').filter(Boolean);
  assert.equal(records.length, 2);
  assert.ok(payload.startsWith('#'));
  assert.ok(records[0].includes('MAT A'));
  assert.ok(records[1].includes('MAT B'));
});
