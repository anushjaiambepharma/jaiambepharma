/**
 * Builds the `hidval` cart-string PharmaNET's frmGenericOrder.aspx expects on
 * its Save postback, reverse-engineered from the page's own client-side
 * `Validation()` function (Scripts/Validation.js): one record per cart row,
 * 21 "|!|"-delimited fields, records joined by "#@#". Unlike Normal Order
 * there is no webmethod for this — Save is a plain ASP.NET postback whose
 * server-side handler parses this same string out of the form body.
 */
const CELL_SPLITTER = '|!|';
const ROW_SPLITTER = '#@#';

export function buildGenericOrderCartRow(fields) {
  const values = [
    fields.plant, // 0
    fields.custNo, // 1
    fields.divisionNo, // 2
    fields.orderMode, // 3
    fields.customerOrderNo ?? '', // 4
    fields.docType, // 5
    fields.billToAddr, // 6
    fields.institution ?? '0', // 7
    fields.materialNo, // 8
    fields.qty, // 9
    fields.materialName, // 10
    '0', // 11
    fields.materialNo, // 12
    fields.rate, // 13
    fields.matFlag, // 14
    '0', // 15
    fields.taxClass, // 16
    `${fields.materialNo}-${fields.batch}`, // 17
    fields.batch, // 18
    fields.empNo ?? '0', // 19
    fields.empOther ?? '', // 20
  ];
  return values.map((v) => (v === undefined || v === null ? '' : String(v))).join(CELL_SPLITTER);
}

export function buildGenericOrderPayload(lines) {
  return lines.map(buildGenericOrderCartRow).join(ROW_SPLITTER);
}
