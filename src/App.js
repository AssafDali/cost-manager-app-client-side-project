// Force brand new Vercel build - v1.0
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import db from './db';
import './App.css';

// Importing your professional chart components
import CostsPieChart from './comp/CostsPieChart';
import CostsBarChart from './comp/CostsBarChart';

const DEFAULT_RATES_URL = `${process.env.PUBLIC_URL || ''}/rates.json`;
const costsDB = db.openCostsDB('cost-manager', 1);

export default function App() {
    useEffect(() => {
        document.title = 'Cost Manager';
    }, []);

    const [costs, setCosts] = useState(() => costsDB.getAllCosts());
    const [exchangeRates, setExchangeRates] = useState(() => db.getExchangeRates());
    const [ratesUrl, setRatesUrl] = useState(DEFAULT_RATES_URL);
    const [settingsUrlInput, setSettingsUrlInput] = useState('');

    const today = useMemo(() => new Date(), []);
    const [targetCurrency, setTargetCurrency] = useState('USD');
    const [filterYear, setFilterYear] = useState(today.getFullYear());
    const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);

    // Form states - NOW INCLUDING DATE!
    const [formSum, setFormSum] = useState('');
    const [formCurrency, setFormCurrency] = useState('USD');
    const [formCategory, setFormCategory] = useState('Food');
    const [formDescription, setFormDescription] = useState('');
    const [formDate, setFormDate] = useState(today.toISOString().split('T')[0]);

    const [statusMessage, setStatusMessage] = useState('');

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
            setExchangeRates(db.getExchangeRates());
            setStatusMessage('Failed to fetch rates. Using cached/default rates.');
        }
    }, []);

    useEffect(() => {
        loadRates(DEFAULT_RATES_URL);
    }, [loadRates]);

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
                description: formDescription,
                date: new Date(formDate) // Sending the exact date chosen by the user
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

    const report = useMemo(
        () => costsDB.getReport(targetCurrency, Number(filterYear), Number(filterMonth)),
        [targetCurrency, filterYear, filterMonth, costs, exchangeRates]
    );

    const categoryTotals = useMemo(
        () => costsDB.getCategoryBreakdown(targetCurrency, Number(filterYear), Number(filterMonth)),
        [targetCurrency, filterYear, filterMonth, costs, exchangeRates]
    );

    const monthlyTotalsForYear = useMemo(
        () => costsDB.getMonthlyTotals(targetCurrency, Number(filterYear)),
        [targetCurrency, filterYear, costs, exchangeRates]
    );

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
                {/* Form Section */}
                <section className="card">
                    <h2>Add New Cost Item</h2>
                    <form onSubmit={handleAddCostSubmit}>
                        <div className="form-group">
                            <label>Sum / Amount:</label>
                            <input type="number" step="any" value={formSum} onChange={(e) => setFormSum(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Date:</label>
                            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
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
                            <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn-primary">Save Cost Item</button>
                    </form>
                </section>

                {/* Settings Section */}
                <section className="card">
                    <h2>System Settings</h2>
                    <form onSubmit={handleSettingsSubmit}>
                        <div className="url-input-row">
                            <div className="form-group">
                                <label>Currency Server URL Endpoint:</label>
                                <input type="url" value={settingsUrlInput} onChange={(e) => setSettingsUrlInput(e.target.value)} />
                            </div>
                            <button type="submit">Update URL</button>
                        </div>
                    </form>
                </section>

                {/* Filters Section */}
                <section className="card full-width-card filter-bar">
                    <h2>Report & Chart Filters</h2>
                    <div className="filter-inputs">
                        <div className="form-group">
                            <label>Target Currency:</label>
                            <select value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value)}>
                                <option value="USD">USD ($)</option>
                                <option value="ILS">ILS (₪)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="EURO">EURO (€)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Select Year:</label>
                            <input type="number" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} />
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

                {/* Integration: Your Pie Chart */}
                <section className="card">
                    <h2>Category Breakdown</h2>
                    <CostsPieChart categoryTotals={categoryTotals} targetCurrency={targetCurrency} />
                </section>

                {/* Integration: Your Bar Chart */}
                <section className="card">
                    <h2>Annual Bar Chart</h2>
                    <CostsBarChart monthlyTotals={monthlyTotalsForYear} monthNames={monthNames} targetCurrency={targetCurrency} />
                </section>
            </div>
        </div>
    );
}