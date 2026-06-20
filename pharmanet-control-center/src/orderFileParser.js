/**
 * Turns a party's order file content (already extracted to plain text or
 * spreadsheet rows on the client — PDF.js for PDFs, SheetJS for Excel) into
 * candidate `{ rawText, qty }` line items for the product matcher.
 *
 * Real party files vary too much in column layout to guess the quantity
 * column with full confidence, so both parsers surface every number found on
 * each line/row as `numbers` alongside a best-guess `qty` (defaulting to the
 * last number) — the review screen lets the admin correct qty per line
 * before anything is matched or submitted.
 */

export function extractNumbers(text) {
  const matches = String(text || '').match(/\d+(?:\.\d+)?/g) || [];
  return matches.map(Number);
}

/** Parses freeform text (e.g. PDF.js-extracted text) into one candidate line per non-empty row. */
export function parseTextLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((rawText) => {
      const numbers = extractNumbers(rawText);
      return { rawText, numbers, qty: numbers.length ? numbers[numbers.length - 1] : null };
    });
}

const PRODUCT_HEADER_PATTERN = /product|item|description|material|particular/i;

/**
 * Prefer an explicit "Total"/"Quantity" column over a generic "*Qty" one —
 * party sheets often have both a box/case qty and a total unit qty (the
 * actual order quantity), e.g. "Box Qty" vs "Total".
 */
function findQtyIndex(header) {
  let idx = header.findIndex((h) => /^total$/i.test(h));
  if (idx === -1) idx = header.findIndex((h) => /quantity/i.test(h));
  if (idx === -1) idx = header.findIndex((h) => /qty/i.test(h));
  return idx;
}

/** Parses spreadsheet rows (array-of-arrays, header row first) using header names to find the product/qty columns. */
export function parseSheetRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];

  const header = rows[0].map((cell) => String(cell ?? '').trim());
  const qtyIdx = findQtyIndex(header);
  const productIdx = header.findIndex((h) => PRODUCT_HEADER_PATTERN.test(h));

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell !== '' && cell != null))
    .map((row) => {
      const rawText =
        productIdx >= 0
          ? String(row[productIdx] ?? '').trim()
          : row.filter((cell) => typeof cell === 'string').join(' ').trim();
      const qtyCell = qtyIdx >= 0 ? row[qtyIdx] : null;
      const qty = qtyCell != null && qtyCell !== '' && !Number.isNaN(Number(qtyCell)) ? Number(qtyCell) : null;
      return { rawText, qty, cells: row };
    })
    .filter((line) => line.rawText);
}
