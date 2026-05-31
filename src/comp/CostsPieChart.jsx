import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const categoryColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

// Receiving real data from App.js via props
export default function CostsPieChart({ categoryTotals, targetCurrency }) {
  
  // Transforming the raw object into the array format Recharts needs
  const chartData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value: Number(value.toFixed(2)) // Rounding for display
  }));

  if (chartData.length === 0) {
    return <p style={{ textAlign: 'center', color: '#666' }}>No data available for this month.</p>;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <PieChart width={400} height={400}>
        <Pie
          data={chartData}
          cx="50%" 
          cy="50%"
          outerRadius={120} 
          fill="#8884d8"
          dataKey="value" 
          label 
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${value} ${targetCurrency}`} /> 
        <Legend />  
      </PieChart>
    </div>
  );
}