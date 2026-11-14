import React, { useState } from 'react';
import { useApp } from '../AppContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend
} from 'recharts';
import { format } from 'date-fns';

export default function PredictionScreen() {
  const { prediction, readings, latestReading, settings } = useApp();
  const level = latestReading?.water_level ?? 0;

  // Build chart data: last 30 actual readings + predicted points
  const validReadings = readings.filter(r => r.is_valid && !r.is_anomaly).slice(-30);
  const chartData = validReadings.map(r => ({
    time: format(new Date(r.timestamp), 'HH:mm'),
    actual: parseFloat(r.water_level.toFixed(1)),
    predicted: undefined as number | undefined,
  }));

  // Add prediction points
  if (prediction && !prediction.insufficient) {
    const now = Date.now();
    if (prediction.min15 != null) chartData.push({ time: format(new Date(now + 15*60000), 'HH:mm'), actual: undefined as any, predicted: prediction.min15 });
    if (prediction.min30 != null) chartData.push({ time: format(new Date(now + 30*60000), 'HH:mm'), actual: undefined as any, predicted: prediction.min30 });
    if (prediction.min60 != null) chartData.push({ time: format(new Date(now + 60*60000), 'HH:mm'), actual: undefined as any, predicted: prediction.min60 });
    if (prediction.min120 != null) chartData.push({ time: format(new Date(now + 120*60000), 'HH:mm'), actual: undefined as any, predicted: prediction.min120 });
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ fontSize: 13, fontWeight: 700, color: p.color }}>
            {p.name === 'actual' ? '● Actual' : '◆ Predicted'}: {p.value?.toFixed(1)}%
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Current Level */}
      <div className="card card-accent" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 4, letterSpacing: '0.05em' }}>CURRENT LEVEL</div>
            <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "'Outfit',sans-serif", lineHeight: 1 }}>{level.toFixed(0)}%</div>
            {prediction && !prediction.insufficient && (
              <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 10px', marginTop: 8, display: 'inline-block' }}>
                {prediction.trend === 'falling' ? '↓ Falling' : prediction.trend === 'rising' ? '↑ Rising' : '→ Stable'}
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>AI Confidence</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Outfit',sans-serif" }}>
              {prediction ? `${prediction.confidence}%` : '—'}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>prediction quality</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          WATER LEVEL TIMELINE
        </div>
        {chartData.length < 2 ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14, fontStyle: 'italic' }}>
            Collecting readings for chart...
          </div>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={settings.criticalLevel} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical', fill: '#ef4444', fontSize: 10 }} />
                <ReferenceLine y={settings.warningLevel} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Warning', fill: '#f59e0b', fontSize: 10 }} />
                <Line type="monotone" dataKey="actual" stroke="#0891b2" strokeWidth={2.5} dot={false} name="actual" connectNulls={false} />
                <Line type="monotone" dataKey="predicted" stroke="#06b6d4" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: '#06b6d4', r: 4 }} name="predicted" connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 20, height: 2, background: '#0891b2', display: 'inline-block' }}/> Actual</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 20, height: 2, background: '#06b6d4', display: 'inline-block', borderTop: '2px dashed #06b6d4' }}/> Predicted</span>
        </div>
      </div>

      {/* Prediction Detail */}
      {prediction && !prediction.insufficient ? (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            PREDICTED LEVELS
          </div>
          {[
            { label: '15 minutes', value: prediction.min15 },
            { label: '30 minutes', value: prediction.min30 },
            { label: '60 minutes', value: prediction.min60 },
            { label: '2 hours',    value: prediction.min120 },
          ].map(p => p.value != null && (
            <div key={p.label} className="health-row">
              <span className="health-key">{p.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 80, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${p.value}%`, height: '100%', background: p.value <= 15 ? '#ef4444' : p.value <= 30 ? '#f59e0b' : '#0891b2', borderRadius: 3 }} />
                </div>
                <span className="health-val" style={{ color: p.value <= 15 ? '#ef4444' : p.value <= 30 ? '#f59e0b' : '#0f172a' }}>
                  {p.value.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
          {prediction.criticalETA != null && (
            <div style={{ marginTop: 12, background: '#fef2f2', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
              ⏱ Estimated critical level in: ~{prediction.criticalETA < 60 ? `${prediction.criticalETA} min` : `${Math.floor(prediction.criticalETA/60)}h ${prediction.criticalETA%60}min`}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>PREDICTION STATUS</div>
          <div style={{ fontSize: 14, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }}>
            {prediction?.message || 'Connecting to sensor...'}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>Data collected</span>
              <span style={{ fontWeight: 700 }}>{readings.filter(r => r.is_valid).length} / 10 min</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, readings.filter(r => r.is_valid).length * 10)}%`, background: '#0891b2' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
