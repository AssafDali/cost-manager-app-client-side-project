import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  /* ------------------------------------------------------------------------
     1. שינוי כותרת הלשונית בדפדפן (Tab Title) בהתאם לעבודה
     ------------------------------------------------------------------------ */
  useEffect(() => {
    document.title = "Cost Manager";
  }, []);

  /* ------------------------------------------------------------------------
     2. הגדרת ה-States של האפליקציה
     ------------------------------------------------------------------------ */
  const [costs, setCosts] = useState([
    { sum: 200, currency: "USD", category: "Food", description: "Milk 3%", date: { day: 12, month: 9, year: 2025 } },
    { sum: 120, currency: "GBP", category: "Education", description: "Zoom License", date: { day: 18, month: 9, year: 2025 } },
    { sum: 340, currency: "ILS", category: "Car", description: "Fuel", date: { day: 5, month: 10, year: 2025 } }
  ]);

  const [exchangeRates, setExchangeRates] = useState({
    "USD": 1,
    "GBP": 0.6,
    "EURO": 0.7,
    "ILS": 3.4
  });

  const [ratesUrl, setRatesUrl] = useState("https://api.jsonbin.io/v3/b/660000000000000000000000"); // כתובת Fallback
  const [settingsUrlInput, setSettingsUrlInput] = useState("");

  const [targetCurrency, setTargetCurrency] = useState("USD");
  const [filterYear, setFilterYear] = useState(2025);
  const [filterMonth, setFilterMonth] = useState(9);

  const [formSum, setFormSum] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formCategory, setFormCategory] = useState("Food");
  const [formDescription, setFormDescription] = useState("");

  const [statusMessage, setStatusMessage] = useState("");

  /* ------------------------------------------------------------------------
     3. פונקציית Fetch למשיכת שערי חליפין מהשרת המרוחק
     ------------------------------------------------------------------------ */
  const fetchRates = async (urlToFetch) => {
    try {
      setStatusMessage("Fetching exchange rates...");
      const response = await fetch(urlToFetch);
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      
      if (data && data.USD) {
        setExchangeRates(data);
        setStatusMessage("Rates updated successfully from server!");
      } else if (data.record && data.record.USD) {
        setExchangeRates(data.record);
        setStatusMessage("Rates updated successfully!");
      }
    } catch (error) {
      console.error("Error fetching rates:", error);
      setStatusMessage("Failed to fetch rates. Using cached rates.");
    }
  };

  useEffect(() => {
    fetchRates(ratesUrl);
  }, []);

  /* ------------------------------------------------------------------------
     4. לוגיקת המרת מטבעות דינמית אמיתית (מבוססת שערים מהשרת)
     ------------------------------------------------------------------------ */
  const convertCurrency = (sum, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return sum;
    const sumInUSD = sum / exchangeRates[fromCurrency];
    return sumInUSD * exchangeRates[toCurrency];
  };

  /* ------------------------------------------------------------------------
     5. פונקציות הטיפול באירועים
     ------------------------------------------------------------------------ */
  const handleAddCostSubmit = (e) => {
    e.preventDefault();
    if (!formSum || isNaN(formSum) || Number(formSum) <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    const today = new Date();
    const newCost = {
      sum: Number(formSum),
      currency: formCurrency,
      category: formCategory,
      description: formDescription,
      date: {
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      }
    };

    setCosts([...costs, newCost]);
    setFormSum("");
    setFormDescription("");
    setStatusMessage("Cost item added successfully!");
  };

  const handleSettingsSubmit = (e) => {
    e.preventDefault();
    if (settingsUrlInput.trim() !== "") {
      setRatesUrl(settingsUrlInput);
      fetchRates(settingsUrlInput);
    }
  };

  /* ------------------------------------------------------------------------
     6. עיבוד וחישוב הנתונים האמיתיים עבור הדוחות והגרפים (פיתרון הבעיה המתמטית)
     ------------------------------------------------------------------------ */
  // א. סינון פריטים לחודש ושנה נבחרים עבור הדוח
  const filteredCostsForReport = costs.filter(cost => 
    cost.date.year === Number(filterYear) && cost.date.month === Number(filterMonth)
  );

  // ב. חישוב סך הכל אמיתי ודינמי לחלוטין על פי המטבע הנבחר ושערי השרת (פתרון הבאג!)
  const reportTotalSum = filteredCostsForReport.reduce((total, cost) => {
    return total + convertCurrency(cost.sum, cost.currency, targetCurrency);
  }, 0);

  // ג. חישוב דיאגרמת העוגה לפי קטגוריות
  const categoryTotals = {};
  filteredCostsForReport.forEach(cost => {
    const sumInTarget = convertCurrency(cost.sum, cost.currency, targetCurrency);
    categoryTotals[cost.category] = (categoryTotals[cost.category] || 0) + sumInTarget;
  });

  // ד. חישוב גרף עמודות שנתי אמיתי ל-12 חודשים
  const monthlyTotalsForYear = Array(12).fill(0);
  costs.forEach(cost => {
    if (cost.date.year === Number(filterYear)) {
      const sumInTarget = convertCurrency(cost.sum, cost.currency, targetCurrency);
      monthlyTotalsForYear[cost.date.month - 1] += sumInTarget;
    }
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const maxMonthlyValue = Math.max(...monthlyTotalsForYear, 1);

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
        
        {/* טופס הוספת הוצאה - האימוג'י היחיד שהושאר */}
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

        {/* חלונית הגדרות מערכת משודרגת ומיושרת ב-Flexbox */}
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

        {/* בקרי סינון ופילטרים */}
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

        {/* דוח חודשי מפורט */}
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
                      <td>{cost.date.day}/{cost.date.month}/{cost.date.year}</td>
                      <td>{cost.description}</td>
                      <td><span className={`badge badge-${cost.category.toLowerCase()}`}>{cost.category}</span></td>
                      <td>{cost.sum} {cost.currency}</td>
                      <td className="converted-sum">
                        {convertCurrency(cost.sum, cost.currency, targetCurrency).toFixed(2)} {targetCurrency}
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

        {/* דיאגרמת עוגה מינימליסטית מותאמת צבעים */}
        <section className="card">
          <h2>Category Breakdown</h2>
          <p className="chart-info">Visual distribution of expenses in {targetCurrency}</p>
          <div className="pie-chart-container">
            {Object.keys(categoryTotals).length === 0 ? (
              <p className="no-data">Add data to generate pie breakdown.</p>
            ) : (
              <div className="mock-pie-visual">
                {Object.entries(categoryTotals).map(([category, sum], idx) => {
                  const percentage = ((sum / reportTotalSum) * 100).toFixed(1);
                  return (
                    <div key={idx} className="pie-slice-row">
                      <span 
                        className="color-indicator" 
                        style={{ backgroundColor: `var(--color-${category.toLowerCase()})` }}
                      ></span>
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

        {/* גרף עמודות שנתי קפסולה מוחשי עם הגנת גובה מינימלי */}
        <section className="card">
          <h2>Annual Bar Chart</h2>
          <p className="chart-info">Total continuous layout across months in {targetCurrency}</p>
          <div className="bar-chart-container">
            <div className="mock-bar-graph">
              {monthlyTotalsForYear.map((monthlySum, index) => {
                // חישוב גובה מבוסס אחוזים, עם ערך מינימלי של 3% כדי שהעמודה תמיד תהיה מוחשית בעין
                const barHeightPercentage = monthlySum > 0 ? (monthlySum / maxMonthlyValue) * 100 : 3;
                return (
                  <div className="bar-column" key={index}>
                    <div className="bar-value-tooltip">{monthlySum > 0 ? `${monthlySum.toFixed(0)}` : '0'}</div>
                    <div 
                      className="bar-fill" 
                      style={{ height: `${barHeightPercentage}%` }}
                    ></div>
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