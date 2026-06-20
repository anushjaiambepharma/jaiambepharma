function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCsvField(row[col])).join(','));
  }
  return lines.join('\r\n');
}

export const PROCESS_LOG_COLUMNS = [
  'RowNumber',
  'TaskType',
  'DocumentType',
  'PartyName',
  'CustomerCode',
  'DocumentNumber',
  'FromDate',
  'ToDate',
  'Division',
  'Status',
  'PDFFileName',
  'ErrorMessage',
  'ProcessedAt',
];
