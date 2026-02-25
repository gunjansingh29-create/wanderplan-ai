import React from 'react';
import { render } from '@testing-library/react';
import BudgetMeter from '../components/BudgetMeter';

describe('BudgetMeter', () => {
  it('should render with correct value', () => {
    const { getByTestId } = render(<BudgetMeter value={50} max={100} />);
    expect(getByTestId('budget-meter-bar').style.width).toBe('50%');
  });

  it('should show green color below 70%', () => {
    const { getByTestId } = render(<BudgetMeter value={60} max={100} />);
    expect(getByTestId('budget-meter-bar').className).toMatch(/green/);
  });

  it('should show yellow color at 70%', () => {
    const { getByTestId } = render(<BudgetMeter value={70} max={100} />);
    expect(getByTestId('budget-meter-bar').className).toMatch(/yellow/);
  });

  it('should show red color above 90%', () => {
    const { getByTestId } = render(<BudgetMeter value={95} max={100} />);
    expect(getByTestId('budget-meter-bar').className).toMatch(/red/);
  });

  it('should handle zero max gracefully', () => {
    const { getByTestId } = render(<BudgetMeter value={10} max={0} />);
    expect(getByTestId('budget-meter-bar').style.width).toBe('0%');
  });
});
