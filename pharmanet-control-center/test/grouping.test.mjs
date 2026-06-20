import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupReadyRows, matchGridRow } from '../src/grouping.js';

function readyRow(overrides = {}) {
  return {
    status: 'READY',
    DocumentType: 'CREDIT_NOTE',
    FromDate: '01-Jun-2026',
    ToDate: '20-Jun-2026',
    Division: 'ALL',
    CustomerCode: '',
    InvoiceType: 'ALL',
    PartyName: 'R K PHARMA',
    DocumentNumber: '1172C26DF00083',
    ...overrides,
  };
}

test('groups rows sharing doc type/date/division/customer into one search', () => {
  const rows = [readyRow(), readyRow({ PartyName: 'BALAJI PHARMA', DocumentNumber: 'X2' }), readyRow({ DocumentType: 'DEBIT_NOTE' })];
  const groups = groupReadyRows(rows);
  assert.equal(groups.length, 2);
  const creditGroup = groups.find((g) => g.docType === 'CREDIT_NOTE');
  assert.equal(creditGroup.rows.length, 2);
});

test('ignores non-READY rows when grouping', () => {
  const rows = [readyRow(), readyRow({ status: 'INVALID' })];
  const groups = groupReadyRows(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].rows.length, 1);
});

test('matches grid row by exact document number', () => {
  const gridRows = [
    { documentNo: '1172C26DF00083', customerName: 'R K PHARMA' },
    { documentNo: 'OTHER', customerName: 'OTHER PARTY' },
  ];
  const { match } = matchGridRow({ DocumentNumber: '1172C26DF00083', PartyName: '' }, gridRows);
  assert.equal(match.documentNo, '1172C26DF00083');
});

test('falls back to party name when document number is blank', () => {
  const gridRows = [{ documentNo: 'X1', customerName: 'R K PHARMA' }];
  const { match } = matchGridRow({ DocumentNumber: '', PartyName: 'r k pharma' }, gridRows);
  assert.equal(match.customerName, 'R K PHARMA');
});

test('flags ambiguous matches instead of guessing', () => {
  const gridRows = [
    { documentNo: 'X1', customerName: 'R K PHARMA' },
    { documentNo: 'X2', customerName: 'R K PHARMA' },
  ];
  const { match, candidates } = matchGridRow({ DocumentNumber: '', PartyName: 'R K PHARMA' }, gridRows);
  assert.equal(match, null);
  assert.equal(candidates.length, 2);
});

test('returns no match when nothing in the grid matches', () => {
  const { match, candidates } = matchGridRow({ DocumentNumber: 'MISSING', PartyName: '' }, [{ documentNo: 'X1', customerName: 'A' }]);
  assert.equal(match, null);
  assert.equal(candidates.length, 0);
});
