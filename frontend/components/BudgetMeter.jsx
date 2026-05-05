import React from 'react';

export default function BudgetMeter({ value = 0, max = 100 }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const colorClass = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';

  return (
    <div>
      <div
        data-testid="budget-meter-bar"
        className={colorClass}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
