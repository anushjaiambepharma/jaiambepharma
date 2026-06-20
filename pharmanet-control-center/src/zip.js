import { zipSync, strToU8 } from 'fflate';

/**
 * Build the PharmaNET_Output.zip package.
 * `pdfFiles` is [{ path, bytes: ArrayBuffer }], path relative to PharmaNET_Output/.
 */
export function buildOutputZip({ pdfFiles, processLogCsv, failedRowsCsv, summaryJson, sourceExcelBytes, sourceExcelName }) {
  const root = 'PharmaNET_Output';
  const files = {};

  for (const file of pdfFiles) {
    files[`${root}/${file.path}`] = new Uint8Array(file.bytes);
  }

  files[`${root}/Logs/Process_Log.csv`] = strToU8(processLogCsv);
  files[`${root}/Logs/Failed_Rows.csv`] = strToU8(failedRowsCsv);
  files[`${root}/Logs/Summary.json`] = strToU8(JSON.stringify(summaryJson, null, 2));

  if (sourceExcelBytes) {
    const name = sourceExcelName || 'Uploaded_Excel_Copy.xlsx';
    files[`${root}/Source/${name}`] = new Uint8Array(sourceExcelBytes);
  }

  return zipSync(files, { level: 6 });
}
