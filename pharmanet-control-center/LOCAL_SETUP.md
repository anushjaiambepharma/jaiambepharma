# Running PharmaNET Control Center on your own PC

These steps run the app entirely on your Windows PC — no Cloudflare account,
no deployment, no internet access needed except to reach the real PharmaNET
site itself (same as using a browser).

## 1. Install Node.js

Download and install the **LTS** version from https://nodejs.org if you
don't already have it. (Installing it adds `node` and `npm` to your
terminal.)

## 2. Get the project folder

Either:

- `git clone` this repository, **or**
- Unzip the project zip into a folder on your PC (e.g. inside
  `Intas billing`).

## 3. Open a terminal in the project folder

In File Explorer, open the `pharmanet-control-center` folder, then in the
address bar type `cmd` and press Enter (or open PowerShell and `cd` into the
folder).

## 4. Install dependencies (one-time)

```
npm install
```

## 5. Start the app

```
npm run dev
```

Leave this terminal window open — the app runs as long as it's running.

## 6. Open it in your browser

Go to **http://localhost:8788**

That's the same app as the Cloudflare-hosted version: the bulk
document-download tool at `/` and the Sales Order wizard at `/order.html`.

## Stopping / restarting

- Stop: close the terminal window, or press `Ctrl+C` in it.
- Next time: just repeat steps 3, 5, 6 (no need to `npm install` again
  unless the code changes).

## What still works the same locally

- PharmaNET login is entered fresh in the browser each time — never stored.
- The "learned product mappings" (KV) are simulated locally and persist
  between restarts in a `.wrangler` folder inside the project.
- Excel template download, order parsing, FEFO batch splitting, Normal/
  Generic order submission — all identical to the deployed version.

## Known gap (as of this writing)

Plain **invoice** bulk download is not implemented yet — Credit Note, Debit
Note, Rate Credit, and Rate Debit downloads work; invoices need a HAR
capture from a real PharmaNET session to fix (see project README for
details).
