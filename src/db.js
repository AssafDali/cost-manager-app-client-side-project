/* ============================================================================
 * src/db.js  (ES-module / React Version)
 * ----------------------------------------------------------------------------
 * This is the React-side data-layer for the Cost Manager application.
 * It mirrors, function-for-function, the vanilla data-layer that lives at
 * the project root in /db.js (which is the file submitted separately on
 * Moodle and consumed by the auto-test HTML page).
 *
 * Why two files instead of importing the vanilla one?
 *   Create-React-App's ModuleScopePlugin forbids `import`-ing modules
 *   that live outside of /src, so we cannot pull /db.js straight in.
 *   Instead, we keep two intentionally-parallel implementations, both
 *   small enough to be reviewed side-by-side and both backed by the
 *   exact same localStorage layout, so the auto-test HTML page and the
 *   React UI will always read/write compatible data.
 *
 * Public API (mirrors window.db in the vanilla file):
 *   openCostsDB(name, version)                   -> reference object
 *   addCost({ sum, currency, category, desc })   -> echoed cost item
 *   getReport(currency, year, month)             -> month report object
 *
 * Extras (used by the React UI):
 *   getAllCosts()
 *   getCategoryBreakdown(currency, year, month)
 *   getMonthlyTotals(currency, year)
 *   fetchExchangeRates(url)
 *   getExchangeRates() / setExchangeRates(rates)
 *   convert(sum, from, to)
 *   clearCosts()
 *
 * Storage layout (localStorage):
 *   "costmgr::<name>::v<version>" -> JSON array of cost items
 *   "costmgr::exchangeRates"      -> JSON of { USD, GBP, EURO, ILS }
 *
 * Currency math:
 *   Rates are expressed against 1 USD, exactly as the project doc states:
 *       { USD:1, GBP:0.6, EURO:0.7, ILS:3.4 }
 *   Conversion: usd = sum / rates[from];  result = usd * rates[to]
 * ========================================================================== */

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_RATES = { USD: 1, GBP: 0.6, EURO: 0.7, ILS: 3.4 };
const RATES_KEY = 'costmgr::exchangeRates';
const STORE_PREFIX = 'costmgr::';
const SUPPORTED_CURRENCIES = ['USD', 'GBP', 'EURO', 'ILS'];

/* ------------------------------------------------------------------ */
/* Module-private state - keeps track of the "active" database so     */
/* that the default-exported db object behaves like the global window */
/* db in the vanilla file (i.e. db.addCost works after openCostsDB).  */
/* ------------------------------------------------------------------ */

let activeName = 'costsdb';
let activeVersion = 1;
let activeKey = buildKey(activeName, activeVersion);

/* ------------------------------------------------------------------ */
/* Pure helpers                                                       */
/* ------------------------------------------------------------------ */

function buildKey(name, version) {
    return `${STORE_PREFIX}${String(name)}::v${Number(version)}`;
}

function getStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    // Tiny in-memory shim so unit tests run without a real DOM.
    if (!getStorage._mem) {
        const data = {};
        getStorage._mem = {
            getItem(k) {
                return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
            },
            setItem(k, v) { data[k] = String(v); },
            removeItem(k) { delete data[k]; }
        };
    }
    return getStorage._mem;
}

function readCosts(key) {
    try {
        const raw = getStorage().getItem(key);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        // Recover from a corrupted entry rather than crashing the UI.
        return [];
    }
}

function writeCosts(key, costs) {
    getStorage().setItem(key, JSON.stringify(costs));
}

function readRates() {
    try {
        const raw = getStorage().getItem(RATES_KEY);
        if (!raw) {
            return { ...DEFAULT_RATES };
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.USD === 'number') {
            return { ...DEFAULT_RATES, ...parsed };
        }
        return { ...DEFAULT_RATES };
    } catch (err) {
        return { ...DEFAULT_RATES };
    }
}

function writeRates(rates) {
    try {
        getStorage().setItem(RATES_KEY, JSON.stringify(rates));
    } catch (err) {
        // Quota or serialisation error: ignore so the calling code is
        // never forced to deal with a storage failure for caching.
    }
}

function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

/*
 * Convert an amount between two currencies given a rates table that is
 * expressed "per 1 USD". A missing rate returns the original amount so
 * the UI never silently zeroes out an expense due to a partial table.
 */
function convertWith(sum, fromCurrency, toCurrency, rates) {
    if (fromCurrency === toCurrency) {
        return sum;
    }
    const fromRate = rates[fromCurrency];
    const toRate = rates[toCurrency];
    if (typeof fromRate !== 'number' || typeof toRate !== 'number') {
        return sum;
    }
    return (sum / fromRate) * toRate;
}

/* ------------------------------------------------------------------ */
/* Core operations                                                    */
/* ------------------------------------------------------------------ */

function addCostInternal(key, cost) {
    if (!cost || typeof cost !== 'object') {
        throw new Error('addCost: argument must be an object');
    }
    const sum = toNumber(cost.sum, NaN);
    if (!Number.isFinite(sum)) {
        throw new Error('addCost: "sum" must be a number');
    }

    const itemDate = cost.date ? new Date(cost.date) : new Date();
    
    const record = {
        sum,
        currency: String(cost.currency || 'USD'),
        category: String(cost.category || 'General'),
        description: String(cost.description === null || cost.description === undefined ? '' : cost.description),
        date: {
            day: itemDate.getDate(),
            month: itemDate.getMonth() + 1,
            year: itemDate.getFullYear()
        }
    };

    const costs = readCosts(key);
    costs.push(record);
    writeCosts(key, costs);

    // Per spec, addCost returns these four properties only.
    return {
        sum: record.sum,
        currency: record.currency,
        category: record.category,
        description: record.description
    };
}

function getReportInternal(key, currency, year, month) {
    const now = new Date();
    const resolvedYear = toNumber(year, now.getFullYear());
    const resolvedMonth = toNumber(month, now.getMonth() + 1);
    const targetCurrency = (typeof currency === 'string' && currency)
        ? currency
        : 'USD';

    const rates = readRates();
    const all = readCosts(key);

    const monthCosts = all.filter((c) => (
        c
        && c.date
        && Number(c.date.year) === resolvedYear
        && Number(c.date.month) === resolvedMonth
    ));

    let totalSum = 0;
    const costs = monthCosts.map((c) => {
        totalSum += convertWith(c.sum, c.currency, targetCurrency, rates);
        return {
            sum: c.sum,
            currency: c.currency,
            category: c.category,
            description: c.description,
            date: { day: c.date.day }
        };
    });

    return {
        year: resolvedYear,
        month: resolvedMonth,
        costs,
        total: { currency: targetCurrency, sum: round2(totalSum) }
    };
}

function getCategoryBreakdownInternal(key, currency, year, month) {
    const report = getReportInternal(key, currency, year, month);
    const rates = readRates();
    const totals = {};
    report.costs.forEach((c) => {
        const converted = convertWith(c.sum, c.currency, report.total.currency, rates);
        totals[c.category] = round2((totals[c.category] || 0) + converted);
    });
    return totals;
}

function getMonthlyTotalsInternal(key, currency, year) {
    const now = new Date();
    const resolvedYear = toNumber(year, now.getFullYear());
    const targetCurrency = (typeof currency === 'string' && currency)
        ? currency
        : 'USD';

    const rates = readRates();
    const all = readCosts(key);

    const totals = new Array(12).fill(0);
    all.forEach((c) => {
        if (c && c.date && Number(c.date.year) === resolvedYear) {
            const idx = Number(c.date.month) - 1;
            if (idx >= 0 && idx < 12) {
                totals[idx] += convertWith(c.sum, c.currency, targetCurrency, rates);
            }
        }
    });

    return totals.map(round2);
}

/* ------------------------------------------------------------------ */
/* Exchange rate fetching (Fetch API)                                 */
/* ------------------------------------------------------------------ */

/*
 * Fetch and cache the exchange rates from a URL. The endpoint is
 * expected to return JSON of the shape
 *     { "USD":1, "GBP":0.6, "EURO":0.7, "ILS":3.4 }
 * but JSONBin-style envelopes ({ record: { ... } }) are also accepted.
 *
 * Any missing currency in the response is filled in from the defaults
 * so we never end up with an undefined rate at conversion time.
 */
async function fetchExchangeRatesInternal(url) {
    if (typeof fetch !== 'function') {
        throw new Error('Fetch API is not available in this environment');
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Rates request failed: ${response.status}`);
    }
    const payload = await response.json();
    let rates = null;

    if (payload && typeof payload.USD === 'number') {
        rates = payload;
    } else if (payload && payload.record && typeof payload.record.USD === 'number') {
        rates = payload.record;
    }

    if (!rates) {
        throw new Error('Rates response has an unexpected shape');
    }

    SUPPORTED_CURRENCIES.forEach((cur) => {
        if (typeof rates[cur] !== 'number') {
            rates[cur] = DEFAULT_RATES[cur];
        }
    });

    writeRates(rates);
    return rates;
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

/*
 * Open or initialise a costs database. Returns a reference object whose
 * methods are pre-bound to this particular store, exactly as the project
 * specification requires.
 */
export function openCostsDB(databaseName, databaseVersion) {
    activeName = String(databaseName == null ? 'costsdb' : databaseName);
    activeVersion = Number(databaseVersion == null ? 1 : databaseVersion);
    activeKey = buildKey(activeName, activeVersion);

    if (getStorage().getItem(activeKey) === null) {
        writeCosts(activeKey, []);
    }

    const key = activeKey;
    return {
        name: activeName,
        version: activeVersion,
        addCost: (cost) => addCostInternal(key, cost),
        getReport: (currency, year, month) => getReportInternal(key, currency, year, month),
        getAllCosts: () => readCosts(key),
        getCategoryBreakdown: (currency, year, month) => (
            getCategoryBreakdownInternal(key, currency, year, month)
        ),
        getMonthlyTotals: (currency, year) => getMonthlyTotalsInternal(key, currency, year),
        clearCosts: () => writeCosts(key, [])
    };
}

export function addCost(cost) {
    return addCostInternal(activeKey, cost);
}

export function getReport(currency, year, month) {
    return getReportInternal(activeKey, currency, year, month);
}

export function getAllCosts() {
    return readCosts(activeKey);
}

export function getCategoryBreakdown(currency, year, month) {
    return getCategoryBreakdownInternal(activeKey, currency, year, month);
}

export function getMonthlyTotals(currency, year) {
    return getMonthlyTotalsInternal(activeKey, currency, year);
}

export function clearCosts() {
    writeCosts(activeKey, []);
}

export function fetchExchangeRates(url) {
    return fetchExchangeRatesInternal(url);
}

export function setExchangeRates(rates) {
    if (rates && typeof rates.USD === 'number') {
        writeRates(rates);
    }
}

export function getExchangeRates() {
    return readRates();
}

export function convert(sum, fromCurrency, toCurrency) {
    return convertWith(sum, fromCurrency, toCurrency, readRates());
}

/*
 * Default export mirrors the global `db` object exposed by the vanilla
 * file. Consumers can write `import db from './db'` and call
 * db.openCostsDB(...) / db.addCost(...) / db.getReport(...).
 */
const db = {
    openCostsDB,
    addCost,
    getReport,
    getAllCosts,
    getCategoryBreakdown,
    getMonthlyTotals,
    clearCosts,
    fetchExchangeRates,
    setExchangeRates,
    getExchangeRates,
    convert
};

export default db;
