import React, { useState } from 'react';
import { useApp } from '../AppContext';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { format, startOfDay, startOfMonth } from 'date-fns';
import { downloadExcelReport, buildDailySummary, buildMonthlySummary } from '../reportExport';

type Range = 'today' | '7d' | '30d';

export default function AnalyticsScreen() {
  const { readings, demand, settings, user } = useApp();
  const [range, setRange] = useState<Range>('today');
  const [downloading, setDownloading] = useState(false);

  const isAdmin = user?.role === 'admin';
  const now = Date.now();
  const rangeMs = range === 'today' ? 24 * 3600 * 1000 : range === '7d' ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
  const filtered = readings.filter(r => r.is_valid && !r.is_anomaly && now - r.timestamp <= rangeMs);

  // ── Hourly chart data ────────────────────────────────────
  const hourBuckets: Record<string, { time: string; level: number; count: number }> = {};
  for (const r of filtered) {
    const key = format(new Date(r.timestamp), range === 'today' ? 'HH:mm' : 'dd/MM HH:mm');
    if (!hourBuckets[key]) hourBuckets[key] = { time: key, level: 0, count: 0 };
    hourBuckets[key].level += r.water_level;
    hourBuckets[key].count++;
  }
  const chartData = Object.values(hourBuckets)
    .map(b => ({ time: b.time, level: parseFloat((b.level / b.count).toFixed(1)) }))
    .slice(-48);

  // ── Daily summary chart (date-wise bars for last 30 days) ─
  const dailyRows = buildDailySummary(readings, settings).slice(-30);
  const dailyChartData = dailyRows.map(d => ({
    date: d.Date.split(' ').slice(0, 2).join(' '), // "05 Nov"
    avg: d['Avg Level (%)'],
    usage: d['Est. Usage (L)'],
  }));

  // ── Monthly chart ─────────────────────────────────────────
  const monthlyRows = buildMonthlySummary(readings, settings);
  const monthlyChartData = monthlyRows.map(m => ({
    month: m.Month.slice(0, 3) + ' ' + m.Month.split(' ')[1], // "Nov 2026"
    avg: m['Avg Level (%)'],
    usage: m['Est. Total Usage (L)'],
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ fontSize: 13, fontWeight: 700, color: p.color }}>
            {p.name === 'level' || p.name === 'avg' ? `${p.value}% level`
              : p.name === 'usage' ? `${p.value}L used`
              : `${p.value?.toFixed?.(2) ?? p.value}%`}
          </div>
        ))}
      </div>
    );
  };

  const handleDownload = async () => {
    setDownloading(true);
    await new Promise(r => setTimeout(r, 300));
    downloadExcelReport(readings, settings);
    setDownloading(false);
  };

  return (
    <div>
      {/* ── Header row with Download button ─────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0e7490' }}>Water Analytics</div>
        <button
          className="btn btn-primary btn-sm"
          style={{ gap: 6 }}
          onClick={handleDownload}
          disabled={downloading || readings.length === 0}
        >
          {downloading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Exporting…</> : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export .xlsx
            </>
          )}
        </button>
      </div>

      {/* ── Range Selector ───────────────────────────────── */}
      <div className="toggle-group" style={{ marginBottom: 12 }}>
        {(['today', '7d', '30d'] as Range[]).map(r => (
          <button key={r} className={`toggle-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
            {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
          </button>
        ))}
      </div>

      {/* ── Summary Metrics ──────────────────────────────── */}
      <div className="metric-grid">
        <div className="metric-item">
          <div className="metric-label">TODAY USED</div>
          <div className="metric-value" style={{ fontSize: 18 }}>
            {demand?.insufficient ? '—' : `${demand?.todayUsed}L`}
          </div>
        </div>
        <div className="metric-item">
          <div className="metric-label">PREDICTED</div>
          <div className="metric-value" style={{ fontSize: 18, color: '#06b6d4' }}>
            {demand?.insufficient ? '—' : `${demand?.todayPredicted}L`}
          </div>
        </div>
        <div className="metric-item">
          <div className="metric-label">AVG DAILY</div>
          <div className="metric-value" style={{ fontSize: 18 }}>
            {demand?.insufficient ? '—' : `${demand?.avgDailyUsage}L`}
          </div>
        </div>
        <div className="metric-item">
          <div className="metric-label">PEAK HOUR</div>
          <div className="metric-value" style={{ fontSize: 13 }}>
            {demand?.peakHour ?? '—'}
          </div>
        </div>
      </div>

      {/* ── Water Level Over Time (line chart) ───────────── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          WATER LEVEL — {range === 'today' ? 'Today' : range === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
        </div>
        {chartData.length < 2 ? (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14, fontStyle: 'italic' }}>
            Collecting data...
          </div>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="level" stroke="#0891b2" strokeWidth={2} fill="url(#levelGrad)" name="level" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Date-wise Daily Usage Chart ───────────────────── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          DAILY USAGE (Est. Litres)
        </div>
        {dailyChartData.length < 2 ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14, fontStyle: 'italic' }}>
            Need more data across multiple days...
          </div>
        ) : (
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData.slice(-14)} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${v}L`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="usage" fill="#06b6d4" radius={[4, 4, 0, 0]} name="usage" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Monthly Overview Chart ────────────────────────── */}
      {monthlyChartData.length >= 2 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5">
              <path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-3 3"/>
            </svg>
            MONTHLY USAGE TREND
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${v}L`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="usage" fill="#0891b2" radius={[4, 4, 0, 0]} name="usage" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Demand Insights ──────────────────────────────── */}
      {demand && !demand.insufficient && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>DEMAND INSIGHTS</div>
          <div className="ai-reason">
            <span className="ai-reason-label">AI Analysis</span>
            {demand.message}<br />
            Peak usage period: <strong>{demand.peakHour}</strong>.<br />
            Next hour demand is <strong>{demand.nextHourDemand}</strong>.
          </div>
        </div>
      )}

      {/* ── Download info ─────────────────────────────────── */}
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd',
        borderRadius: 10, padding: '10px 14px', marginBottom: 10,
        fontSize: 12, color: '#0e7490', lineHeight: 1.7
      }}>
        <strong>📥 About the Report</strong><br />
        The Excel file contains 2 sheets:<br />
        • <strong>Daily Summary</strong> — Avg, Min, Max level % + est. litres used per day<br />
        • <strong>Monthly Overview</strong> — Monthly totals and averages
      </div>
    </div>
  );
}
