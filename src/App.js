import React, { useEffect, useMemo, useState } from 'react';
import WanderPlanHomepage from './flows/wanderplan-homepage';
import TripWizard from './flows/wanderplan-wizard';
import Dashboard from './flows/wanderplan-dashboard';
import AnalyticsDashboard from './flows/wanderplan-analytics-dashboard';
import BucketListAgent from './flows/wanderplan-bucket-list-agent';
import InterestHealthAgents from './flows/wanderplan-interest-health-agents';
import InterestProfiler from './flows/wanderplan-interest-profiler';
import TimingAgent from './flows/wanderplan-timing-agent';
import SecurityArchitecture from './flows/wanderplan-security-architecture';
import WanderPlanDesignSystem from './flows/wanderplan-design-system';

const FLOWS = [
  { id: 'wizard', label: 'Trip Wizard', Component: TripWizard },
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'analytics', label: 'Analytics Dashboard', Component: AnalyticsDashboard },
  { id: 'bucket-list', label: 'Bucket List Agent', Component: BucketListAgent },
  { id: 'interest-health', label: 'Interest + Health Agents', Component: InterestHealthAgents },
  { id: 'interest-profiler', label: 'Interest Profiler', Component: InterestProfiler },
  { id: 'timing', label: 'Timing Agent', Component: TimingAgent },
  { id: 'security', label: 'Security Architecture', Component: SecurityArchitecture },
  { id: 'design-system', label: 'Design System', Component: WanderPlanDesignSystem },
];

function parseEntryFromUrl() {
  const hash = window.location.hash.replace('#', '').trim();
  const queryFlow = new URLSearchParams(window.location.search).get('entry');
  const requested = (queryFlow || hash || 'home').toLowerCase();
  return FLOWS.some((flow) => flow.id === requested) ? requested : 'home';
}

function syncHash(flowId) {
  if (flowId === 'home') {
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    return;
  }
  if (window.location.hash !== `#${flowId}`) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search.split('#')[0]}#${flowId}`);
  }
}

function FlowLauncher({ onOpen }) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 9999,
        width: 280,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        padding: 12,
        boxShadow: '0 10px 28px rgba(15,23,42,0.18)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>Open A Flow</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {FLOWS.map((flow) => (
          <button
            key={flow.id}
            onClick={() => onOpen(flow.id)}
            style={{
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              padding: '8px 10px',
              background: '#FFFFFF',
              color: '#0F172A',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {flow.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeFlow, setActiveFlow] = useState(() => parseEntryFromUrl());

  const selectedFlow = useMemo(
    () => FLOWS.find((flow) => flow.id === activeFlow) || null,
    [activeFlow]
  );

  useEffect(() => {
    const onHashChange = () => {
      const fromUrl = parseEntryFromUrl();
      setActiveFlow(fromUrl);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    syncHash(activeFlow);
  }, [activeFlow]);

  if (activeFlow === 'home') {
    return (
      <>
        <WanderPlanHomepage />
        <FlowLauncher onOpen={setActiveFlow} />
      </>
    );
  }

  if (!selectedFlow) {
    return <WanderPlanHomepage />;
  }

  const ActiveComponent = selectedFlow.Component;

  return (
    <div>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          background: '#0F172A',
          color: '#F8FAFC',
        }}
      >
        <strong>{selectedFlow.label}</strong>
        <button
          onClick={() => setActiveFlow('home')}
          style={{
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '6px 10px',
            background: '#111827',
            color: '#F8FAFC',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Back To Homepage
        </button>
      </div>
      <ActiveComponent />
    </div>
  );
}
