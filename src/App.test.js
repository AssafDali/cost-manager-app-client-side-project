import { render, screen } from '@testing-library/react';
import App from './App';

test('renders cost manager application title', () => {
  render(<App />);
  // Searching for your real custom title on the screen
  const titleElement = screen.getByText(/Cost Manager Application/i);
  expect(titleElement).toBeInTheDocument();
});