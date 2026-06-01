/* ============================================================================
 * src/db.js  (ES-Module / React Version)
 * ----------------------------------------------------------------------------
 * Cost Manager - Local Storage data layer.
 * ========================================================================== */

const defaultRates = { USD: 1, GBP: 0.6, EURO: 0.7, ILS: 3.4 };
const ratesKey = 'costmgr::exchangeRates';
const storePrefix = 'costmgr::';
const supportedCurrencies = ['USD', 'GBP', 'EURO', 'ILS'];

let activeName = 'costsdb';
let activeVersion = 1;
let activeKey = buildKey(activeName, activeVersion);

function buildKey(name, version) {
    return `${storePrefix}${String(name)}::v${Number(version)}`;
}

function getStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
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
        return [];
    }
}

function writeCosts(key, costs) {
    getStorage().setItem(key, JSON.stringify(costs));
}

function readRates() {
    try {
        const raw = getStorage().getItem(ratesKey);
        if (!raw) {
            return { ...defaultRates };
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.USD === 'number') {
            return { ...defaultRates, ...parsed };
        }
        return { ...defaultRates };
    } catch (err) {
        return { ...defaultRates };
    }
}

function writeRates(rates) {
    try {
        getStorage().setItem(ratesKey, JSON.stringify(rates));
    } catch (err) {
        // Ignore storage error
    }
}

function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

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
    const targetCurrency = (typeof currency === 'string' && currency) ? currency : 'USD';

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
    const targetCurrency = (typeof currency === 'string' && currency) ? currency : 'USD';

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

    supportedCurrencies.forEach((cur) => {
        if (typeof rates[cur] !== 'number') {
            rates[cur] = defaultRates[cur];
        }
    });

    writeRates(rates);
    return rates;
}

export function openCostsDB(databaseName, databaseVersion) {
    activeName = String(databaseName === null || databaseName === undefined ? 'costsdb' : databaseName);
    activeVersion = Number(databaseVersion === null || databaseVersion === undefined ? 1 : databaseVersion);
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

export function addCost(cost) { return addCostInternal(activeKey, cost); }
export function getReport(currency, year, month) { return getReportInternal(activeKey, currency, year, month); }
export function getAllCosts() { return readCosts(activeKey); }
export function getCategoryBreakdown(currency, year, month) { return getCategoryBreakdownInternal(activeKey, currency, year, month); }
export function getMonthlyTotals(currency, year) { return getMonthlyTotalsInternal(activeKey, currency, year); }
export function clearCosts() { writeCosts(activeKey, []); }
export function fetchExchangeRates(url) { return fetchExchangeRatesInternal(url); }
export function setExchangeRates(rates) {
    if (rates && typeof rates.USD === 'number') {
        writeRates(rates);
    }
}
export function getExchangeRates() { return readRates(); }
export function convert(sum, fromCurrency, toCurrency) {
    return convertWith(sum, fromCurrency, toCurrency, readRates());
}

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