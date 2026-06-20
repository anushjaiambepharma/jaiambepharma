/**
 * Builds the `strarray` payload string for PharmaNET's
 * Webmethod.aspx/OrderInsertDataForNormalRateOrder call, reverse-engineered
 * from frmNormalRateOrder.js's `.btnsave` click handler: one "#"-prefixed,
 * "$"-delimited record per order line, concatenated with no separator
 * between records.
 */
const LINE_FIELD_ORDER = [
  'customerName',
  'customerNo',
  'divisionNo',
  'materialName',
  'materialNo',
  'templateValue',
  'qty',
  'plant',
  'orderDate',
  'customerOrderDate',
  'dispatchedDate',
  'remark',
  'orderMode',
  'divisionName',
  'customerOrderNo',
  'billToAddr',
  'shipToAddr',
  'discount',
  'chequeBookId',
  'instrumentNo',
  'matFlag',
  'taxOrExm',
  'rate',
  'value',
  'empNo',
  'empOther',
];

/** `order` carries the fields shared by every line; each entry in `order.lines` overrides/adds the per-line ones. */
export function buildNormalOrderPayload(order) {
  const { lines, ...shared } = order;
  return lines.map((line) => buildOrderLineRecord({ ...shared, ...line })).join('');
}

export function buildOrderLineRecord(fields) {
  const values = LINE_FIELD_ORDER.map((key) => {
    const value = fields[key];
    return value === undefined || value === null ? '' : String(value);
  });
  return '#' + values.join('$');
}
