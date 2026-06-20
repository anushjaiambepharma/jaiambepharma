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

## Known limitations / what's verified against the live site

This was first built from a detailed technical spec, then verified and fixed
against the real, authenticated PharmaNET portal:

**Verified working end-to-end (login → search → view report → PDF download):**

- **Login** (`PharmaNetClient.login`) — confirmed correct: a successful login
  redirects to `frmMainPage.aspx`; the `LogPhNet$UserName`-presence check
  correctly distinguishes success from failure.
- **GridView row parsing** (`parseGridRows`) — fixed a bug where the header
  row's "select all" checkbox (`<th>`-only row) was mis-parsed as a data row.
  Confirmed against a real 4,775-row search result that real customer
  names/document numbers/dates now parse correctly.
- **CREDIT_NOTE / CREDIT_NOTE_TAX / DEBIT_NOTE / DEBIT_NOTE_TAX / RATE_CREDIT /
  RATE_DEBIT downloads** (`frmRptTRANSACTIONS.aspx`) — fully working. The
  "View Report" step turned out to need a normal synchronous form submit of
  `btnViewReport` (not the AJAX `UpdatePanel` partial-postback originally
  assumed from the spec — that path returns a bare `500` error on this site).
  Real PDFs have been downloaded and verified for multiple rows.
- **Search field IDs/values** (`ddlPlant`, `ddlDocType`, `ddlDivision`, doc
  type and division codes in `constants.js`) — all confirmed to match the
  live dropdowns exactly.

**Known not to work — do not rely on yet:**

- **Plain `INVOICE` bulk download** (`FrmCustomerInvoicePrint.aspx`) is
  **disabled** in `runner.js` (rows are logged as `NOT_IMPLEMENTED`). Live
  testing showed the row-to-report mapping is broken: triggering "View" for a
  specific invoice row (via either the per-row `lbView` link or the
  checkbox+`btnViewReport` button) returns a `200` with a **structurally
  valid but blank PDF template** — `Cust`/`Plnt`/`DocNo` come back empty in
  the `frmViewReport.aspx` query string instead of erroring. The credit/debit
  page passes those identifiers through a `GridView.DataKeys`-style
  mechanism that the invoice page apparently doesn't expose the same way; the
  real lookup mechanism needs a captured browser network trace (e.g. a HAR
  file from clicking "View" on a real invoice) to reverse-engineer correctly.
  `PharmaNetClient.viewReport()` also now hard-fails on any report URL with
  blank bracketed identifiers (`=,,` or `=,&`), so even if this path is
  re-enabled by mistake it won't silently ship a wrong file.
- **`searchInvoices()` itself works** (search/filter/grid-parsing on the
  invoice print page is confirmed correct — only the per-row "View" action is
  broken), so it's reusable once the report-URL mechanism is solved.
- **Invoice/order generation** (`Invoice_Header` / `Invoice_Items` sheets) is
  intentionally **not implemented** — the spec explicitly defers this until
  the live PharmaNET order-creation workflow has been analysed.
- **Cloudflare Worker execution limits**: the current design processes an
  entire Run All synchronously in one request. A single transaction search
  with a wide date range can return a 9+ MB HTML response (4,775 rows seen
  live) — for large batches/date ranges, watch Worker CPU/memory limits and
  consider narrowing `FromDate`/`ToDate` per group, or moving to the
  Queues + R2 + D1 job-based design for very large batches.
