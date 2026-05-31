/* ============================================================================
 * db.js  (Vanilla Version)
 * ----------------------------------------------------------------------------
 * Cost Manager - Local Storage data layer.
 *
 * This file is the engine of the application. It wraps the browser's
 * localStorage and exposes a small, well defined API on the global object
 * (window.db) so it can be consumed both from a plain HTML page (for the
 * automatic test described in the project spec) and from the React UI via
 * a thin ES-module wrapper (src/db.js).
 *
 * Public API (attached to the global "db" object):
 *   - openCostsDB(databaseName, databaseVersion)
 *       Opens (or initialises) a costs store and returns a reference to it.
 *
 *   - addCost(cost)
 *       Adds { sum, currency, category, description } to the active store.
 *       The cost's date is set automatically to "today".
 *
 *   - getReport(currency, year, month)
 *       Returns a detailed report for the given month/year, expressed in
 *       the requested target currency. Year and month default to "now".
 *
 * Extra helpers (used by the React UI; not required by the spec but
 * documented here for clarity):
 *
 *   - getAllCosts()                              raw cost items
 *   - getCategoryBreakdown(currency, y, m)       totals per category
 *   - getMonthlyTotals(currency, year)           array of 12 totals
 *   - fetchExchangeRates(url)                    Fetch API + cache to LS
 *   - setExchangeRates(rates) / getExchangeRates()
 *   - clearCosts()                               wipe the active store
 *
 * Currency model:
 *   The four supported currencies are USD, ILS, GBP, EURO. Exchange rates
 *   are expressed against 1 USD, exactly as required by the project doc:
 *       { "USD":1, "GBP":0.6, "EURO":0.7, "ILS":3.4 }
 *   meaning that 0.6 GBP, 0.7 EURO and 3.4 ILS are each equivalent to 1 USD.
 * ========================================================================== */

(function (global) {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Constants                                                          */
    /* ------------------------------------------------------------------ */

    // Default exchange rates - used as a safety net when no rates have been
    // fetched yet. The application is required to keep working even before
    // any rates have come back from the server.
    var DEFAULT_RATES = { USD: 1, GBP: 0.6, EURO: 0.7, ILS: 3.4 };

    // localStorage key used to cache the exchange rates between sessions.
    var RATES_KEY = 'costmgr::exchangeRates';

    // Prefix used by every per-database localStorage entry so that several
    // logical databases (different name/version pairs) can coexist safely.
    var STORE_PREFIX = 'costmgr::';

    /* ------------------------------------------------------------------ */
    /* Internal state                                                     */
    /* ------------------------------------------------------------------ */

    // The "active" database key. openCostsDB updates these so that
    // db.addCost / db.getReport (called on the global db) target the same
    // store as the object returned by openCostsDB.
    var activeName = 'costsdb';
    var activeVersion = 1;
    var activeKey = buildKey(activeName, activeVersion);

    /* ------------------------------------------------------------------ */
    /* Pure helpers                                                       */
    /* ------------------------------------------------------------------ */

    function buildKey(name, version) {
        return STORE_PREFIX + String(name) + '::v' + Number(version);
    }

    function safeStorage() {
        // Some test runners can call this before window.localStorage exists;
        // we fall back to a tiny in-memory shim so the API never throws.
        if (global && global.localStorage) {
            return global.localStorage;
        }
        if (!safeStorage._mem) {
            safeStorage._mem = {
                _data: {},
                getItem: function (k) {
                    return Object.prototype.hasOwnProperty.call(this._data, k)
                        ? this._data[k]
                        : null;
                },
                setItem: function (k, v) { this._data[k] = String(v); },
                removeItem: function (k) { delete this._data[k]; }
            };
        }
        return safeStorage._mem;
    }

    function readCosts(key) {
        try {
            var raw = safeStorage().getItem(key);
            if (!raw) {
                return [];
            }
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            // If somebody manually corrupted the entry, recover gracefully
            // by treating the store as empty rather than crashing the app.
            return [];
        }
    }

    function writeCosts(key, costs) {
        safeStorage().setItem(key, JSON.stringify(costs));
    }

    function readRates() {
        try {
            var raw = safeStorage().getItem(RATES_KEY);
            if (!raw) {
                return DEFAULT_RATES;
            }
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed.USD === 'number') {
                return parsed;
            }
            return DEFAULT_RATES;
        } catch (err) {
            return DEFAULT_RATES;
        }
    }

    function writeRates(rates) {
        try {
            safeStorage().setItem(RATES_KEY, JSON.stringify(rates));
        } catch (err) {
            // Quota or serialisation error: ignore so the calling code is
            // never forced to deal with a storage failure for caching.
        }
    }

    /*
     * Convert an amount from one currency to another using rates expressed
     * "per 1 USD". The math:
     *     amount_in_usd    = sum / rates[fromCurrency]
     *     amount_in_target = amount_in_usd * rates[toCurrency]
     */
    function convert(sum, fromCurrency, toCurrency, rates) {
        if (fromCurrency === toCurrency) {
            return sum;
        }
        var fromRate = rates[fromCurrency];
        var toRate = rates[toCurrency];
        if (typeof fromRate !== 'number' || typeof toRate !== 'number') {
            // Unknown currency: return the original amount untouched so a
            // missing rate never silently zeroes out an expense.
            return sum;
        }
        return (sum / fromRate) * toRate;
    }

    /*
     * Coerce an unknown value to a finite number, returning a fallback
     * if the coercion fails. Used to harden addCost against bad input.
     */
    function toNumber(value, fallback) {
        var n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    /* ------------------------------------------------------------------ */
    /* Core operations                                                    */
    /* ------------------------------------------------------------------ */

    function addCostInternal(key, cost) {
        if (!cost || typeof cost !== 'object') {
            throw new Error('addCost: argument must be an object');
        }

        var sum = toNumber(cost.sum, NaN);
        if (!Number.isFinite(sum)) {
            throw new Error('addCost: "sum" must be a number');
        }

        var today = new Date();
        var record = {
            sum: sum,
            currency: String(cost.currency || 'USD'),
            category: String(cost.category || 'General'),
            description: String(cost.description == null ? '' : cost.description),
            date: {
                day: today.getDate(),
                month: today.getMonth() + 1,
                year: today.getFullYear()
            }
        };

        var costs = readCosts(key);
        costs.push(record);
        writeCosts(key, costs);

        // Per spec, the value returned by addCost has these four properties.
        return {
            sum: record.sum,
            currency: record.currency,
            category: record.category,
            description: record.description
        };
    }

    function getReportInternal(key, currency, year, month) {
        var now = new Date();
        var resolvedYear = toNumber(year, now.getFullYear());
        var resolvedMonth = toNumber(month, now.getMonth() + 1);
        var targetCurrency = typeof currency === 'string' && currency
            ? currency
            : 'USD';

        var rates = readRates();
        var allCosts = readCosts(key);

        var monthCosts = allCosts.filter(function (c) {
            return c
                && c.date
                && Number(c.date.year) === resolvedYear
                && Number(c.date.month) === resolvedMonth;
        });

        var totalSum = 0;
        var costs = monthCosts.map(function (c) {
            totalSum += convert(c.sum, c.currency, targetCurrency, rates);
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
            costs: costs,
            // Round to 2 decimals so the report is presentation-friendly
            // without losing precision in the underlying stored values.
            total: { currency: targetCurrency, sum: round2(totalSum) }
        };
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    /* ------------------------------------------------------------------ */
    /* Extra calculation helpers used by the UI                           */
    /* ------------------------------------------------------------------ */

    function getCategoryBreakdownInternal(key, currency, year, month) {
        var report = getReportInternal(key, currency, year, month);
        var rates = readRates();
        var totals = {};
        report.costs.forEach(function (c) {
            var converted = convert(c.sum, c.currency, report.total.currency, rates);
            totals[c.category] = round2((totals[c.category] || 0) + converted);
        });
        return totals;
    }

    function getMonthlyTotalsInternal(key, currency, year) {
        var now = new Date();
        var resolvedYear = toNumber(year, now.getFullYear());
        var targetCurrency = typeof currency === 'string' && currency
            ? currency
            : 'USD';

        var rates = readRates();
        var allCosts = readCosts(key);

        var totals = new Array(12);
        for (var i = 0; i < 12; i += 1) {
            totals[i] = 0;
        }

        allCosts.forEach(function (c) {
            if (c && c.date && Number(c.date.year) === resolvedYear) {
                var idx = Number(c.date.month) - 1;
                if (idx >= 0 && idx < 12) {
                    totals[idx] += convert(c.sum, c.currency, targetCurrency, rates);
                }
            }
        });

        return totals.map(round2);
    }

    /* ------------------------------------------------------------------ */
    /* Exchange rate fetching (Fetch API)                                 */
    /* ------------------------------------------------------------------ */

    /*
     * Fetch the exchange rates JSON from the supplied URL and cache the
     * result in localStorage. Resolves with the rates object on success.
     *
     * The endpoint is expected to return a JSON of the shape:
     *     { "USD":1, "GBP":0.6, "EURO":0.7, "ILS":3.4 }
     * Some hosting providers (e.g. JSONBin) wrap the payload inside a
     * "record" property; we transparently unwrap that case as well.
     */
    function fetchExchangeRatesInternal(url) {
        if (!global.fetch) {
            return Promise.reject(new Error('Fetch API is not available'));
        }
        return global.fetch(url)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Rates request failed: ' + response.status);
                }
                return response.json();
            })
            .then(function (payload) {
                var rates = (payload && typeof payload.USD === 'number')
                    ? payload
                    : (payload && payload.record ? payload.record : null);

                if (!rates || typeof rates.USD !== 'number') {
                    throw new Error('Rates response has an unexpected shape');
                }

                // Make sure all four supported currencies are present so
                // downstream conversions never see "undefined" rates.
                ['USD', 'GBP', 'EURO', 'ILS'].forEach(function (cur) {
                    if (typeof rates[cur] !== 'number') {
                        rates[cur] = DEFAULT_RATES[cur];
                    }
                });

                writeRates(rates);
                return rates;
            });
    }

    /* ------------------------------------------------------------------ */
    /* Database reference object returned by openCostsDB                  */
    /* ------------------------------------------------------------------ */

    function buildDbRef(name, version, key) {
        return {
            name: String(name),
            version: Number(version),

            addCost: function (cost) {
                return addCostInternal(key, cost);
            },

            getReport: function (currency, year, month) {
                return getReportInternal(key, currency, year, month);
            },

            getAllCosts: function () {
                return readCosts(key);
            },

            getCategoryBreakdown: function (currency, year, month) {
                return getCategoryBreakdownInternal(key, currency, year, month);
            },

            getMonthlyTotals: function (currency, year) {
                return getMonthlyTotalsInternal(key, currency, year);
            },

            clearCosts: function () {
                writeCosts(key, []);
            }
        };
    }

    /* ------------------------------------------------------------------ */
    /* The "db" object exposed to the global scope                        */
    /* ------------------------------------------------------------------ */

    var db = {
        openCostsDB: function (databaseName, databaseVersion) {
            activeName = String(databaseName == null ? 'costsdb' : databaseName);
            activeVersion = Number(databaseVersion == null ? 1 : databaseVersion);
            activeKey = buildKey(activeName, activeVersion);

            // Make sure a fresh logical database has a backing entry so
            // subsequent reads return [] rather than null.
            if (safeStorage().getItem(activeKey) === null) {
                writeCosts(activeKey, []);
            }
            return buildDbRef(activeName, activeVersion, activeKey);
        },

        addCost: function (cost) {
            return addCostInternal(activeKey, cost);
        },

        getReport: function (currency, year, month) {
            return getReportInternal(activeKey, currency, year, month);
        },

        getAllCosts: function () {
            return readCosts(activeKey);
        },

        getCategoryBreakdown: function (currency, year, month) {
            return getCategoryBreakdownInternal(activeKey, currency, year, month);
        },

        getMonthlyTotals: function (currency, year) {
            return getMonthlyTotalsInternal(activeKey, currency, year);
        },

        clearCosts: function () {
            writeCosts(activeKey, []);
        },

        fetchExchangeRates: function (url) {
            return fetchExchangeRatesInternal(url);
        },

        setExchangeRates: function (rates) {
            if (rates && typeof rates.USD === 'number') {
                writeRates(rates);
            }
        },

        getExchangeRates: function () {
            return readRates();
        },

        // Conversion helper kept on the public API for the UI to reuse,
        // so the report table and the charts share the exact same math.
        convert: function (sum, fromCurrency, toCurrency) {
            return convert(sum, fromCurrency, toCurrency, readRates());
        }
    };

    // Expose to the global object so `<script src="db.js"></script>` is
    // enough to make `db.openCostsDB(...)` available from any page.
    global.db = db;

    // Also support CommonJS / Node-style require, which is handy for the
    // ES-module wrapper at src/db.js to share this exact implementation.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = db;
    }
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
