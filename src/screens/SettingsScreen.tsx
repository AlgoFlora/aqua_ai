import React from 'react';
import { useApp } from '../AppContext';
import { format } from 'date-fns';

export default function SettingsScreen() {
  const { settings, updateSettings, resetHistory, user, doLogout, connectArduino, disconnectArduino, connectionStatus, isDemoMode, sensorHealth, latestReading, readings } = useApp();

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <label className="switch">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );

  const NumInput = ({ value, onChange, min, max, unit }: { value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input className="setting-input" type="number" value={value} min={min} max={max}
        onChange={e => onChange(parseFloat(e.target.value) || 0)} />
      {unit && <span style={{ fontSize: 12, color: '#94a3b8' }}>{unit}</span>}
    </div>
  );

  return (
    <div>
      {/* Profile */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{ width: 50, height: 50, borderRadius: 16, background: 'linear-gradient(135deg, #0891b2, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Role: {user?.role?.toUpperCase()} | @{user?.username}</div>
        </div>
        <button className="btn btn-sm btn-outline" onClick={doLogout} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
          Logout
        </button>
      </div>

      {/* Connection */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>🔌 CONNECTION</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Arduino USB</div>
            <div className="setting-desc">{connectionStatus === 'connected' ? (isDemoMode ? 'Demo simulation active' : 'Physical Arduino connected') : 'Not connected'}</div>
          </div>
          <span className={`badge ${connectionStatus === 'connected' ? 'badge-success' : 'badge-muted'}`}>
            {connectionStatus === 'connected' ? (isDemoMode ? 'DEMO' : 'CONNECTED') : 'OFF'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => connectArduino('webserial')}>Connect USB</button>
          <button className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={() => connectArduino('demo')}>Demo Mode</button>
          {connectionStatus === 'connected' && (
            <button className="btn btn-sm" style={{ flex: 1, background: '#f1f5f9', color: '#ef4444' }} onClick={disconnectArduino}>Disconnect</button>
          )}
        </div>
      </div>

      {/* Tank Configuration */}
      {user?.role === 'admin' && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>🛢️ TANK CONFIGURATION</div>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Tank Height</div>
              <div className="setting-desc">Total tank height from bottom</div>
            </div>
            <NumInput value={settings.tankHeight} onChange={v => updateSettings({ tankHeight: v })} min={1} max={500} unit="cm" />
          </div>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Sensor Offset</div>
              <div className="setting-desc">Gap from top of tank to sensor</div>
            </div>
            <NumInput value={settings.sensorOffset} onChange={v => updateSettings({ sensorOffset: v })} min={0} max={50} unit="cm" />
          </div>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Min Valid Distance</div>
              <div className="setting-desc">Minimum plausible reading</div>
            </div>
            <NumInput value={settings.minValidDistance} onChange={v => updateSettings({ minValidDistance: v })} min={1} unit="cm" />
          </div>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Max Valid Distance</div>
              <div className="setting-desc">Maximum plausible reading</div>
            </div>
            <NumInput value={settings.maxValidDistance} onChange={v => updateSettings({ maxValidDistance: v })} min={2} unit="cm" />
          </div>
        </div>
      )}

      {/* Level Thresholds */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>⚠️ LEVEL THRESHOLDS</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Critical Level</div>
            <div className="setting-desc" style={{ color: '#ef4444' }}>Emergency threshold</div>
          </div>
          <NumInput value={settings.criticalLevel} onChange={v => updateSettings({ criticalLevel: v })} min={5} max={50} unit="%" />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Warning Level</div>
            <div className="setting-desc" style={{ color: '#f59e0b' }}>Alert threshold</div>
          </div>
          <NumInput value={settings.warningLevel} onChange={v => updateSettings({ warningLevel: v })} min={10} max={70} unit="%" />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Safe Level</div>
            <div className="setting-desc" style={{ color: '#10b981' }}>Comfortable threshold</div>
          </div>
          <NumInput value={settings.safeLevel} onChange={v => updateSettings({ safeLevel: v })} min={30} max={90} unit="%" />
        </div>
      </div>

      {/* AI & Alerts */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>🤖 AI & ALERTS</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Buzzer Alerts</div>
            <div className="setting-desc">Send BUZZER_ON command to Arduino</div>
          </div>
          <Toggle value={settings.buzzerAlerts} onChange={v => updateSettings({ buzzerAlerts: v })} />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">AI Recommendations</div>
            <div className="setting-desc">AI pump & management recommendations</div>
          </div>
          <Toggle value={settings.aiRecommendations} onChange={v => updateSettings({ aiRecommendations: v })} />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Demo Mode</div>
            <div className="setting-desc">Use simulated sensor data</div>
          </div>
          <Toggle value={settings.demoMode} onChange={v => updateSettings({ demoMode: v })} />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Data Retention</div>
            <div className="setting-desc">Days to keep sensor history</div>
          </div>
          <NumInput value={settings.dataRetentionDays} onChange={v => updateSettings({ dataRetentionDays: v })} min={1} max={90} unit="days" />
        </div>
      </div>

      {/* Sensor Health */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>🔬 SENSOR STATUS</div>
        <div className="health-row">
          <span className="health-key">Total readings</span>
          <span className="health-val">{readings.length}</span>
        </div>
        <div className="health-row">
          <span className="health-key">Valid readings</span>
          <span className="health-val">{readings.filter(r => r.is_valid).length}</span>
        </div>
        <div className="health-row">
          <span className="health-key">Anomalies detected</span>
          <span className="health-val" style={{ color: '#f59e0b' }}>{readings.filter(r => r.is_anomaly).length}</span>
        </div>
        <div className="health-row">
          <span className="health-key">Sensor health score</span>
          <span className="health-val" style={{ color: sensorHealth && sensorHealth.healthScore < 60 ? '#ef4444' : '#10b981' }}>
            {sensorHealth ? `${sensorHealth.healthScore}%` : '—'}
          </span>
        </div>
        <div className="health-row">
          <span className="health-key">Last reading</span>
          <span className="health-val">
            {latestReading ? format(new Date(latestReading.timestamp), 'HH:mm:ss') : '—'}
          </span>
        </div>
      </div>

      {/* Hardware */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>🔧 HARDWARE</div>
        {[
          { name: 'Arduino UNO', status: connectionStatus === 'connected' && !isDemoMode ? 'CONNECTED' : 'DISCONNECTED', ok: connectionStatus === 'connected' && !isDemoMode },
          { name: 'USB OTG', status: connectionStatus === 'connected' && !isDemoMode ? 'CONNECTED' : 'DISCONNECTED', ok: connectionStatus === 'connected' && !isDemoMode },
          { name: 'Ultrasonic Sensor', status: connectionStatus === 'connected' ? 'ACTIVE' : 'INACTIVE', ok: connectionStatus === 'connected' },
          { name: 'Buzzer', status: settings.buzzerAlerts ? 'ENABLED' : 'DISABLED', ok: true },
          { name: 'Relay', status: 'OPTIONAL — NOT REQUIRED', ok: true },
          { name: 'Pump', status: 'OPTIONAL — NOT REQUIRED', ok: true },
        ].map(h => (
          <div className="health-row" key={h.name}>
            <span className="health-key">{h.name}</span>
            <span className={`badge ${h.ok ? 'badge-success' : 'badge-muted'}`}>{h.status}</span>
          </div>
        ))}
      </div>

      {/* Data Management */}
      {user?.role === 'admin' && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>🗃️ DATA MANAGEMENT</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            Stored readings: <strong>{readings.length}</strong><br />
            This will clear all historical sensor data and alerts.
          </div>
          <button className="btn btn-danger btn-full" onClick={() => { if (window.confirm?.('Reset all data?') ?? true) resetHistory(); }}>
            Reset All History
          </button>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}
