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
  index.html         Bulk PDF download automation UI
  order.html          Sales Order wizard (Normal Order + Generic/Combo)
  js/app.js           Bulk automation client logic
  js/order.js          Sales Order wizard client logic
  templates/           Pre-built Download_Documents_Template.xlsx
functions/api/       Cloudflare Pages Functions (the Worker API)
  config.js            GET  /api/config              -> { pinRequired }
  verify-pin.js         POST /api/verify-pin          -> validates X-App-Pin
  validate.js           POST /api/validate            -> validation summary + per-row status
  run-all.js            POST /api/run-all              -> login + scrape + download + ZIP
  order/parse-file.js  POST /api/order/parse-file     -> extract order lines from text/sheet
  order/prepare.js      POST /api/order/prepare        -> login + match party lines to PharmaNET
  order/submit.js       POST /api/order/submit         -> login + save real Normal/Generic order
src/                 Framework-free logic shared by the Functions and tests
  pharmanetClient.js    Cookie-jar based ASP.NET WebForms scraping/posting client
  aspxForm.js           Hidden-field / GridView / <select> / label HTML parsing helpers
  validator.js          Download_Documents sheet validation rules
  grouping.js            Search-grouping + row matching
  fileNaming.js          {DocumentType}_{PartyName}_{DocumentNumber}.pdf + dedupe
  csv.js / zip.js        Process_Log.csv / Failed_Rows.csv / output ZIP
  runner.js              Orchestrates the whole one-tap bulk-download pipeline
  orderFileParser.js     Party order text/Excel -> {rawText, qty} lines
  productMatcher.js       Fuzzy/learned/embedded-code matching against PharmaNET's material list
  learnedMappings.js      KV-backed "party product name -> PharmaNET code" memory
  salesOrderBuilder.js    Normal Order cart-string builder (frmNewOrder.aspx)
  genericOrderBuilder.js  Generic/Combo Order cart-string builder (frmGenericOrder.aspx)
  fefoAllocator.js        First-Expire-First-Out batch split for Generic Order lines
test/                Node test runner unit tests for everything in src/
```

## Sales Order wizard (`/order.html`)

Matches a distributor/party's order file (pasted text, Excel, or text-based
PDF) against PharmaNET's live material list for a customer, then saves a
real order — split automatically across PharmaNET's two separate order
systems:

- **Normal Order** (`frmNewOrder.aspx`, "Sales Order") — standard materials,
  no rate-entry authority; rate/qty-multiple-factor are fetched live.
- **Generic Order** (`frmGenericOrder.aspx`, "Combo"/division-specific
  materials) — split **FEFO** (First-Expire-First-Out) across the
  material's live batches, each split rounded to a full pack size, with one
  blended rate per material computed over its combined quantity (matching
  the page's own "Add" button behaviour exactly).

Review-step features: a NORMAL/GENERIC badge and stock warning per matched
line, a FEFO batch-split preview for Generic lines, a default "ANUSH COM"
remark, and a per-line **Pending** toggle (for out-of-stock items) with a
"Download Pending Items (CSV)" export — pending lines are excluded from the
actual PharmaNET submission. Confirmed product-name → PharmaNET-code
mappings are remembered in the `LEARNED_MAPPINGS` KV namespace so repeat
orders from the same party match automatically next time.

`submit.js` never trusts `prepare.js`'s cached data — it re-logs-in and
re-fetches rate/qty-multiplier/batches/division/doc-type/tax-class fresh at
submit time for both order systems.

## Excel format (bulk PDF download tool)

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
npm test                  # unit tests for validation/naming/grouping/csv/zip/order logic
npm run dev                # wrangler pages dev — http://localhost:8788
```

## Deployment (Cloudflare Pages)

This project lives in the `pharmanet-control-center/` subfolder of the repo,
not the repo root — set that as the **Root directory** if deploying via the
Cloudflare dashboard's Git integration.

**Dashboard (Git integration):**

1. Workers & Pages → Create application → Pages → Connect to Git → this repo.
2. Build settings: Root directory `pharmanet-control-center`, build command
   *(blank)*, build output directory `public`.
3. Settings → Functions → KV namespace bindings → create/select a namespace
   and bind it as `LEARNED_MAPPINGS` (used by the Sales Order wizard).
4. Settings → Environment variables → optionally set `APP_PIN`.

**CLI:**

```bash
npx wrangler login
npx wrangler kv namespace create LEARNED_MAPPINGS   # paste the id into wrangler.toml
npm run deploy
```

Configure in the Cloudflare Pages dashboard (Settings → Environment variables):

- `APP_PIN` *(optional)* — shared PIN gate for the app. Leave unset to disable.
- For stronger access control, put the Pages project behind **Cloudflare Access**.

No PharmaNET credentials are ever stored as secrets or env vars — the user
supplies them in the browser for each run, and they're forwarded once to
`/api/run-all` (or `/api/order/prepare` and `/api/order/submit`) over HTTPS
and never logged server-side.

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
- **Plain `INVOICE` bulk download** (`FrmCustomerInvoicePrint.aspx`) — now
  **working**. An earlier attempt returned a `200` with a structurally valid
  but **blank** PDF (`Cust`/`Plnt`/`DocNo` empty in the `frmViewReport.aspx`
  URL). A captured HAR of a real "View Report" click showed why: the invoice
  page re-resolves the selected row from the *currently posted* search
  criteria, so the "View Report" postback must replay the visible search
  fields — `txtFromDate`, `txtToDate`, `ddlType`, `ddlCustomer` (value `0`,
  not `ALL`), and `hfSampleInvoice` — none of which are `<input type=hidden>`,
  so `extractAllHiddenFields` had been dropping them. With those replayed,
  `btnViewReport` returns the correct
  `frmViewReport.aspx?rept=CUSTInvoice&Plnt=,1172,&Cust=,9007630,&DocType=,ZOR2,&DocNo=,…`
  URL and a real PDF. `viewReport()`'s blank-identifier guard (`=,,` / `=,&`)
  remains as a safety net.

**Known not to work — do not rely on yet:**

- **Order generation from `Invoice_Header` / `Invoice_Items` sheets** (the
  bulk-automation tool's original spec) is still not implemented — order
  creation is instead handled by the separate, live-verified **Sales Order
  wizard** (`/order.html`, see above), built and tested against real Normal
  Order and Generic Order saves.
- **Cloudflare Worker execution limits**: the current design processes an
  entire Run All synchronously in one request. A single transaction search
  with a wide date range can return a 9+ MB HTML response (4,775 rows seen
  live) — for large batches/date ranges, watch Worker CPU/memory limits and
  consider narrowing `FromDate`/`ToDate` per group, or moving to the
  Queues + R2 + D1 job-based design for very large batches.
