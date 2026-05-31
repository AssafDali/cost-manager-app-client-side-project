## 🚀 Live Demo & API

* **Live Application:** http://cost-manager-app-client-side-project-bkqr5w4ly.vercel.app
* **Remote JSON Rates API:**https://assafdali.github.io/cost-manager-rates-client-side-project/rates.json**

---

## 👥 Team Members


* **Loren Kricheli** - ID: 322632183
* **Hadar Gabay** - ID: 208837120 
* **Assaf Dali** - ID: 209006576 

---
# Cost Manager Application

A client-side cost-tracking web app built with React. All data is persisted in
the browser's `localStorage` through a small data-layer library (`db.js`).
Exchange rates are pulled from a remote endpoint via the Fetch API and cached
locally, so the app always works even when the network is offline.

The four supported currencies are **USD**, **ILS**, **GBP** and **EURO**.
USD is the default display currency.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 16 or newer (ships with `npm`).
- A modern desktop browser (the project is tested on Google Chrome).

---

## Run the app in development mode

From the project root:

```bash
npm install
npm start
```

This starts the React dev server. Open [http://localhost:3000](http://localhost:3000)
in Chrome to use the app.

The app opens its `localStorage` database automatically on load (name
`cost-manager`, version `1`) and fetches the default exchange rates from
`/rates.json` (served by the dev server out of the `public/` folder).
You can paste a custom rates-endpoint URL into the **System Settings** card
to override the default at any time.

---

## Build for production

```bash
npm run build
```

The optimised build is written to the `build/` folder and is ready to be
deployed to any static host (e.g. Render, Netlify, GitHub Pages).
After deployment, `<your-host>/rates.json` becomes the default rates source,
so the app works out of the box without the user having to enter a URL.

---

## Test the standalone `db.js` library

The vanilla version of the data-layer lives at the project root in `db.js`
and is the file submitted separately on Moodle. To verify it manually,
open `test-db.html` in Chrome and inspect the developer console — you
should see:

```
creating db succeeded
adding 1st cost item succeeded
adding 2nd cost item succeeded
600
```

The same `db.js` engine powers the React UI through the ES-module wrapper
at `src/db.js`, so the auto-test page and the React app always agree on
the data layout in `localStorage`.

---

## Project layout

```
.
├── db.js                 Vanilla data-layer (separate Moodle submission)
├── test-db.html          Standalone test page for the vanilla db.js
├── public/
│   ├── index.html
│   └── rates.json        Default exchange-rates feed
└── src/
    ├── db.js             ES-module data-layer (used by the React UI)
    ├── App.js            React UI
    ├── App.css
    └── index.js
```

---

## Useful npm scripts

| Command           | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm start`       | Run the dev server at `http://localhost:3000`     |
| `npm run build`   | Produce a minified production bundle in `build/`  |
| `npm test`        | Run the unit-test runner in interactive watch mode |
