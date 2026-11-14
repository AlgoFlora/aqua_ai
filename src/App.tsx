import React, { useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import PredictionScreen from './screens/PredictionScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import AlertsScreen from './screens/AlertsScreen';
import SettingsScreen from './screens/SettingsScreen';
import BottomNav from './components/BottomNav';

type Tab = 'dashboard' | 'prediction' | 'analytics' | 'alerts' | 'settings';

const SCREEN_TITLES: Record<Tab, string> = {
  dashboard:  'AQUA AI',
  prediction: 'AI Prediction',
  analytics:  'Analytics',
  alerts:     'Smart Alerts',
  settings:   'Settings',
};

function AppInner() {
  const { user, connectionStatus, isDemoMode } = useApp();
  const [tab, setTab] = useState<Tab>('dashboard');

  if (!user) return <LoginScreen />;

  const isAdmin = user.role === 'admin';

  const screens: Record<Tab, React.ReactNode> = {
    dashboard:  <DashboardScreen />,
    prediction: <PredictionScreen />,
    analytics:  <AnalyticsScreen />,
    alerts:     <AlertsScreen />,
    settings:   <SettingsScreen />,
  };

  // If a regular user somehow lands on admin-only tabs, redirect to dashboard
  const activeTab = (!isAdmin && tab === 'settings') ? 'dashboard' : tab;

  return (
    <div className="app-shell">
      {/* ── Fixed Header ── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2C12 2 5 10 5 14a7 7 0 0 0 14 0C19 10 12 2 12 2z"/>
            </svg>
          </div>
          <span className="app-header-title">{SCREEN_TITLES[activeTab]}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Role badge */}
          <span style={{
            fontSize: 9,
            background: isAdmin ? 'linear-gradient(135deg,#0891b2,#06b6d4)' : '#f1f5f9',
            color: isAdmin ? 'white' : '#64748b',
            borderRadius: 5, padding: '2px 7px', fontWeight: 800, letterSpacing: '0.05em'
          }}>
            {isAdmin ? 'ADMIN' : 'MEMBER'}
          </span>

          {isDemoMode && (
            <span style={{
              fontSize: 9, background: '#fef3c7', color: '#92400e',
              borderRadius: 5, padding: '2px 6px', fontWeight: 800, letterSpacing: '0.05em'
            }}>DEMO</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className={`status-dot ${
              connectionStatus === 'connected' ? 'connected'
              : connectionStatus === 'connecting' ? 'warning'
              : 'disconnected'
            }`} />
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              {connectionStatus === 'connected'
                ? (isDemoMode ? 'Demo' : 'Arduino')
                : connectionStatus === 'connecting' ? 'Connecting…' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Scrollable Screen Area ── */}
      <div className="screen-wrapper">
        <div className="screen-content fade-in" key={activeTab}>
          {screens[activeTab]}
        </div>
      </div>

      {/* ── Fixed Bottom Nav ── */}
      <BottomNav current={activeTab} onChange={setTab} isAdmin={isAdmin} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
