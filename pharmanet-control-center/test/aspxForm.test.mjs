import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAllHiddenFields, parseGridRows, extractViewReportUrl } from '../src/aspxForm.js';

test('extractAllHiddenFields pulls name/value pairs from hidden inputs only', () => {
  const html = `
    <input type="hidden" name="__VIEWSTATE" value="abc123" />
    <input type="text" name="ctl00$txtFromDate" value="01-Jan-2024" />
    <input type="hidden" name="__VIEWSTATEGENERATOR" value="E36C67C7" />
  `;
  assert.deepEqual(extractAllHiddenFields(html), {
    __VIEWSTATE: 'abc123',
    __VIEWSTATEGENERATOR: 'E36C67C7',
  });
});

// Shaped after the real PharmaNET GridView markup: the header row uses <th>
// cells (zero <td>s) but still contains a "select all" checkbox named
// "CheckAll" — that must not be mistaken for a data row.
const GRID_HTML = `
<table id="ctl00_ConPhameNet_gvTransactionDetails">
  <tr>
    <th scope="col"><input id="CheckAll" visible="false" name="CheckAll" type="checkbox" onclick="Select(this);"></th>
    <th scope="col">Customer Name</th>
    <th scope="col">Document No</th>
  </tr>
  <tr align="center" bgcolor="#F6F1DA">
    <td><input id="ctl00_ConPhameNet_gvTransactionDetails_ctl02_CheckInvoice" type="checkbox" name="ctl00$ConPhameNet$gvTransactionDetails$ctl02$CheckInvoice" /></td>
    <td>SAMPLE CUSTOMER ONE</td>
    <td>1172C24DF00001</td>
  </tr>
  <tr align="center" bgcolor="White">
    <td><input id="ctl00_ConPhameNet_gvTransactionDetails_ctl03_CheckInvoice" type="checkbox" name="ctl00$ConPhameNet$gvTransactionDetails$ctl03$CheckInvoice" /></td>
    <td>SAMPLE CUSTOMER TWO</td>
    <td>1172C24DF00002</td>
  </tr>
</table>
`;

test('parseGridRows skips the all-<th> header row despite its "CheckAll" checkbox', () => {
  const rows = parseGridRows(GRID_HTML, 'ctl00_ConPhameNet_gvTransactionDetails', ['customerName', 'documentNo']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].checkboxName, 'ctl00$ConPhameNet$gvTransactionDetails$ctl02$CheckInvoice');
  assert.equal(rows[0].customerName, 'SAMPLE CUSTOMER ONE');
  assert.equal(rows[0].documentNo, '1172C24DF00001');
  assert.equal(rows[1].checkboxName, 'ctl00$ConPhameNet$gvTransactionDetails$ctl03$CheckInvoice');
});

test('parseGridRows returns no rows for an unknown grid id', () => {
  assert.deepEqual(parseGridRows(GRID_HTML, 'someOtherGrid', ['customerName']), []);
});

test('extractViewReportUrl pulls the window.open(...) URL out of a postback response', () => {
  const text = 'some script junk window.open("frmViewReport.aspx?rept=ZCR2&TranNo=,123,", "_blank"); more junk';
  assert.equal(extractViewReportUrl(text), 'frmViewReport.aspx?rept=ZCR2&TranNo=,123,');
});

test('extractViewReportUrl returns null when there is no window.open call', () => {
  assert.equal(extractViewReportUrl('no report here'), null);
});
