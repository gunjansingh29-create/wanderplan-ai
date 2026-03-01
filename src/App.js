import React, { useEffect, useMemo, useState } from 'react';
import WanderPlanHomepage from './flows/wanderplan-homepage';
import TripWizard from './TripWizard';
import Dashboard from './flows/wanderplan-dashboard';
import AnalyticsDashboard from './flows/wanderplan-analytics-dashboard';
import BucketListAgent from './flows/wanderplan-bucket-list-agent';
import BudgetAgent from './flows/wanderplan-budget-agent';
import InterestHealthAgents from './flows/wanderplan-interest-health-agents';
import InterestProfiler from './flows/wanderplan-interest-profiler';
import TimingAgent from './flows/wanderplan-timing-agent';

const FLOWS = [
  { id: 'wizard', label: 'Trip Wizard', Component: TripWizard },
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'analytics', label: 'Analytics Dashboard', Component: AnalyticsDashboard },
  { id: 'bucket-list', label: 'Bucket List', Component: BucketListAgent },
  { id: 'budget', label: 'Budget Agent', Component: BudgetAgent },
  { id: 'interest-health', label: 'Health Compatibility', Component: InterestHealthAgents },
  { id: 'interest-profiler', label: 'Interest Profiler', Component: InterestProfiler },
  { id: 'timing', label: 'Best Time To Travel', Component: TimingAgent },
];

const TRIP_SESSION_KEY = 'wanderplan.tripSession';

function parseEntryFromUrl() {
  const queryFlow = new URLSearchParams(window.location.search).get('entry');
  const requested = (queryFlow || 'home').toLowerCase();
  return FLOWS.some((flow) => flow.id === requested) ? requested : 'home';
}

function isDemoModeFromUrl() {
  const mode = new URLSearchParams(window.location.search).get('mode');
  return (mode || '').toLowerCase() === 'demo';
}

function syncHash(flowId) {
  // Keep URL stable so reload always returns landing page unless ?entry= is provided.
  if (window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
}

function buildUrl(flowId, demoMode) {
  const params = new URLSearchParams(window.location.search);
  if (flowId === 'home') {
    params.delete('entry');
  } else {
    params.set('entry', flowId);
  }
  if (demoMode) {
    params.set('mode', 'demo');
  } else {
    params.delete('mode');
  }
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

export default function App() {
  const [activeFlow, setActiveFlow] = useState(() => parseEntryFromUrl());
  const [demoMode, setDemoMode] = useState(() => isDemoModeFromUrl());
  const [lastHomeScreen, setLastHomeScreen] = useState('landing');
  const [tripSession, setTripSession] = useState(() => {
    try {
      const raw = window.localStorage.getItem(TRIP_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const selectedFlow = useMemo(
    () => FLOWS.find((flow) => flow.id === activeFlow) || null,
    [activeFlow]
  );

  useEffect(() => {
    syncHash(activeFlow);
  }, [activeFlow]);

  useEffect(() => {
    const onPopState = () => {
      setActiveFlow(parseEntryFromUrl());
      setDemoMode(isDemoModeFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleTripSaved = (session) => {
    setTripSession(session);
    try {
      window.localStorage.setItem(TRIP_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage failures.
    }
  };

  const openFlow = (flowId) => {
    window.history.pushState(null, '', buildUrl(flowId, demoMode));
    setActiveFlow(flowId);
  };

  const goBackOneStep = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', buildUrl('home', demoMode));
    setActiveFlow('home');
  };

  if (activeFlow === 'home') {
    return (
      <>
        <WanderPlanHomepage
          onOpenFlow={openFlow}
          flowTiles={FLOWS}
          initialScreen={lastHomeScreen}
          onScreenChange={setLastHomeScreen}
        />
      </>
    );
  }

  if (!selectedFlow) {
    return (
      <WanderPlanHomepage
        onOpenFlow={openFlow}
        flowTiles={FLOWS}
        initialScreen={lastHomeScreen}
        onScreenChange={setLastHomeScreen}
      />
    );
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
          onClick={goBackOneStep}
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
          Back
        </button>
      </div>
      {selectedFlow.id === 'wizard' ? (
        <TripWizard initialSession={demoMode ? null : tripSession} onTripSaved={handleTripSaved} demoMode={demoMode} />
      ) : (
        <ActiveComponent />
      )}
    </div>
  );
}
