import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAllHiddenFields, parseGridRows, extractViewReportUrl, extractSelectOptions, extractLabelText } from '../src/aspxForm.js';

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

const SELECT_HTML = `
  <select name="ctl00$ConPhameNet$DDlMaterial" id="ctl00_ConPhameNet_DDlMaterial">
    <option value="0">--Select--</option>
    <option value="9174">SOREGEL 10GM (Combo) || 400026351 || Avail. Stock [ 19320 ] || X</option>
  </select>
`;

test('extractSelectOptions pulls value/text pairs out of a named <select>', () => {
  const options = extractSelectOptions(SELECT_HTML, 'ctl00$ConPhameNet$DDlMaterial');
  assert.equal(options.length, 2);
  assert.deepEqual(options[1], { value: '9174', text: 'SOREGEL 10GM (Combo) || 400026351 || Avail. Stock [ 19320 ] || X' });
});

test('extractSelectOptions returns an empty array for an unknown select name', () => {
  assert.deepEqual(extractSelectOptions(SELECT_HTML, 'ddlNotThere'), []);
});

test('extractLabelText strips tags and trims the contents of a named <span>', () => {
  const html = '<span id="ctl00_lblError"><font color="Red"><BR> Order Saved Successfully.</font></span>';
  assert.equal(extractLabelText(html, 'ctl00_lblError'), 'Order Saved Successfully.');
});

test('extractLabelText returns an empty string when the label is missing or empty', () => {
  assert.equal(extractLabelText('<span id="ctl00_lblError"></span>', 'ctl00_lblError'), '');
  assert.equal(extractLabelText('no label here', 'ctl00_lblError'), '');
});
