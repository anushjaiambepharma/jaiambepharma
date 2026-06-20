import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

const headers = [
  'TaskType',
  'DocumentType',
  'PartyName',
  'CustomerCode',
  'DocumentNumber',
  'FromDate',
  'ToDate',
  'Division',
  'InvoiceType',
  'DownloadRequired',
  'Remarks',
];

const exampleRows = [
  ['DOWNLOAD', 'INVOICE', 'AMBIKA MEDICINES', '', 'C72012600387', '01-Jun-2026', '20-Jun-2026', 'ALL', 'ALL', 'YES', ''],
  ['DOWNLOAD', 'CREDIT_NOTE', 'R K PHARMA', '', '1172C26DF00083', '01-Jun-2026', '20-Jun-2026', 'ALL', 'ALL', 'YES', ''],
  ['DOWNLOAD', 'DEBIT_NOTE', 'BALAJI PHARMA', '', '1172D26DF00044', '01-Jun-2026', '20-Jun-2026', 'ALL', 'ALL', 'YES', ''],
];

const settingsRows = [
  ['SettingName', 'SettingValue'],
  ['DefaultPlant', '1172'],
  ['DefaultDivision', 'ALL'],
  ['DefaultFromDate', '01-Jun-2026'],
  ['DefaultToDate', '20-Jun-2026'],
  ['OutputNaming', 'DocumentType_PartyName_DocumentNumber'],
  ['SkipAlreadyDownloaded', 'YES'],
  ['CreateZip', 'YES'],
];

const wb = XLSX.utils.book_new();
const downloadSheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
XLSX.utils.book_append_sheet(wb, downloadSheet, 'Download_Documents');

const settingsSheet = XLSX.utils.aoa_to_sheet(settingsRows);
XLSX.utils.book_append_sheet(wb, settingsSheet, 'Settings');

const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync(new URL('../public/templates/Download_Documents_Template.xlsx', import.meta.url), buffer);
console.log('Template written.');
