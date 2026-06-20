// Helpers for scraping classic ASP.NET WebForms pages: pulling hidden
// postback-state fields out of HTML and stripping tags from table cells.

/** Extract every <input type="hidden" name="..." value="..."> field from a page. */
export function extractAllHiddenFields(html) {
  const fields = {};
  const inputRegex = /<input\b[^>]*>/gi;
  let match;
  while ((match = inputRegex.exec(html))) {
    const tag = match[0];
    if (!/type=["']hidden["']/i.test(tag)) continue;
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
    if (!nameMatch) continue;
    const valueMatch = tag.match(/\bvalue=["']([^"']*)["']/i);
    fields[nameMatch[1]] = valueMatch ? decodeHtmlEntities(valueMatch[1]) : '';
  }
  return fields;
}

/**
 * Extract every <option> from a named <select> as {value, text} pairs.
 * Needed for pages like frmGenericOrder.aspx where dropdowns are populated
 * via full postbacks rather than JSON webmethods, so there's no API
 * response to parse directly.
 */
export function extractSelectOptions(html, selectName) {
  const escaped = selectName.replace(/[$]/g, '\\$');
  const selectRegex = new RegExp(`<select\\b[^>]*name=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i');
  const selectMatch = html.match(selectRegex);
  if (!selectMatch) return [];

  const optionRegex = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
  const options = [];
  let match;
  while ((match = optionRegex.exec(selectMatch[1]))) {
    const valueMatch = match[1].match(/\bvalue=["']([^"']*)["']/i);
    options.push({
      value: valueMatch ? decodeHtmlEntities(valueMatch[1]) : '',
      text: stripTags(match[2]),
    });
  }
  return options;
}

/** Extract a master-page status/error <span>'s text content (e.g. ctl00_lblError). */
export function extractLabelText(html, labelId) {
  const regex = new RegExp(`<span\\b[^>]*id=["']${labelId}["'][^>]*>([\\s\\S]*?)<\\/span>`, 'i');
  const match = html.match(regex);
  return match ? stripTags(match[1]) : '';
}

export function decodeHtmlEntities(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function stripTags(html) {
  return decodeHtmlEntities(String(html).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull a named ASP.NET GridView's <table> out of a page and parse its rows.
 * Assumes the first <td> in each data row holds the row-select checkbox and
 * the remaining cells map 1:1 onto `columns` in document order.
 */
export function parseGridRows(html, gridId, columns) {
  const tableRegex = new RegExp(`<table[^>]*id=["']${gridId}["'][^>]*>([\\s\\S]*?)<\\/table>`, 'i');
  const tableMatch = html.match(tableRegex);
  if (!tableMatch) return [];

  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableMatch[1]))) {
    const rowHtml = rowMatch[1];

    const cellRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml))) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length === 0) continue; // header row (<th>) or footer row, not a data row

    const checkboxMatch = rowHtml.match(/<input\b[^>]*type=["']checkbox["'][^>]*>/i);
    if (!checkboxMatch) continue; // "no records found" row etc.
    const nameMatch = checkboxMatch[0].match(/\bname=["']([^"']+)["']/i);
    if (!nameMatch) continue;
    const checkboxName = nameMatch[1];

    const data = { checkboxName };
    columns.forEach((col, idx) => {
      data[col] = cells[idx + 1] ?? ''; // cells[0] is the checkbox column
    });
    rows.push(data);
  }
  return rows;
}

/** Extract the frmViewReport.aspx URL from an ASP.NET AJAX partial-postback response. */
export function extractViewReportUrl(ajaxResponseText) {
  const match = ajaxResponseText.match(/window\.open\("([^"]+)"/);
  return match ? decodeHtmlEntities(match[1]) : null;
}
