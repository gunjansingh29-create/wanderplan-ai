import React, { useMemo } from 'react';

const SAMPLE_CATEGORIES = [
  { name: 'Flights', recommendedShare: 30 },
  { name: 'Stay', recommendedShare: 35 },
  { name: 'Food', recommendedShare: 20 },
  { name: 'Activities', recommendedShare: 10 },
  { name: 'Buffer', recommendedShare: 5 },
];

export default function BudgetAgent() {
  const totalBudget = 3200;
  const rows = useMemo(
    () =>
      SAMPLE_CATEGORIES.map((item) => ({
        ...item,
        amount: Math.round((item.recommendedShare / 100) * totalBudget),
      })),
    [totalBudget]
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 28, color: '#0F172A' }}>Budget Agent</h1>
        <p style={{ color: '#334155', marginTop: 8 }}>
          Suggested allocation for a ${totalBudget.toLocaleString()} per-person trip budget.
        </p>

        <div
          style={{
            marginTop: 16,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {rows.map((row) => (
            <div
              key={row.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: 12,
                padding: '12px 14px',
                borderBottom: '1px solid #E2E8F0',
                alignItems: 'center',
              }}
            >
              <strong style={{ color: '#0F172A' }}>{row.name}</strong>
              <span style={{ color: '#475569' }}>{row.recommendedShare}%</span>
              <span style={{ color: '#0F172A', fontWeight: 700 }}>
                ${row.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
