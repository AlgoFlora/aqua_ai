import React from 'react';
import { useApp } from '../AppContext';

type Tab = 'dashboard' | 'prediction' | 'analytics' | 'alerts' | 'settings';
interface Props { current: Tab; onChange: (t: Tab) => void; isAdmin: boolean; }

export default function BottomNav({ current, onChange, isAdmin }: Props) {
  const { unreadAlertCount, connectionStatus } = useApp();

  // Admin sees all 5 tabs; society members see 3 tabs (no Prediction, no Settings)
  const allItems: { id: Tab; label: string; icon: JSX.Element; adminOnly?: boolean }[] = [
    {
      id: 'dashboard', label: 'Home',
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    },
    {
      id: 'prediction', label: 'AI Predict', adminOnly: true,
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    },
    {
      id: 'analytics', label: 'Analytics',
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-3 3"/></svg>
    },
    {
      id: 'alerts', label: 'Alerts',
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    },
    {
      id: 'settings', label: 'Settings', adminOnly: true,
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    },
  ];

  const items = allItems.filter(item => isAdmin || !item.adminOnly);

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`nav-item ${current === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <div style={{ position: 'relative' }}>
            <div className="nav-icon">{item.icon}</div>
            {item.id === 'alerts' && unreadAlertCount > 0 && (
              <div style={{
                position: 'absolute', top: -4, right: -4,
                background: '#ef4444', color: 'white',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: 9, fontWeight: 800, display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}>
                {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
              </div>
            )}
            {item.id === 'dashboard' && connectionStatus === 'connected' && (
              <div style={{
                position: 'absolute', top: -2, right: -2,
                width: 8, height: 8, borderRadius: '50%', background: '#10b981'
              }} />
            )}
          </div>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
