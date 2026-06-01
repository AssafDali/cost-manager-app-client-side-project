/* ============================================================================
 * db.js  (Vanilla Version)
 * ----------------------------------------------------------------------------
 * Cost Manager - Local Storage data layer.
 * ========================================================================== */

(function (global) {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Constants                                                          */
    /* ------------------------------------------------------------------ */

    const defaultRates = { USD: 1, GBP: 0.6, EURO: 0.7, ILS: 3.4 };
    const ratesKey = 'costmgr::exchangeRates';
    const storePrefix = 'costmgr::';

    /* ------------------------------------------------------------------ */
    /* Internal state                                                     */
    /* ------------------------------------------------------------------ */

    let activeName = 'costsdb';
    let activeVersion = 1;
    let activeKey = buildKey(activeName, activeVersion);

    /* ------------------------------------------------------------------ */
    /* Pure helpers                                                       */
    /* ------------------------------------------------------------------ */

    function buildKey(name, version) {
        return storePrefix + String(name) + '::v' + Number(version);
    }

    function safeStorage() {
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
            const raw = safeStorage().getItem(key);
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
        safeStorage().setItem(key, JSON.stringify(costs));
    }

    function readRates() {
        try {
            const raw = safeStorage().getItem(ratesKey);
            if (!raw) {
                return defaultRates;
            }
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.USD === 'number') {
                return parsed;
            }
            return defaultRates;
        } catch (err) {
            return defaultRates;
        }
    }

    function writeRates(rates) {
        try {
            safeStorage().setItem(ratesKey, JSON.stringify(rates));
        } catch (err) {
            // Ignore storage failure
        }
    }

    function convert(sum, fromCurrency, toCurrency, rates) {
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

    function toNumber(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
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
            sum: sum,
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
        const targetCurrency = typeof currency === 'string' && currency ? currency : 'USD';

        const rates = readRates();
        const allCosts = readCosts(key);

        const monthCosts = allCosts.filter(function (c) {
            return c
                && c.date
                && Number(c.date.year) === resolvedYear
                && Number(c.date.month) === resolvedMonth;
        });

        let totalSum = 0;
        const costs = monthCosts.map(function (c) {
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
        const report = getReportInternal(key, currency, year, month);
        const rates = readRates();
        const totals = {};
        report.costs.forEach(function (c) {
            const converted = convert(c.sum, c.currency, report.total.currency, rates);
            totals[c.category] = round2((totals[c.category] || 0) + converted);
        });
        return totals;
    }

    function getMonthlyTotalsInternal(key, currency, year) {
        const now = new Date();
        const resolvedYear = toNumber(year, now.getFullYear());
        const targetCurrency = typeof currency === 'string' && currency ? currency : 'USD';

        const rates = readRates();
        const allCosts = readCosts(key);

        const totals = new Array(12);
        for (let i = 0; i < 12; i += 1) {
            totals[i] = 0;
        }

        allCosts.forEach(function (c) {
            if (c && c.date && Number(c.date.year) === resolvedYear) {
                const idx = Number(c.date.month) - 1;
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
                const rates = (payload && typeof payload.USD === 'number')
                    ? payload
                    : (payload && payload.record ? payload.record : null);

                if (!rates || typeof rates.USD !== 'number') {
                    throw new Error('Rates response has an unexpected shape');
                }

                ['USD', 'GBP', 'EURO', 'ILS'].forEach(function (cur) {
                    if (typeof rates[cur] !== 'number') {
                        rates[cur] = defaultRates[cur];
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

    const db = {
        openCostsDB: function (databaseName, databaseVersion) {
            activeName = String(databaseName === null || databaseName === undefined ? 'costsdb' : databaseName);
            activeVersion = Number(databaseVersion === null || databaseVersion === undefined ? 1 : databaseVersion);
            activeKey = buildKey(activeName, activeVersion);

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

        convert: function (sum, fromCurrency, toCurrency) {
            return convert(sum, fromCurrency, toCurrency, readRates());
        }
    };

    global.db = db;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = db;
    }
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));