export const BASE_URL = 'https://genericpharmanet.intaspharma.com/intaspharmanetCSA/';
export const LOGIN_PATH = '';
export const TRANSACTIONS_PATH = 'frmRptTRANSACTIONS.aspx';
export const INVOICE_PRINT_PATH = 'FrmCustomerInvoicePrint.aspx';

export const DEFAULT_PLANT = '1172';

export const DOC_TYPE_CODE = {
  CREDIT_NOTE: 'ZCR2',
  CREDIT_NOTE_TAX: 'ZCRT',
  DEBIT_NOTE: 'ZDR2',
  DEBIT_NOTE_TAX: 'ZDRT',
  RATE_CREDIT: 'ZCR3',
  RATE_DEBIT: 'ZDR3',
};

export const DIVISION_CODE = {
  ALL: 'ALL',
  ACTIMA: '27',
  'ALTIS OTHERS': '62',
  ARISE: '76',
  COMMON: '2',
  DEFAULT: '1',
  GENERICS: '16',
  INDIUM: '26',
  INNOVA: '71',
};

export const INVOICE_TYPE_CODE = {
  ALL: '0',
  TAX_INVOICE: 'T',
  BILL_OF_SUPPLY: 'E',
};

// Document types handled by the transaction (credit/debit) report page.
export const TRANSACTION_DOC_TYPES = new Set([
  'CREDIT_NOTE',
  'CREDIT_NOTE_TAX',
  'DEBIT_NOTE',
  'DEBIT_NOTE_TAX',
  'RATE_CREDIT',
  'RATE_DEBIT',
]);

// Document type "INVOICE" is handled by the customer invoice print page.
export const INVOICE_DOC_TYPE = 'INVOICE';

export const ALL_DOC_TYPES = [
  'INVOICE',
  'CREDIT_NOTE',
  'CREDIT_NOTE_TAX',
  'DEBIT_NOTE',
  'DEBIT_NOTE_TAX',
  'RATE_CREDIT',
  'RATE_DEBIT',
];

export const DOC_TYPE_LABEL = {
  INVOICE: 'Invoice',
  CREDIT_NOTE: 'CreditNote',
  CREDIT_NOTE_TAX: 'CreditNoteTax',
  DEBIT_NOTE: 'DebitNote',
  DEBIT_NOTE_TAX: 'DebitNoteTax',
  RATE_CREDIT: 'RateCredit',
  RATE_DEBIT: 'RateDebit',
};

// Output ZIP sub-folder for each document type.
export const DOC_TYPE_FOLDER = {
  INVOICE: 'Invoices',
  CREDIT_NOTE: 'CreditNotes',
  CREDIT_NOTE_TAX: 'CreditNotes',
  DEBIT_NOTE: 'DebitNotes',
  DEBIT_NOTE_TAX: 'DebitNotes',
  RATE_CREDIT: 'CreditNotes',
  RATE_DEBIT: 'DebitNotes',
};

export const BROWSER_TYPE_HEADER_VALUE = 'Chrome /126.0.0.0';

export const STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED_NOT_FOUND: 'FAILED_NOT_FOUND',
  FAILED_MULTIPLE_MATCHES: 'FAILED_MULTIPLE_MATCHES',
  FAILED_PDF_ERROR: 'FAILED_PDF_ERROR',
  FAILED_LOGIN_ERROR: 'FAILED_LOGIN_ERROR',
  SKIPPED_DUPLICATE: 'SKIPPED_DUPLICATE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
};

// Normal Order ("Sales Order", no rate-entry authority) form metadata for
// frmNormalRateOrder.aspx. "Designation" is a static dropdown on that page
// (never server-fetched) used to look up which employee number the order is
// recorded under; 999 ("Others") skips the employee lookup entirely and
// records a free-text note instead.
export const ORDER_DESIGNATIONS = [
  { value: '1', label: 'Sales Head' },
  { value: '2', label: 'SM' },
  { value: '3', label: 'RBM' },
  { value: '4', label: 'ABM/SR ABM' },
  { value: '5', label: 'FVO(BE)' },
  { value: '6', label: 'FRO(RO)' },
  { value: '999', label: 'Others' },
];

export const ORDER_DESIGNATION_OTHER = '999';

// The template dropdown only ever offers one real choice server-side.
export const NORMAL_ORDER_TEMPLATE_VALUE = '3';
