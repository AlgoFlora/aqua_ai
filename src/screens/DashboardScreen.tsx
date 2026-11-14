import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import WaterRing from '../components/WaterRing';
import { format } from 'date-fns';
import { downloadExcelReport } from '../reportExport';

// Detect if running inside Capacitor Android
const isAndroid = (): boolean => {
  const cap = (window as any).Capacitor;
  return cap != null && typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android';
};

// Live "time ago" hook — updates every second
function useTimeAgo(timestamp: number | null): string {
  const [ago, setAgo] = useState('');
  useEffect(() => {
    if (!timestamp) { setAgo(''); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - timestamp) / 1000);
      if (diff < 2) setAgo('just now');
      else if (diff < 60) setAgo(`${diff}s ago`);
      else setAgo(`${Math.floor(diff / 60)}m ago`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [timestamp]);
  return ago;
}

export default function DashboardScreen() {
  const {
    user, latestReading, readings, prediction, demand,
    leak, sensorHealth, pumpRec, connectionStatus,
    connectionMsg, isDemoMode, isWebSerial, hasWebSerial,
    connectArduino, disconnectArduino, sendCommand, settings,
  } = useApp();

  const [downloading, setDownloading] = useState(false);
  // Live feed: last 5 readings to show in ticker
  const [liveFeed, setLiveFeed] = useState<typeof readings>([]);
  const feedRef = useRef<typeof readings>([]);

  const lastAgo = useTimeAgo(latestReading?.timestamp ?? null);

  // Update live feed whenever readings change — keep last 10
  useEffect(() => {
    const last10 = readings.slice(-10).reverse();
    feedRef.current = last10;
    setLiveFeed(last10);
  }, [readings]);

  const level      = latestReading?.water_level ?? 0;
  const hasData    = latestReading !== null;
  const isAdmin    = user?.role === 'admin';

  // Status thresholds matching Arduino + user spec:
  // 0% EMPTY | 1–24% LOW | 25–49% FILLING | 50–74% HALF FILLED | 75–99% ALMOST FULL | 100% FULL
  const levelColor = level <= 0  ? '#94a3b8'
                   : level <= 24 ? '#ef4444'
                   : level <= 49 ? '#f59e0b'
                   : level <= 74 ? '#0891b2'
                   : level <= 99 ? '#10b981'
                   : '#10b981';
  const statusText = level <= 0  ? 'EMPTY'
                   : level <= 24 ? 'LOW'
                   : level <= 49 ? 'FILLING'
                   : level <= 74 ? 'HALF FILLED'
                   : level <= 99 ? 'ALMOST FULL'
                   : 'FULL';
  const statusBg   = level <= 0  ? '#f1f5f9'
                   : level <= 24 ? '#fee2e2'
                   : level <= 49 ? '#fef3c7'
                   : level <= 74 ? '#e0f2fe'
                   : '#d1fae5';

  // Water height: prefer Arduino-calculated value from reading, fallback to settings math
  const waterHeight = hasData
    ? (latestReading!.water_height_cm != null
        ? latestReading!.water_height_cm
        : Math.max(0, (latestReading!.empty_distance_cm ?? settings.tankHeight) - latestReading!.distance_cm))
    : 0;

  // Empty (reference) distance from calibration
  const emptyDist = latestReading?.empty_distance_cm ?? null;

  const handleDownload = async () => {
    setDownloading(true);
    await new Promise(r => setTimeout(r, 300));
    downloadExcelReport(readings, settings);
    setDownloading(false);
  };

  // Last 30 readings reversed for the admin log
  const recentReadings = readings.slice(-30).reverse();

  // LCD line content — mirroring exact Arduino output
  const lcdLine0 = !hasData
    ? 'LEVEL: ??% AquaAI'
    : level >= 100 ? 'LEVEL: 100% AquaAI'
    : `LEVEL: ${String(Math.round(level)).padStart(3, ' ')}% AquaAI`;

  const lcdLine1 = !hasData ? 'Check sensor...  '
    : level >= 100 ? 'CONTAINER FULL  '
    : level >= 75  ? 'ALMOST FULL     '
    : level >= 50  ? 'HALF FILLED     '
    : level >= 25  ? 'FILLING...      '
    : level >=  1  ? 'LEVEL LOW       '
    :                'CONTAINER EMPTY ';

  // Rate: readings per second (from last 5 readings)
  const readingRate = (() => {
    if (readings.length < 2) return null;
    const last = readings.slice(-5);
    if (last.length < 2) return null;
    const span = last[last.length - 1].timestamp - last[0].timestamp;
    if (span <= 0) return null;
    return ((last.length - 1) / (span / 1000)).toFixed(1);
  })();

  return (
    <div>
      {/* ── Connection Card ───────────────────────────────── */}
      <div className="card" style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span className={`status-dot ${
            connectionStatus === 'connected' ? 'connected'
            : connectionStatus === 'connecting' ? 'warning'
            : 'disconnected'
          }`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {connectionStatus === 'connected'
                ? isWebSerial ? '🖥️ Arduino via USB (Web Serial)'
                  : isDemoMode ? '🎮 Demo Simulation Mode'
                  : '📱 Arduino via USB OTG'
                : connectionStatus === 'connecting' ? 'Connecting…'
                : 'Not Connected'}
            </div>
            {connectionMsg && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{connectionMsg}</div>
            )}
          </div>
          {connectionStatus === 'connected' && (
            <button className="btn btn-sm" style={{ background: '#f1f5f9', color: '#64748b' }}
              onClick={() => disconnectArduino()}>Disconnect</button>
          )}
        </div>

        {connectionStatus !== 'connected' && (
          <div className="connect-info">
            <strong>💡 How to connect:</strong>
            • Laptop: Plug Arduino via USB → Chrome/Edge → click "USB Arduino"<br />
            • Phone + OTG cable: Open this app, tap "Connect OTG"<br />
            • No hardware yet? Use Demo Mode to see all features
          </div>
        )}

        {connectionStatus !== 'connected' && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {!isAndroid() && hasWebSerial && (
              <button className="btn btn-primary btn-sm" style={{ flex: '1 1 130px' }}
                onClick={() => connectArduino('webserial')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8l-2 4h12z"/>
                </svg>
                USB Arduino
              </button>
            )}
            {isAndroid() && (
              <button className="btn btn-primary btn-sm" style={{ flex: '1 1 130px' }}
                onClick={() => connectArduino('android')}>
                📱 Connect OTG
              </button>
            )}
            <button className="btn btn-sm" style={{ flex: '1 1 90px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}
              onClick={() => connectArduino('demo')}>
              🎮 Demo Mode
            </button>
          </div>
        )}
        {connectionStatus === 'connected' && isWebSerial && (
          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 2 }}>
            ✓ Reading live sensor data from Arduino
          </div>
        )}
        {connectionStatus === 'connected' && isDemoMode && (
          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>
            📊 Simulated data — connect hardware for real readings
          </div>
        )}
      </div>

      {/* ── BIG LIVE MONITOR (0 → 1 → 2 → ... → 100) ──────── */}
      {connectionStatus === 'connected' && (
        <div className="live-monitor-card">
          {/* Header */}
          <div className="live-monitor-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="live-pulse-dot" />
              <span className="live-monitor-title">LIVE WATER LEVEL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {readingRate && <span className="live-rate-badge">{readingRate}/s</span>}
              <span className="live-ago">{lastAgo}</span>
            </div>
          </div>

          {/* Big animated percentage number */}
          <div className="live-monitor-big-row">
            <div className="live-big-percent" style={{
              color: level <= 20 ? '#ef4444' : level <= 40 ? '#f59e0b' : level >= 100 ? '#10b981' : '#38bdf8',
            }}>
              {hasData ? level : '--'}
              <span className="live-big-pct-symbol">%</span>
            </div>
            <div className="live-monitor-status-col">
              <div className="live-monitor-status-pill" style={{
                background: level <= 0  ? '#1e293b'
                          : level <= 24 ? '#7f1d1d'
                          : level <= 49 ? '#78350f'
                          : level <= 74 ? '#0c4a6e'
                          : level <= 99 ? '#064e3b'
                          : '#064e3b',
                color:      level <= 0  ? '#94a3b8'
                          : level <= 24 ? '#fca5a5'
                          : level <= 49 ? '#fde68a'
                          : level <= 74 ? '#7dd3fc'
                          : '#6ee7b7',
              }}>
                {level <= 0 ? 'EMPTY' : level <= 24 ? 'LOW' : level <= 49 ? 'FILLING' : level <= 74 ? 'HALF FILLED' : level <= 99 ? 'ALMOST FULL' : 'FULL'}
              </div>
              <div className="live-monitor-sub">
                {hasData ? `${latestReading!.distance_cm.toFixed(2)} cm dist` : '— cm dist'}
              </div>
              {emptyDist != null && (
                <div className="live-monitor-sub" style={{ color: '#475569' }}>
                  ref: {emptyDist.toFixed(2)} cm empty
                </div>
              )}
              <div className="live-monitor-sub" style={{ color: '#38bdf8' }}>
                {hasData ? `${waterHeight.toFixed(2)} cm water` : '—'}
              </div>
            </div>
          </div>

          {/* Full-width 0→100 fill bar */}
          <div className="live-fill-track">
            <div className="live-fill-bar" style={{
              width: `${level}%`,
              background: level <= 20
                ? 'linear-gradient(90deg,#dc2626,#ef4444)'
                : level <= 40
                ? 'linear-gradient(90deg,#d97706,#f59e0b)'
                : level >= 100
                ? 'linear-gradient(90deg,#059669,#10b981)'
                : 'linear-gradient(90deg,#0284c7,#06b6d4,#38bdf8)',
            }} />
          </div>
          <div className="live-fill-labels">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>

          {/* Scrollable all-readings table */}
          <div className="live-readings-header">
            <span>TIME</span>
            <span>DIST</span>
            <span>WATER H.</span>
            <span>LEVEL %</span>
            <span>STATUS</span>
          </div>
          <div className="live-readings-scroll">
            {readings.length === 0 ? (
              <div className="live-readings-empty">Waiting for readings…</div>
            ) : (
              readings.slice().reverse().map((r, i) => {
                // Use Arduino-calculated water height when available
                const wH2 = r.water_height_cm != null
                  ? r.water_height_cm
                  : Math.max(0, (r.empty_distance_cm ?? settings.tankHeight) - r.distance_cm);
                const lv  = Math.round(r.water_level);
                const sc  = lv <= 0  ? '#94a3b8'
                          : lv <= 24 ? '#ef4444'
                          : lv <= 49 ? '#f59e0b'
                          : lv <= 74 ? '#38bdf8'
                          : lv <= 99 ? '#10b981'
                          : '#10b981';
                const st  = lv <= 0  ? 'EMPTY'
                          : lv <= 24 ? 'LOW'
                          : lv <= 49 ? 'FILLING'
                          : lv <= 74 ? 'HALF'
                          : lv <= 99 ? 'ALMOST'
                          : 'FULL';
                return (
                  <div key={r.id} className={`live-reading-row ${i === 0 ? 'live-reading-row-new' : ''}`}>
                    <span className="lrr-time">{format(new Date(r.timestamp), 'HH:mm:ss')}</span>
                    <span className="lrr-val">{r.distance_cm.toFixed(2)} cm</span>
                    <span className="lrr-val" style={{ color: '#38bdf8' }}>{wH2.toFixed(2)} cm</span>
                    <span className="lrr-level" style={{ color: sc }}>{lv}%</span>
                    <span className="lrr-status" style={{ color: sc }}>{st}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── LIVE READING TICKER (continuous feed) ─────────── */}
      {connectionStatus === 'connected' && (
        <div className="live-ticker-card">
          <div className="live-ticker-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="live-pulse-dot" />
              <span className="live-ticker-title">LIVE READING</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {readingRate && (
                <span className="live-rate-badge">{readingRate}/s</span>
              )}
              <span className="live-ago">{lastAgo}</span>
            </div>
          </div>

          {/* Continuous feed rows */}
          <div className="live-feed-rows">
            {liveFeed.length === 0 ? (
              <div className="live-feed-empty">
                <div className="live-feed-sampling">
                  <span className="sampling-dot">●</span>
                  <span className="sampling-dot">●</span>
                  <span className="sampling-dot">●</span>
                  Waiting for readings…
                </div>
              </div>
            ) : (
              liveFeed.map((r, i) => {
                const wH = r.water_height_cm != null
                  ? r.water_height_cm
                  : Math.max(0, (r.empty_distance_cm ?? settings.tankHeight) - r.distance_cm);
                const sc = r.water_level <= 0  ? '#94a3b8'
                         : r.water_level <= 24 ? '#ef4444'
                         : r.water_level <= 49 ? '#f59e0b'
                         : r.water_level <= 74 ? '#0891b2'
                         : '#10b981';
                return (
                  <div
                    key={r.id}
                    className={`live-feed-row ${i === 0 ? 'live-feed-row-latest' : ''}`}
                  >
                    <div className="live-feed-time">
                      {format(new Date(r.timestamp), 'HH:mm:ss')}
                    </div>
                    <div className="live-feed-dist">
                      <span className="live-feed-val">{r.distance_cm.toFixed(2)}</span>
                      <span className="live-feed-unit">cm dist</span>
                    </div>
                    <div className="live-feed-height">
                      <span className="live-feed-val" style={{ color: '#0891b2' }}>{wH.toFixed(2)}</span>
                      <span className="live-feed-unit">cm water</span>
                    </div>
                    <div className="live-feed-level" style={{ color: sc }}>
                      <span className="live-feed-val" style={{ color: sc }}>{Math.round(r.water_level)}%</span>
                      <span className="live-feed-unit">level</span>
                    </div>
                    {i === 0 && (
                      <div className="live-feed-badge-new">NEW</div>
                    )}
                    {r.is_anomaly && (
                      <div className="live-feed-badge-anomaly">⚠</div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Progress bar showing level continuously */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
              <span>TANK LEVEL</span>
              <span>{level}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{
                width: `${level}%`,
                background: level <= 20 ? 'linear-gradient(90deg,#ef4444,#f87171)'
                  : level <= 40 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                  : 'linear-gradient(90deg,#0891b2,#06b6d4)',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── HERO: Water Level Ring ────────────────────────── */}
      <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 12 }}>
          CURRENT WATER LEVEL
        </div>

        <WaterRing level={level} color={levelColor} size={180} />

        {/* Status pill */}
        <div style={{
          display: 'inline-block', marginTop: 14,
          background: statusBg, color: levelColor,
          borderRadius: 20, padding: '5px 16px',
          fontWeight: 800, fontSize: 13, letterSpacing: '0.06em'
        }}>
          {statusText}
        </div>

        {/* Key metrics row */}
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {hasData ? `${latestReading!.distance_cm.toFixed(1)} cm` : '—'}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Distance</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0891b2' }}>
              {hasData ? `${waterHeight.toFixed(1)} cm` : '—'}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Water Height</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {hasData ? `${latestReading!.confidence}%` : '—'}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Confidence</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{readings.length}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Readings</div>
          </div>
        </div>

        {/* Last updated ticker */}
        {latestReading && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8' }}>
            Last updated: <span style={{ fontWeight: 700, color: '#0891b2' }}>{format(new Date(latestReading.timestamp), 'HH:mm:ss')}</span>
            {' '}· <span style={{ color: '#10b981', fontWeight: 600 }}>{lastAgo}</span>
            {isWebSerial ? ' · Live Arduino' : isDemoMode ? ' · Demo simulation' : ''}
          </div>
        )}
      </div>

      {/* ── AI Forecast (visible to all) ─────────────────── */}
      <div className="card">
        <div className="section-header">
          <div className="section-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            AI FORECAST
          </div>
          {prediction && !prediction.insufficient && (
            <span className={`badge ${prediction.trend === 'falling' ? 'badge-warning' : prediction.trend === 'rising' ? 'badge-success' : 'badge-primary'}`}>
              {prediction.trend === 'falling' ? '↓ FALLING' : prediction.trend === 'rising' ? '↑ RISING' : '→ STABLE'}
            </span>
          )}
        </div>

        {!prediction || prediction.insufficient ? (
          <div style={{ background: '#f8fafc', borderRadius: 9, padding: '12px', fontSize: 13, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }}>
            {prediction?.message || 'Collecting readings to activate AI predictions…'}
          </div>
        ) : (
          <>
            <div className="prediction-row">
              {[{ t: '15m', v: prediction.min15 }, { t: '30m', v: prediction.min30 }, { t: '1hr', v: prediction.min60 }, { t: '2hr', v: prediction.min120 }]
                .filter(p => p.v != null)
                .map(p => (
                  <div className="prediction-pill" key={p.t}>
                    <div className="time">{p.t}</div>
                    <div className="level" style={{ color: (p.v ?? 0) <= 20 ? '#ef4444' : (p.v ?? 0) <= 40 ? '#f59e0b' : '#0891b2' }}>
                      {(p.v ?? 0).toFixed(0)}%
                    </div>
                    <div className="level-label">pred.</div>
                  </div>
                ))}
            </div>
            {prediction.criticalETA != null && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                ⏱ Critical ETA: ~{prediction.criticalETA < 60 ? `${prediction.criticalETA}m` : `${Math.floor(prediction.criticalETA / 60)}h ${prediction.criticalETA % 60}m`}
              </div>
            )}
            <div className="ai-reason" style={{ margin: '8px 0 0' }}>
              <span className="ai-reason-label">AI says</span>
              {prediction.message}
            </div>
          </>
        )}
      </div>

      {/* ── AI Status Grid (all users) ────────────────────── */}
      <div className="metric-grid">
        <div className="metric-item">
          <div className="metric-label">DEMAND</div>
          <div className="metric-value" style={{ fontSize: 15 }}>
            {demand?.insufficient ? '—' : demand?.nextHourDemand === 'high' ? '🔴 High' : demand?.nextHourDemand === 'moderate' ? '🟡 Mod.' : '🟢 Low'}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Next hour</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">LEAK RISK</div>
          <div className="metric-value" style={{ fontSize: 15, color: leak?.detected ? '#ef4444' : '#10b981' }}>
            {leak?.detected ? `⚠️ ${leak.severity}` : '✅ None'}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Detected</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">SENSOR</div>
          <div className="metric-value" style={{ color: sensorHealth && sensorHealth.healthScore < 60 ? '#ef4444' : '#0891b2' }}>
            {sensorHealth ? `${sensorHealth.healthScore}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Health</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">TODAY USAGE</div>
          <div className="metric-value" style={{ fontSize: 15 }}>
            {demand?.insufficient ? '—' : `${demand?.todayUsed}L`}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Est. used</div>
        </div>
      </div>

      {/* ── Download Report Button (all users) ───────────── */}
      <button
        className="btn btn-primary btn-full"
        style={{ marginBottom: 10, gap: 8 }}
        onClick={handleDownload}
        disabled={downloading || readings.length === 0}
      >
        {downloading ? (
          <><div className="spinner" /> Preparing Report…</>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Monthly Report (.xlsx)
          </>
        )}
      </button>
      {readings.length === 0 && (
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 8, marginTop: -6 }}>
          Connect to start collecting readings for the report
        </div>
      )}

      {/* ── ADMIN ONLY: Pump Intelligence ────────────────── */}
      {isAdmin && (
        <div className={`pump-card ${pumpRec?.action === 'OFF' ? 'recommend-off' : pumpRec?.action === 'ON_RECOMMENDED' ? 'recommend-on' : 'recommend-caution'}`}>
          <div className="section-header" style={{ marginBottom: 6 }}>
            <div className="section-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              </svg>
              PUMP INTELLIGENCE
            </div>
            {pumpRec?.confidence && <span className="badge badge-primary">{pumpRec.confidence}% conf.</span>}
          </div>
          <div className="pump-label">AI RECOMMENDATION</div>
          <div className="pump-status">
            {pumpRec?.action === 'OFF' ? '● PUMP OFF' : pumpRec?.action === 'ON_RECOMMENDED' ? '● PUMP ON' : '● MONITOR'}
          </div>
          {pumpRec && (
            <div className="ai-reason">
              <span className="ai-reason-label">AI Reasoning</span>
              {pumpRec.safetyOverride && <span style={{ color: '#ef4444', fontStyle: 'normal', fontWeight: 700, display: 'block', marginBottom: 2 }}>{pumpRec.safetyOverride}</span>}
              {pumpRec.reason}
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN ONLY: LCD Preview (live continuous mirror) ─ */}
      {isAdmin && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="section-header" style={{ padding: '12px 14px 0' }}>
            <div className="section-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5">
                <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/>
                <line x1="12" y1="16" x2="12" y2="20"/>
              </svg>
              LCD DISPLAY
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {connectionStatus === 'connected' && (
                <span className="lcd-live-badge">● LIVE</span>
              )}
              <span className="badge badge-muted">16×2 I2C</span>
            </div>
          </div>
          <div style={{
            margin: '10px 14px',
            background: '#1a3a1a', borderRadius: 8, padding: '10px 14px',
            fontFamily: '"Courier New", Courier, monospace', fontSize: 13,
            lineHeight: '26px', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
            border: '2px solid #2d5a2d', letterSpacing: '0.10em',
          }}>
            <div style={{ color: '#7dff7d', whiteSpace: 'pre' }}>{lcdLine0}</div>
            <div style={{ color: '#7dff7d', whiteSpace: 'pre' }}>
              {!hasData ? 'Check sensor...  ' : lcdLine1}
            </div>
          </div>
          {/* LCD sub-info: distance and water height */}
          {hasData && (
            <div style={{ padding: '0 14px 10px', display: 'flex', gap: 12, fontSize: 11 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 7, padding: '5px 10px', flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{latestReading!.distance_cm.toFixed(1)} cm</div>
                <div style={{ color: '#64748b' }}>Distance</div>
              </div>
              <div style={{ background: '#eff6ff', borderRadius: 7, padding: '5px 10px', flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0891b2', fontSize: 13 }}>{waterHeight.toFixed(1)} cm</div>
                <div style={{ color: '#64748b' }}>Water H.</div>
              </div>
              <div style={{ background: '#f0f9ff', borderRadius: 7, padding: '5px 10px', flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: levelColor, fontSize: 13 }}>{Math.round(level)}%</div>
                <div style={{ color: '#64748b' }}>Level</div>
              </div>
            </div>
          )}
          {connectionStatus === 'connected' && (
            <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-outline" style={{ flex: '1 1 auto', fontSize: 11 }}
                onClick={() => sendCommand('LCD_BACKLIGHT_ON')}>☀️ Backlight On</button>
              <button className="btn btn-sm" style={{ flex: '1 1 auto', fontSize: 11, background: '#1e293b', color: 'white' }}
                onClick={() => sendCommand('LCD_BACKLIGHT_OFF')}>🌑 Backlight Off</button>
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN ONLY: Live Readings Log ─────────────────── */}
      {isAdmin && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="section-header" style={{ padding: '12px 14px 8px' }}>
            <div className="section-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              LIVE READINGS LOG
            </div>
            <span className="badge badge-primary">{readings.length} total</span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '58px 52px 52px 46px 1fr',
            gap: 4, padding: '4px 14px 6px', fontSize: 9, fontWeight: 700,
            color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
            borderBottom: '1px solid #f1f5f9',
          }}>
            <span>Time</span><span>Dist.</span><span>Water H.</span><span>Level</span>
            <span style={{ textAlign: 'right' }}>Status</span>
          </div>

          <div className="readings-log-scroll" style={{ maxHeight: 220, overflowY: 'auto', overflowX: 'hidden' }}>
            {recentReadings.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                No readings yet — connect to start collecting…
              </div>
            ) : (
              recentReadings.map((r, i) => {
                const wH = r.water_height_cm != null
                  ? r.water_height_cm
                  : Math.max(0, (r.empty_distance_cm ?? settings.tankHeight) - r.distance_cm);
                const sc = r.water_level <= 0  ? '#94a3b8'
                         : r.water_level <= 24 ? '#ef4444'
                         : r.water_level <= 49 ? '#f59e0b'
                         : r.water_level <= 74 ? '#64748b'
                         : '#10b981';
                const st = r.water_level <= 0  ? 'EMPTY'
                         : r.water_level <= 24 ? 'LOW'
                         : r.water_level <= 49 ? 'FILLING'
                         : r.water_level <= 74 ? 'HALF'
                         : r.water_level <= 99 ? 'ALMOST'
                         : 'FULL';
                return (
                  <div key={r.id} style={{
                    display: 'grid', gridTemplateColumns: '58px 52px 52px 46px 1fr',
                    gap: 4, padding: '6px 14px', fontSize: 11,
                    borderBottom: '1px solid #f8fafc',
                    background: i === 0 ? 'linear-gradient(90deg,#f0f9ff,#fafeff)' : r.is_anomaly ? '#fff5f5' : 'transparent',
                    alignItems: 'center',
                    animation: i === 0 ? 'rowSlideIn 0.3s ease' : 'none',
                  }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>
                      {format(new Date(r.timestamp), 'HH:mm:ss')}
                    </span>
                    <span style={{ fontWeight: 600 }}>{r.distance_cm.toFixed(1)} cm</span>
                    <span style={{ fontWeight: 600, color: '#0891b2' }}>{wH.toFixed(1)} cm</span>
                    <span style={{ fontWeight: 700, color: sc }}>{Math.round(r.water_level)}%</span>
                    <span style={{ textAlign: 'right' }}>
                      {r.is_anomaly ? (
                        <span style={{ fontSize: 9, background: '#fee2e2', color: '#ef4444', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>ANOMALY</span>
                      ) : (
                        <span style={{ fontSize: 9, background: sc === '#10b981' ? '#d1fae5' : sc === '#ef4444' ? '#fee2e2' : sc === '#f59e0b' ? '#fef3c7' : '#f1f5f9', color: sc, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{st}</span>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
