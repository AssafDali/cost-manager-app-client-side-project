import React, { useState, useEffect, useCallback, useMemo } from 'react';
import db from './db';
import './App.css';

const DEFAULT_RATES_URL = `${process.env.PUBLIC_URL || ''}/rates.json`;
const costsDB = db.openCostsDB('cost-manager', 1);

function App() {
    // ------------------------------------------------------------------------
    // 1. Set the browser tab title (Tab Title) for this assignment
    // ------------------------------------------------------------------------
    useEffect(() => {
        document.title = 'Cost Manager';
    }, []);

    // ------------------------------------------------------------------------
    // 2. Application state declarations
    // ------------------------------------------------------------------------
    const [costs, setCosts] = useState(() => costsDB.getAllCosts());
    const [exchangeRates, setExchangeRates] = useState(() => db.getExchangeRates());
    const [ratesUrl, setRatesUrl] = useState(DEFAULT_RATES_URL);
    const [settingsUrlInput, setSettingsUrlInput] = useState('');

    const today = useMemo(() => new Date(), []);
    const [targetCurrency, setTargetCurrency] = useState('USD');
    const [filterYear, setFilterYear] = useState(today.getFullYear());
    const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);

    const [formSum, setFormSum] = useState('');
    const [formCurrency, setFormCurrency] = useState('USD');
    const [formCategory, setFormCategory] = useState('Food');
    const [formDescription, setFormDescription] = useState('');

    const [statusMessage, setStatusMessage] = useState('');

    // ------------------------------------------------------------------------
    // 3. Fetch helper for pulling exchange rates from the remote server
    // ------------------------------------------------------------------------
    const reloadCosts = useCallback(() => {
        setCosts(costsDB.getAllCosts());
    }, []);

    const loadRates = useCallback(async (urlToFetch) => {
        try {
            setStatusMessage('Fetching exchange rates...');
            const fresh = await db.fetchExchangeRates(urlToFetch);
            setExchangeRates(fresh);
            setStatusMessage('Rates updated successfully from server!');
        } catch (error) {
            // Soft fallback - use the rates cached in localStorage or the defaults
            setExchangeRates(db.getExchangeRates());
            setStatusMessage('Failed to fetch rates. Using cached/default rates.');
        }
    }, []);

    useEffect(() => {
        loadRates(DEFAULT_RATES_URL);
    }, [loadRates]);

    // ------------------------------------------------------------------------
    // 4. Real dynamic currency-conversion logic (driven by server rates)
    //    The conversion itself lives in db.js (db.convert) so the entire
    //    codebase works against a single source of truth.
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // 5. Event handler functions
    // ------------------------------------------------------------------------
    const handleAddCostSubmit = (e) => {
        e.preventDefault();
        const numericSum = Number(formSum);
        if (!formSum || Number.isNaN(numericSum) || numericSum <= 0) {
            alert('Please enter a valid positive number.');
            return;
        }

        try {
            costsDB.addCost({
                sum: numericSum,
                currency: formCurrency,
                category: formCategory,
                description: formDescription
            });
            reloadCosts();
            setFormSum('');
            setFormDescription('');
            setStatusMessage('Cost item added successfully!');
        } catch (err) {
            setStatusMessage(`Could not save cost: ${err.message}`);
        }
    };

    const handleSettingsSubmit = (e) => {
        e.preventDefault();
        const trimmed = settingsUrlInput.trim();
        if (trimmed !== '') {
            setRatesUrl(trimmed);
            loadRates(trimmed);
        }
    };

    // ------------------------------------------------------------------------
    // 6. Processing and computing the real numbers powering the reports and
    //    charts (the core math layer)
    // ------------------------------------------------------------------------
    // a. Filter items for the selected month/year for the report + compute the
    //    dynamic total in the selected target currency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const report = useMemo(
        () => costsDB.getReport(targetCurrency, Number(filterYear), Number(filterMonth)),
        [targetCurrency, filterYear, filterMonth, costs, exchangeRates]
    );

    // b. Compute the pie-chart breakdown by category
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const categoryTotals = useMemo(
        () => costsDB.getCategoryBreakdown(
            targetCurrency,
            Number(filterYear),
            Number(filterMonth)
        ),
        [targetCurrency, filterYear, filterMonth, costs, exchangeRates]
    );

    // c. Compute the real annual bar-chart values for all 12 months
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const monthlyTotalsForYear = useMemo(
        () => costsDB.getMonthlyTotals(targetCurrency, Number(filterYear)),
        [targetCurrency, filterYear, costs, exchangeRates]
    );

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const maxMonthlyValue = Math.max(...monthlyTotalsForYear, 1);

    const reportTotalSum = report.total.sum;
    const filteredCostsForReport = report.costs;

    return (
        <div className="app-container">
            <header className="main-header">
                <h1>Cost Manager Application</h1>
                <p className="subtitle">Track, convert, and visualize desktop expenses seamlessly</p>
            </header>

            {statusMessage && (
                <div className="status-banner-container">
                    <div className="status-banner">{statusMessage}</div>
                </div>
            )}

            <div className="grid-layout">

                {/* Add-cost form - the only emoji we kept */}
                <section className="card">
                    <h2>➕ Add New Cost Item</h2>
                    <form onSubmit={handleAddCostSubmit}>
                        <div className="form-group">
                            <label>Sum / Amount:</label>
                            <input
                                type="number"
                                step="any"
                                value={formSum}
                                onChange={(e) => setFormSum(e.target.value)}
                                placeholder="e.g. 45.50"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Currency:</label>
                            <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)}>
                                <option value="USD">USD ($)</option>
                                <option value="ILS">ILS (₪)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="EURO">EURO (€)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Category:</label>
                            <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                                <option value="Food">Food</option>
                                <option value="Car">Car</option>
                                <option value="Utilities">Utilities</option>
                                <option value="Education">Education</option>
                                <option value="Entertainment">Entertainment</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Description:</label>
                            <input
                                type="text"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="e.g. Weekly grocery shopping"
                                required
                            />
                        </div>

                        <button type="submit" className="btn-primary">Save Cost Item</button>
                    </form>
                </section>

                {/* Upgraded system-settings panel, aligned with Flexbox */}
                <section className="card">
                    <h2>System Settings</h2>
                    <p className="settings-explanation">
                        Configure a custom remote endpoint to update currency conversion rates dynamically.
                        The system automatically falls back to default settings if left blank.
                    </p>
                    <form onSubmit={handleSettingsSubmit}>
                        <div className="url-input-row">
                            <div className="form-group">
                                <label>Currency Server URL Endpoint:</label>
                                <input
                                    type="url"
                                    value={settingsUrlInput}
                                    onChange={(e) => setSettingsUrlInput(e.target.value)}
                                    placeholder="https://your-server.com/rates"
                                />
                            </div>
                            <button type="submit">Update URL</button>
                        </div>
                        <small className="help-text" style={{ display: 'block', marginTop: '10px' }}>
                            Active Source: <code className="url-code">{ratesUrl}</code>
                        </small>
                    </form>

                    <div className="rates-display-box">
                        <h4>Live Rates Against 1 USD:</h4>
                        <ul>
                            <li>USD: {exchangeRates.USD}</li>
                            <li>ILS: {exchangeRates.ILS}</li>
                            <li>GBP: {exchangeRates.GBP}</li>
                            <li>EURO: {exchangeRates.EURO}</li>
                        </ul>
                    </div>
                </section>

                {/* Filter / control bar */}
                <section className="card full-width-card filter-bar">
                    <h2>Report & Chart Control Filters</h2>
                    <div className="filter-inputs">
                        <div className="form-group">
                            <label>Target Display Currency:</label>
                            <select value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value)}>
                                <option value="USD">USD ($)</option>
                                <option value="ILS">ILS (₪)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="EURO">EURO (€)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Select Year:</label>
                            <input
                                type="number"
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Select Month:</label>
                            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                                {monthNames.map((name, index) => (
                                    <option key={index + 1} value={index + 1}>{name} ({index + 1})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Detailed monthly report */}
                <section className="card full-width-card">
                    <h2>Detailed Report for {filterMonth}/{filterYear} (In {targetCurrency})</h2>
                    <div className="table-responsive">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Category</th>
                                    <th>Original Cost</th>
                                    <th>Converted Cost ({targetCurrency})</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCostsForReport.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="no-data">No expense records found for this specific period.</td>
                                    </tr>
                                ) : (
                                    filteredCostsForReport.map((cost, idx) => (
                                        <tr key={idx}>
                                            <td>{cost.date.day}/{filterMonth}/{filterYear}</td>
                                            <td>{cost.description}</td>
                                            <td><span className={`badge badge-${cost.category.toLowerCase()}`}>{cost.category}</span></td>
                                            <td>{cost.sum} {cost.currency}</td>
                                            <td className="converted-sum">
                                                {db.convert(cost.sum, cost.currency, targetCurrency).toFixed(2)} {targetCurrency}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="report-total-footer">
                        <h3>Total Monthly Expenses</h3>
                        <span className="total-highlight">{reportTotalSum.toFixed(2)} {targetCurrency}</span>
                    </div>
                </section>

                {/* Minimalist pie chart with custom palette */}
                <section className="card">
                    <h2>Category Breakdown</h2>
                    <p className="chart-info">Visual distribution of expenses in {targetCurrency}</p>
                    <div className="pie-chart-container">
                        {Object.keys(categoryTotals).length === 0 ? (
                            <p className="no-data">Add data to generate pie breakdown.</p>
                        ) : (
                            <div className="mock-pie-visual">
                                {Object.entries(categoryTotals).map(([category, sum], idx) => {
                                    const percentage = reportTotalSum > 0
                                        ? ((sum / reportTotalSum) * 100).toFixed(1)
                                        : '0.0';
                                    return (
                                        <div key={idx} className="pie-slice-row">
                                            <span
                                                className="color-indicator"
                                                style={{ backgroundColor: `var(--color-${category.toLowerCase()})` }}
                                            />
                                            <strong className="slice-label" style={{ flex: 1 }}>{category}</strong>
                                            <span className="converted-sum">{sum.toFixed(2)} {targetCurrency}</span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: '10px' }}>({percentage}%)</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* Tangible annual capsule-style bar chart with a minimum-height guard */}
                <section className="card">
                    <h2>Annual Bar Chart</h2>
                    <p className="chart-info">Total continuous layout across months in {targetCurrency}</p>
                    <div className="bar-chart-container">
                        <div className="mock-bar-graph">
                            {monthlyTotalsForYear.map((monthlySum, index) => {
                                // Percentage-based height with a 3% floor so the bar always stays visible
                                const barHeightPercentage = monthlySum > 0
                                    ? (monthlySum / maxMonthlyValue) * 100
                                    : 3;
                                return (
                                    <div className="bar-column" key={index}>
                                        <div className="bar-value-tooltip">{monthlySum > 0 ? `${monthlySum.toFixed(0)}` : '0'}</div>
                                        <div
                                            className="bar-fill"
                                            style={{ height: `${barHeightPercentage}%` }}
                                        />
                                        <div className="bar-label">{monthNames[index]}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}

export default App;
