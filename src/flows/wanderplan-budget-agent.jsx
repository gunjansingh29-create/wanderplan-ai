import React, { useMemo, useState } from 'react';

const CATEGORIES = [
  { key: 'flights', label: 'Flights', recommendedShare: 30 },
  { key: 'stays', label: 'Stay', recommendedShare: 35 },
  { key: 'food', label: 'Food', recommendedShare: 20 },
  { key: 'activities', label: 'Activities', recommendedShare: 10 },
  { key: 'buffer', label: 'Buffer', recommendedShare: 5 },
];

function clampPercent(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(100, Math.round(next)));
}

export default function BudgetAgent() {
  const [perPersonBudget, setPerPersonBudget] = useState(3200);
  const [travelers, setTravelers] = useState(4);
  const [tripDays, setTripDays] = useState(10);
  const [shares, setShares] = useState(() =>
    Object.fromEntries(CATEGORIES.map((item) => [item.key, item.recommendedShare]))
  );

  const totals = useMemo(() => {
    const safeBudget = Math.max(0, Number(perPersonBudget) || 0);
    const safeTravelers = Math.max(1, Number(travelers) || 1);
    const safeDays = Math.max(1, Number(tripDays) || 1);
    const shareTotal = CATEGORIES.reduce((sum, item) => sum + (shares[item.key] || 0), 0);
    const rows = CATEGORIES.map((item) => {
      const share = shares[item.key] || 0;
      const perPersonAmount = Math.round((safeBudget * share) / 100);
      return {
        ...item,
        share,
        perPersonAmount,
        groupAmount: perPersonAmount * safeTravelers,
        perDayAmount: Math.round(perPersonAmount / safeDays),
      };
    });
    return {
      safeBudget,
      safeTravelers,
      safeDays,
      shareTotal,
      rows,
      groupBudget: safeBudget * safeTravelers,
    };
  }, [perPersonBudget, travelers, tripDays, shares]);

  const canSave = totals.shareTotal === 100;

  const updateShare = (key, value) => {
    setShares((prev) => ({ ...prev, [key]: clampPercent(value) }));
  };

  const applyRecommended = () => {
    setShares(Object.fromEntries(CATEGORIES.map((item) => [item.key, item.recommendedShare])));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: 24 }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 28, color: '#0F172A' }}>Budget Agent</h1>
        <p style={{ color: '#334155', marginTop: 8 }}>
          Enter your budget inputs and customize allocation shares for your trip.
        </p>

        <div
          style={{
            marginTop: 18,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 12,
          }}
        >
          <label>
            <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>Per-person Budget ($)</div>
            <input
              type="number"
              min={0}
              value={perPersonBudget}
              onChange={(e) => setPerPersonBudget(Math.max(0, Number(e.target.value) || 0))}
              style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #CBD5E1', padding: '8px 10px' }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>Travelers</div>
            <input
              type="number"
              min={1}
              value={travelers}
              onChange={(e) => setTravelers(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #CBD5E1', padding: '8px 10px' }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>Trip Days</div>
            <input
              type="number"
              min={1}
              value={tripDays}
              onChange={(e) => setTripDays(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #CBD5E1', padding: '8px 10px' }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={applyRecommended}
              style={{
                minHeight: 42,
                width: '100%',
                borderRadius: 8,
                border: '1px solid #0D7377',
                color: '#0D7377',
                background: '#ECFDF5',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset To Recommended
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {totals.rows.map((row) => (
            <div
              key={row.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(130px,1fr) minmax(170px,2fr) 72px 132px 132px 112px',
                gap: 10,
                padding: '12px 14px',
                borderBottom: '1px solid #E2E8F0',
                alignItems: 'center',
              }}
            >
              <strong style={{ color: '#0F172A' }}>{row.label}</strong>
              <input
                type="range"
                min={0}
                max={100}
                value={row.share}
                onChange={(e) => updateShare(row.key, e.target.value)}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={row.share}
                onChange={(e) => updateShare(row.key, e.target.value)}
                style={{ minHeight: 36, borderRadius: 8, border: '1px solid #CBD5E1', padding: '6px 8px' }}
              />
              <span style={{ color: '#0F172A', fontWeight: 700 }}>${row.perPersonAmount.toLocaleString()}</span>
              <span style={{ color: '#334155' }}>${row.groupAmount.toLocaleString()} group</span>
              <span style={{ color: '#334155' }}>${row.perDayAmount.toLocaleString()}/day</span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 14,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: '#334155' }}>
              Total allocation: <strong>{totals.shareTotal}%</strong> {canSave ? '(OK)' : '(must equal 100%)'}
            </div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
              Group budget pool: <strong>${totals.groupBudget.toLocaleString()}</strong>
            </div>
          </div>
          <button
            disabled={!canSave}
            style={{
              minHeight: 42,
              borderRadius: 8,
              border: 'none',
              padding: '0 16px',
              background: canSave ? '#0D7377' : '#94A3B8',
              color: '#FFFFFF',
              fontWeight: 700,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            Save Budget Inputs
          </button>
        </div>
      </div>
    </div>
  );
}
