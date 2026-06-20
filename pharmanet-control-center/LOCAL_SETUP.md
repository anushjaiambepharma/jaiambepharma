# Running PharmaNET Control Center on your own PC

These steps run the app entirely on your Windows PC — no Cloudflare account,
no deployment, no internet access needed except to reach the real PharmaNET
site itself (same as using a browser).

## Quick start (Windows): just double-click `start.bat`

Once Node.js is installed (step 1 below) and you have the project folder on
your PC, you can simply **double-click `start.bat`**. It installs
dependencies the first time, starts the local server, and opens the app in
your browser automatically. Keep that window open while you use the app;
close it to stop. (The manual steps below do the same thing by hand.)

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
npm start
```

This runs `node server.mjs` — a plain Node server, no Cloudflare/wrangler
needed. Leave this terminal window open; the app runs as long as it's
running.

(`npm run dev` still works too — that uses wrangler to emulate Cloudflare
more closely — but `npm start` is the simpler, faster local option.)

**Optional flags:**

```
APP_PIN=1234 npm start     # require a PIN to use the app
PORT=3000 npm start        # serve on a different port
```

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
  between restarts in a `.local-kv.json` file inside the project (or a
  `.wrangler` folder if you use `npm run dev` instead).
- The server only talks to PharmaNET on your behalf — it never sends your
  data anywhere else.
- Excel template download, order parsing, FEFO batch splitting, Normal/
  Generic order submission — all identical to the deployed version.

## Document downloads

Invoice, Credit Note, Credit Note (Tax), Debit Note, Debit Note (Tax), Rate
Credit, and Rate Debit bulk downloads are all working and verified against
the live PharmaNET site.
