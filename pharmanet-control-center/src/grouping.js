/**
 * Group "READY" rows so PharmaNET only has to be searched once per distinct
 * (DocumentType, FromDate, ToDate, Division, CustomerCode) combination,
 * instead of once per Excel row.
 */
export function groupReadyRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.status !== 'READY') continue;
    const key = [row.DocumentType, row.FromDate, row.ToDate, row.Division, row.CustomerCode || ''].join('|');
    if (!groups.has(key)) {
      groups.set(key, {
        docType: row.DocumentType,
        fromDate: row.FromDate,
        toDate: row.ToDate,
        division: row.Division,
        customerCode: row.CustomerCode || '',
        invoiceType: row.InvoiceType,
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  }
  return Array.from(groups.values());
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Match an Excel row against a page's parsed grid rows by DocumentNumber
 * (preferred) and/or PartyName. Returns { match, candidates } where `match`
 * is the single matching grid row, or null if not found / ambiguous.
 */
export function matchGridRow(excelRow, gridRows) {
  const wantDocNo = normalizeText(excelRow.DocumentNumber);
  const wantParty = normalizeText(excelRow.PartyName);

  let candidates = gridRows;
  if (wantDocNo) {
    candidates = candidates.filter((r) => normalizeText(r.documentNo) === wantDocNo);
  }
  if (candidates.length !== 1 && wantParty) {
    const byParty = candidates.filter((r) => normalizeText(r.customerName) === wantParty);
    if (byParty.length > 0) candidates = byParty;
  }

  if (candidates.length === 1) return { match: candidates[0], candidates };
  return { match: null, candidates };
}
