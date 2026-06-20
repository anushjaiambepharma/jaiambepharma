# PharmaNET Control Center

Excel-first bulk automation for the Intas PharmaNET CSA portal
(`https://genericpharmanet.intaspharma.com/intaspharmanetCSA/`).

Upload one Excel file, click **Run All**, get back a ZIP of correctly named
PDFs plus CSV/JSON logs. No party names, document numbers, or dates are
re-typed in the web app — they all come from the spreadsheet.

## Workflow

```
Upload Excel → Validate → Summary → Run All → Download ZIP + Logs
```

1. Enter the App PIN (if `APP_PIN` is configured).
2. Enter PharmaNET User ID / Password (kept in memory for this run only — never stored, never logged).
3. Upload the `Download_Documents` workbook (template available via "Download Excel Template").
4. Review the validation summary (ready / invalid / duplicate rows, invoice/credit/debit counts).
5. Click **Run All**. The app logs into PharmaNET once, groups rows by
   `DocumentType + FromDate + ToDate + Division + CustomerCode` to minimize
   searches, matches each Excel row against the PharmaNET result grid by
   `DocumentNumber` and/or `PartyName`, downloads the matching PDF, and names
   it `{DocumentType}_{PartyName}_{DocumentNumber}.pdf`.
6. Download `PharmaNET_Output.zip` (Invoices/CreditNotes/DebitNotes/Logs/Source)
   and/or the individual Failed Rows / Process Log CSVs.

## Project layout

```
public/             Static frontend (Cloudflare Pages)
  index.html         Step-by-step UI
  js/app.js           Client logic: Excel parsing (SheetJS), API calls, downloads
  templates/           Pre-built Download_Documents_Template.xlsx
functions/api/       Cloudflare Pages Functions (the Worker API)
  config.js            GET  /api/config        -> { pinRequired }
  verify-pin.js         POST /api/verify-pin    -> validates X-App-Pin
  validate.js           POST /api/validate      -> validation summary + per-row status
  run-all.js            POST /api/run-all       -> login + scrape + download + ZIP
src/                 Framework-free logic shared by the Functions and tests
  pharmanetClient.js    Cookie-jar based ASP.NET WebForms scraping client
  aspxForm.js           Hidden-field / GridView HTML parsing helpers
  validator.js          Download_Documents sheet validation rules
  grouping.js            Search-grouping + row matching
  fileNaming.js          {DocumentType}_{PartyName}_{DocumentNumber}.pdf + dedupe
  csv.js / zip.js        Process_Log.csv / Failed_Rows.csv / output ZIP
  runner.js              Orchestrates the whole one-tap pipeline
test/                Node test runner unit tests for everything in src/
```

## Excel format

Sheet name: `Download_Documents`. Columns:

```
TaskType DocumentType PartyName CustomerCode DocumentNumber FromDate ToDate
Division InvoiceType DownloadRequired Remarks
```

`DocumentType` ∈ `INVOICE, CREDIT_NOTE, CREDIT_NOTE_TAX, DEBIT_NOTE, DEBIT_NOTE_TAX, RATE_CREDIT, RATE_DEBIT`.
Dates must be `DD-MMM-YYYY` (e.g. `01-Jun-2026`).

## Local development

```bash
npm install
npm run build:template   # regenerate public/templates/Download_Documents_Template.xlsx
npm test                  # unit tests for validation/naming/grouping/csv/zip
npm run dev                # wrangler pages dev — http://localhost:8788
```

## Deployment (Cloudflare Pages)

```bash
npm run deploy
```

Configure in the Cloudflare Pages dashboard (Settings → Environment variables):

- `APP_PIN` *(optional)* — shared PIN gate for the app. Leave unset to disable.
- For stronger access control, put the Pages project behind **Cloudflare Access**.

No PharmaNET credentials are ever stored as secrets or env vars — the user
supplies them in the browser for each run, and they're forwarded once to
`/api/run-all` over HTTPS and never logged server-side (see `run-all.js`,
which only logs the error message on failure, never the request body).

## Known limitations / what to verify against the live site

This was built from a detailed technical spec (field IDs, doc-type/division
codes, AJAX postback shape) rather than against the live, authenticated
PharmaNET portal — there were no credentials available to test the scraping
flow end-to-end in this environment. Treat `src/pharmanetClient.js` and
`src/aspxForm.js` as the first integration pass and verify against your real
account before relying on it for production volume:

- **Login success detection** (`PharmaNetClient.login`) currently checks
  whether the `LogPhNet$UserName` field is still present in the post-login
  HTML. Confirm this correctly distinguishes success from failure on the
  real site.
- **GridView row parsing** (`parseGridRows`) assumes the first `<td>` in each
  data row is the checkbox and the rest map 1:1 to the documented columns in
  order. If PharmaNET's actual markup nests extra cells/spans, adjust the
  `columns` arrays passed in `pharmanetClient.js`.
- **AJAX "View Report" postback** assumes the exact `ScriptManager1` /
  `__ASYNCPOST` / header shape given in the spec. If PharmaNET returns a
  different delta format, `extractViewReportUrl` (regex on `window.open(...)`)
  is the single place to adjust.
- **Invoice/order generation** (`Invoice_Header` / `Invoice_Items` sheets) is
  intentionally **not implemented** yet — the spec explicitly defers this
  until the live PharmaNET order-creation workflow has been analysed. Only
  bulk **download** (`Download_Documents` sheet) is wired up end-to-end.
- **Cloudflare Worker execution limits**: the current design processes an
  entire Run All synchronously in one request (matches the "small/medium
  file" recommendation in the spec). For very large batches, move to the
  Queues + R2 + D1 job-based design instead of raising timeouts.
