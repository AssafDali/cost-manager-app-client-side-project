import React from 'react';
// Importing the pie chart component we created earlier.
import CostsPieChart from './components/CostsPieChart';
// Importing the newly created bar chart component.
import CostsBarChart from './components/CostsBarChart';

export default function App() {
  
  // Returning the main application layout with both of our charts.
  return (
    <div>
      <h1 style={{ textAlign: 'center' }}>Cost Manager Application</h1>
      <CostsPieChart />
      
      {/* Rendering the bar chart right below the pie chart. */}
      <CostsBarChart />
    </div>
  );
}