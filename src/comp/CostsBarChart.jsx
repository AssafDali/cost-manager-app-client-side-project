import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Receiving real array of 12 months from App.js
export default function CostsBarChart({ monthlyTotals, monthNames, targetCurrency }) {
  
  // Creating the structured data array for Recharts
  const chartData = monthlyTotals.map((total, index) => ({
    month: monthNames[index],
    total: Number(total.toFixed(2))
  }));

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
      <BarChart width={600} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => `${value} ${targetCurrency}`} />
        <Legend />
        <Bar dataKey="total" fill="#82ca9d" name={`Total Cost (${targetCurrency})`} />
      </BarChart>
    </div>
  );
}