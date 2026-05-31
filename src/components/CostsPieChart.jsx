import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

// The following is a mock data object for testing the UI.
const mockReport = {
  year: 2026,
  month: 5,
  costs: [
    // Using single quotes for all strings as requested by the style guide.
    { sum: 200, currency: 'USD', category: 'Food', description: 'Supermarket', date: { day: 12 } },
    { sum: 150, currency: 'USD', category: 'Car', description: 'Gas', date: { day: 15 } },
    { sum: 100, currency: 'USD', category: 'Education', description: 'Udemy Course', date: { day: 20 } }
  ],
  total: { currency: 'USD', sum: 450 }
};

// Renamed to categoryColors to follow strict camelCase rules.
const categoryColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

// Component name uses PascalCase convention.
export default function CostsPieChart() {
  
  // Mapping the costs array into the format required by Recharts.
  const chartData = mockReport.costs.map(item => ({
    name: item.category,
    value: item.sum
  }));

  // Returning the JSX for rendering the Pie Chart.
  return (
    <div style={{ textAlign: 'center' }}>
      <h2>Costs by Category ({mockReport.month}/{mockReport.year})</h2>
      
      {/* Rendering the main PieChart wrapper. */}
      <PieChart width={400} height={400} style={{ margin: '0 auto' }}>
        <Pie
          data={chartData}
          cx="50%" 
          cy="50%"
          outerRadius={120} 
          fill="#8884d8"
          dataKey="value" 
          label 
        >
          {/* Using an arrow function as an argument to render each Cell. */}
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
          ))}
        </Pie>
        <Tooltip /> 
        <Legend />  
      </PieChart>
    </div>
  );
}