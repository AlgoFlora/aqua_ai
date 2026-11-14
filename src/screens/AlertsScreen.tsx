import React from 'react';
import { useApp } from '../AppContext';
import { format } from 'date-fns';

export default function AlertsScreen() {
  const { alerts, unreadAlertCount, ackAlert, clearAllAlerts, leak, sensorHealth, prediction } = useApp();

  const getIcon = (type: string) => {
    if (type === 'critical') return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    );
    if (type === 'warning') return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    );
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    );
  };

  // Live AI status
  const aiStatus = [
    { icon: '💧', label: 'Leak detection', value: leak?.detected ? `Detected (${leak.severity})` : 'Normal', ok: !leak?.detected },
    { icon: '🔬', label: 'Sensor health', value: sensorHealth ? `${sensorHealth.healthScore}%` : '—', ok: !sensorHealth || sensorHealth.healthScore > 70 },
    { icon: '📈', label: 'Prediction', value: prediction?.insufficient ? 'Collecting data' : `${prediction?.confidence}% confidence`, ok: !prediction?.insufficient },
  ];

  return (
    <div>
      {/* AI Status Summary */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          AI SYSTEM STATUS
        </div>
        {aiStatus.map(s => (
          <div className="health-row" key={s.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span className="health-key">{s.label}</span>
            </div>
            <span className={`badge ${s.ok ? 'badge-success' : 'badge-warning'}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Alerts Header */}
      <div className="section-header">
        <div className="section-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          SMART ALERTS
          {unreadAlertCount > 0 && (
            <span style={{ background: '#ef4444', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
              {unreadAlertCount}
            </span>
          )}
        </div>
        {alerts.length > 0 && (
          <button className="btn btn-sm btn-outline" onClick={clearAllAlerts} style={{ fontSize: 11, padding: '6px 10px' }}>
            Clear all
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>All Clear</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>No alerts at this time. System is operating normally.</div>
        </div>
      ) : (
        alerts.slice(0, 50).map(alert => (
          <div
            key={alert.id}
            className={`alert-item ${alert.type}`}
            style={{ opacity: alert.acknowledged ? 0.6 : 1 }}
            onClick={() => ackAlert(alert.id)}
          >
            <div className={`alert-icon ${alert.type}`}>{getIcon(alert.type)}</div>
            <div className="alert-content">
              <div className="alert-title">{alert.title}</div>
              <div className="alert-desc">{alert.description}</div>
              {alert.action && (
                <div style={{ fontSize: 12, color: '#0891b2', marginTop: 4, fontWeight: 500 }}>
                  → {alert.action}
                </div>
              )}
              <div className="alert-time">{format(new Date(alert.timestamp), 'MMM d, HH:mm:ss')}</div>
            </div>
            {!alert.acknowledged && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 4 }} />
            )}
          </div>
        ))
      )}

      {/* Leak Detail Card */}
      {leak?.detected && (
        <div className="card" style={{ borderLeft: `4px solid ${leak.severity === 'high' ? '#ef4444' : '#f59e0b'}` }}>
          <div className="section-title" style={{ marginBottom: 10, color: '#ef4444' }}>
            ⚠️ POSSIBLE ABNORMAL WATER LOSS
          </div>
          <div className="health-row">
            <span className="health-key">Current drop rate</span>
            <span className="health-val" style={{ color: '#ef4444' }}>{leak.dropPercent}% / 5min</span>
          </div>
          <div className="health-row">
            <span className="health-key">Expected rate</span>
            <span className="health-val">{leak.expectedDropPercent}% / 5min</span>
          </div>
          <div className="health-row">
            <span className="health-key">Excess</span>
            <span className="health-val" style={{ color: '#f59e0b' }}>+{leak.excessDropPercent}%</span>
          </div>
          <div className="health-row">
            <span className="health-key">Severity</span>
            <span className={`badge ${leak.severity === 'high' ? 'badge-danger' : leak.severity === 'moderate' ? 'badge-warning' : 'badge-info'}`}>{leak.severity.toUpperCase()}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Possible causes:</div>
            {leak.possibleCauses.map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: '#475569', padding: '2px 0' }}>• {c}</div>
            ))}
          </div>
          <div className="ai-reason" style={{ marginTop: 10 }}>
            <span className="ai-reason-label">Recommended Action</span>
            {leak.action}
          </div>
        </div>
      )}
    </div>
  );
}
