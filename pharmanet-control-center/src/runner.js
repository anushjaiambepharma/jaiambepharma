import { PharmaNetClient, PharmaNetError } from './pharmanetClient.js';
import { groupReadyRows, matchGridRow } from './grouping.js';
import { buildFileName, folderFor } from './fileNaming.js';
import { isTransactionDocType } from './validator.js';
import { toCsv, PROCESS_LOG_COLUMNS } from './csv.js';
import { buildOutputZip } from './zip.js';
import { STATUS, INVOICE_DOC_TYPE } from './constants.js';

function logEntry(row, status, pdfFileName, errorMessage) {
  return {
    RowNumber: row.rowNumber,
    TaskType: row.TaskType,
    DocumentType: row.DocumentType,
    PartyName: row.PartyName,
    CustomerCode: row.CustomerCode,
    DocumentNumber: row.DocumentNumber,
    FromDate: row.FromDate,
    ToDate: row.ToDate,
    Division: row.Division,
    Status: status,
    PDFFileName: pdfFileName || '',
    ErrorMessage: errorMessage || '',
    ProcessedAt: new Date().toISOString(),
  };
}

/**
 * Run the full one-tap pipeline for already-validated rows.
 * `validatedRows` come from validateDownloadDocuments().rows.
 */
export async function runAll({ userId, password, validatedRows, sourceExcelBytes, sourceExcelName }) {
  const client = new PharmaNetClient();
  const log = [];
  const pdfFiles = [];
  const usedNames = new Set();

  const invalidOrSkipped = validatedRows.filter((r) => r.status !== 'READY');
  for (const row of invalidOrSkipped) {
    const status = row.status === 'INVALID' ? STATUS.VALIDATION_ERROR : row.status === 'DUPLICATE' ? STATUS.SKIPPED_DUPLICATE : 'SKIPPED_NOT_REQUIRED';
    log.push(logEntry(row, status, '', row.errors.join(' ')));
  }

  try {
    await client.login(userId, password);
  } catch (err) {
    const readyRows = validatedRows.filter((r) => r.status === 'READY');
    for (const row of readyRows) {
      log.push(logEntry(row, STATUS.FAILED_LOGIN_ERROR, '', err.message));
    }
    return finalize({ log, pdfFiles, sourceExcelBytes, sourceExcelName, loginFailed: true });
  }

  const groups = groupReadyRows(validatedRows);

  for (const group of groups) {
    // Live testing against the real PharmaNET site showed the per-row "View"
    // action on the customer invoice print page (FrmCustomerInvoicePrint.aspx)
    // doesn't carry the row's customer/document identifiers through the
    // postback — it returns 200 + a structurally valid but blank PDF instead
    // of an error. Until that's reverse-engineered against real data, refuse
    // to download plain INVOICE rows rather than risk shipping a blank file
    // under the right name.
    if (group.docType === INVOICE_DOC_TYPE) {
      for (const row of group.rows) {
        log.push(logEntry(row, STATUS.NOT_IMPLEMENTED, '', 'INVOICE bulk download is not yet verified against the live PharmaNET customer invoice print page; download it manually for now.'));
      }
      continue;
    }

    let searchResult;
    try {
      searchResult = isTransactionDocType(group.docType)
        ? await client.searchTransactions(group)
        : await client.searchInvoices({ ...group, invoiceType: group.invoiceType });
    } catch (err) {
      for (const row of group.rows) {
        log.push(logEntry(row, STATUS.FAILED_PDF_ERROR, '', `Search failed: ${err.message}`));
      }
      continue;
    }

    for (const row of group.rows) {
      const { match, candidates } = matchGridRow(row, searchResult.rows);

      if (!match) {
        const status = candidates.length > 1 ? STATUS.FAILED_MULTIPLE_MATCHES : STATUS.FAILED_NOT_FOUND;
        log.push(logEntry(row, status, '', status === STATUS.FAILED_MULTIPLE_MATCHES
          ? `${candidates.length} matching rows found on PharmaNET; add DocumentNumber to disambiguate.`
          : 'No matching row found on PharmaNET for this party/document.'));
        continue;
      }

      try {
        const reportUrl = await client.viewReport(searchResult.pageUrl, searchResult.hiddenFields, match.checkboxName);
        const pdfBytes = await client.downloadPdf(reportUrl, searchResult.pageUrl);
        const fileName = buildFileName(row.DocumentType, row.PartyName, row.DocumentNumber || match.documentNo, usedNames);
        pdfFiles.push({ path: `${folderFor(row.DocumentType)}/${fileName}`, bytes: pdfBytes });
        log.push(logEntry(row, STATUS.SUCCESS, fileName, ''));
      } catch (err) {
        const status = err instanceof PharmaNetError ? err.status : STATUS.FAILED_PDF_ERROR;
        log.push(logEntry(row, status, '', err.message));
      }
    }
  }

  return finalize({ log, pdfFiles, sourceExcelBytes, sourceExcelName, loginFailed: false });
}

function finalize({ log, pdfFiles, sourceExcelBytes, sourceExcelName, loginFailed }) {
  const successRows = log.filter((r) => r.Status === STATUS.SUCCESS);
  const failedRows = log.filter((r) => !['SUCCESS', 'SKIPPED_DUPLICATE', 'SKIPPED_NOT_REQUIRED'].includes(r.Status));
  const skippedRows = log.filter((r) => ['SKIPPED_DUPLICATE', 'SKIPPED_NOT_REQUIRED'].includes(r.Status));

  const summary = {
    totalRows: log.length,
    success: successRows.length,
    failed: failedRows.length,
    skipped: skippedRows.length,
    loginFailed,
    generatedAt: new Date().toISOString(),
  };

  const processLogCsv = toCsv(PROCESS_LOG_COLUMNS, log);
  const failedRowsCsv = toCsv(PROCESS_LOG_COLUMNS, failedRows);

  const zipBytes = buildOutputZip({
    pdfFiles,
    processLogCsv,
    failedRowsCsv,
    summaryJson: summary,
    sourceExcelBytes,
    sourceExcelName,
  });

  return { summary, log, failedRows, zipBytes };
}
