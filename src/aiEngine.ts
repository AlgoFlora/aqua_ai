// ============================================================
// AI ENGINE — All 6 AI Features
// ============================================================

import { SensorReading, AppSettings, getSettings } from './storage';

// ---- Exported Types ----
export interface PredictionResult {
  min15: number | null;
  min30: number | null;
  min60: number | null;
  min120: number | null;
  criticalETA: number | null;
  trend: 'rising' | 'falling' | 'stable';
  confidence: number;
  message: string;
  insufficient: boolean;
}

export interface DemandForecast {
  todayUsed: number;
  todayPredicted: number;
  avgDailyUsage: number;
  peakHour: string;
  nextHourDemand: 'low' | 'moderate' | 'high';
  message: string;
  insufficient: boolean;
}

export interface LeakDetection {
  detected: boolean;
  severity: 'none' | 'low' | 'moderate' | 'high';
  dropPercent: number;
  expectedDropPercent: number;
  excessDropPercent: number;
  possibleCauses: string[];
  action: string;
  confidence: number;
}

export interface SensorAnomalyResult {
  healthScore: number;
  totalReadings: number;
  validReadings: number;
  anomalyCount: number;
  avgStability: number;
  explanation: string;
}

export interface PumpRecommendation {
  action: 'OFF' | 'ON_RECOMMENDED' | 'MONITOR';
  reason: string;
  confidence: number;
  safetyOverride: string | null;
}

// ---- Holt Double Exponential Smoothing ----
function holtForecast(values: number[], stepsAhead: number): number {
  if (values.length < 3) return values[values.length - 1] ?? 50;
  const alpha = 0.4;
  const beta  = 0.2;
  let level = values[0];
  let trend = values[1] - values[0];
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const result = level + stepsAhead * trend;
  return Math.max(0, Math.min(100, result));
}

// ---- Rate of Change (%/min) ----
function rateOfChange(readings: SensorReading[], windowMs: number = 5 * 60 * 1000): number {
  const now = Date.now();
  const window = readings.filter(r => now - r.timestamp <= windowMs);
  if (window.length < 2) return 0;
  const first = window[0];
  const last  = window[window.length - 1];
  const dt    = (last.timestamp - first.timestamp) / 60000;
  if (dt < 0.1) return 0;
  return (last.water_level - first.water_level) / dt;
}

// ---- Z-Score ----
function zScore(value: number, values: number[]): number {
  if (values.length < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : Math.abs(value - mean) / std;
}

// ============================================================
// 1. SENSOR ANOMALY DETECTION (per reading)
// ============================================================
export function detectSensorAnomaly(
  newReading: number,
  history: number[],
): { isAnomaly: boolean; reason: string; zscore: number } {
  if (history.length < 5) return { isAnomaly: false, reason: '', zscore: 0 };
  const z = zScore(newReading, history.slice(-20));
  const roc = history.length > 0
    ? Math.abs(newReading - history[history.length - 1])
    : 0;
  const isAnomaly = z > 3.5 || roc > 25;
  return {
    isAnomaly,
    reason: isAnomaly
      ? z > 3.5
        ? `Z-score ${z.toFixed(1)} — statistical outlier`
        : `Sudden jump of ${roc.toFixed(1)}% exceeds threshold`
      : '',
    zscore: z,
  };
}

// ============================================================
// 2. SENSOR HEALTH SCORE
// ============================================================
export function computeSensorHealth(readings: SensorReading[]): SensorAnomalyResult {
  const n = readings.length;
  if (n === 0) return {
    healthScore: 100, totalReadings: 0, validReadings: 0,
    anomalyCount: 0, avgStability: 100,
    explanation: 'No readings collected yet.',
  };
  const valid   = readings.filter(r => r.is_valid).length;
  const anomaly = readings.filter(r => r.is_anomaly).length;
  const levels  = readings.filter(r => r.is_valid).map(r => r.water_level);
  const avgConf = readings.map(r => r.confidence).reduce((a, b) => a + b, 0) / n;
  let stability = 100;
  if (levels.length > 2) {
    const diffs = levels.slice(1).map((v, i) => Math.abs(v - levels[i]));
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    stability = Math.max(0, 100 - avgDiff * 2);
  }
  const validRatio   = valid / n;
  const anomalyRatio = anomaly / n;
  const healthScore  = Math.round(
    avgConf * 0.4 + stability * 0.3 + validRatio * 100 * 0.2 + (1 - anomalyRatio) * 100 * 0.1
  );
  let explanation = '';
  if (anomaly > 0) explanation += `${anomaly} anomalous reading(s) excluded. `;
  if (validRatio < 0.9) explanation += `${Math.round((1 - validRatio) * 100)}% invalid readings. `;
  if (healthScore > 90) explanation += 'Sensor is performing excellently.';
  else if (healthScore > 70) explanation += 'Sensor health is good.';
  else explanation += 'Sensor health degraded — check connections.';
  return {
    healthScore: Math.min(100, Math.max(0, healthScore)),
    totalReadings: n,
    validReadings: valid,
    anomalyCount: anomaly,
    avgStability: Math.round(stability),
    explanation,
  };
}

// ============================================================
// 3. WATER LEVEL PREDICTION
// ============================================================
export function predictWaterLevel(readings: SensorReading[]): PredictionResult {
  const settings = getSettings();
  const valid = readings.filter(r => r.is_valid && !r.is_anomaly).slice(-120);
  const MIN_READINGS = 10;

  if (valid.length < MIN_READINGS) {
    return {
      min15: null, min30: null, min60: null, min120: null,
      criticalETA: null, trend: 'stable', confidence: 0,
      message: `Collecting data — prediction activates after ${MIN_READINGS} readings. (${valid.length} so far)`,
      insufficient: true,
    };
  }

  const levels = valid.map(r => r.water_level);
  const current = levels[levels.length - 1];
  const roc = rateOfChange(valid);

  const sampleIntervalMs = valid.length > 1
    ? (valid[valid.length - 1].timestamp - valid[0].timestamp) / (valid.length - 1)
    : 2000;
  const sampleIntervalMin = Math.max(0.01, sampleIntervalMs / 60000);
  const stepsPerMin = 1 / sampleIntervalMin;

  const p15  = holtForecast(levels, Math.round(15  * stepsPerMin));
  const p30  = holtForecast(levels, Math.round(30  * stepsPerMin));
  const p60  = holtForecast(levels, Math.round(60  * stepsPerMin));
  const p120 = holtForecast(levels, Math.round(120 * stepsPerMin));

  let criticalETA: number | null = null;
  if (roc < -0.01) {
    criticalETA = Math.round((current - settings.criticalLevel) / Math.abs(roc));
    if (criticalETA < 0) criticalETA = null;
  }

  const delta5min = rateOfChange(valid, 5 * 60 * 1000);
  const trend: 'rising' | 'falling' | 'stable' =
    delta5min > 0.15 ? 'rising' : delta5min < -0.15 ? 'falling' : 'stable';

  const confidence = Math.min(95, Math.round(30 + valid.length * 0.5 + (valid.length > 50 ? 20 : 0)));

  return {
    min15:  parseFloat(p15.toFixed(1)),
    min30:  parseFloat(p30.toFixed(1)),
    min60:  parseFloat(p60.toFixed(1)),
    min120: parseFloat(p120.toFixed(1)),
    criticalETA,
    trend,
    confidence,
    message: `Prediction based on ${valid.length} readings using exponential smoothing.`,
    insufficient: false,
  };
}

// ============================================================
// 4. WATER DEMAND FORECASTING
// ============================================================
export function forecastDemand(readings: SensorReading[]): DemandForecast {
  const settings = getSettings();
  const valid = readings.filter(r => r.is_valid && !r.is_anomaly);
  const MIN = 20;

  if (valid.length < MIN) {
    return {
      todayUsed: 0, todayPredicted: 0, avgDailyUsage: 0,
      peakHour: 'N/A', nextHourDemand: 'low',
      message: `Collecting usage data... (${valid.length}/${MIN} readings needed)`,
      insufficient: true,
    };
  }

  // Cylinder: V = π * r² * h. Use relative percentages instead of absolute volume
  // 1% water level change ≈ certain litres depending on tank geometry
  const tankRadius_m  = 0.25; // assume 0.5m diameter
  const tankHeight_m  = settings.tankHeight / 100;
  const litresPerPct  = Math.PI * tankRadius_m * tankRadius_m * tankHeight_m * 10;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayReadings = valid.filter(r => r.timestamp >= todayStart.getTime())
    .sort((a, b) => a.timestamp - b.timestamp);

  let todayUsed = 0;
  const hourBuckets: Record<number, number> = {};
  for (let i = 1; i < todayReadings.length; i++) {
    const drop = todayReadings[i-1].water_level - todayReadings[i].water_level;
    if (drop > 0) {
      todayUsed += drop * litresPerPct;
      const hour = new Date(todayReadings[i].timestamp).getHours();
      hourBuckets[hour] = (hourBuckets[hour] ?? 0) + drop * litresPerPct;
    }
  }

  const peakEntry = Object.entries(hourBuckets).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const peakHour = peakEntry
    ? `${String(peakEntry[0]).padStart(2,'0')}:00–${String(Number(peakEntry[0])+1).padStart(2,'0')}:00`
    : 'N/A';

  const hourOfDay = new Date().getHours();
  const todayPredicted = hourOfDay > 0 ? Math.round((todayUsed / hourOfDay) * 24) : Math.round(todayUsed);

  const sortedAll = [...valid].sort((a, b) => a.timestamp - b.timestamp);
  let totalDrop = 0;
  for (let i = 1; i < sortedAll.length; i++) {
    const drop = sortedAll[i-1].water_level - sortedAll[i].water_level;
    if (drop > 0) totalDrop += drop * litresPerPct;
  }
  const spanDays = Math.max(1, (sortedAll[sortedAll.length-1].timestamp - sortedAll[0].timestamp) / 86400000);
  const avgDailyUsage = Math.round(totalDrop / spanDays);

  const currentRoc = rateOfChange(valid, 10 * 60 * 1000);
  const nextHourDemand: 'low' | 'moderate' | 'high' =
    currentRoc < -1 ? 'high' : currentRoc < -0.3 ? 'moderate' : 'low';

  return {
    todayUsed: Math.round(todayUsed),
    todayPredicted,
    avgDailyUsage,
    peakHour,
    nextHourDemand,
    message: `Based on ${valid.length} readings over ${spanDays.toFixed(1)} days.`,
    insufficient: false,
  };
}

// ============================================================
// 5. LEAK / ABNORMAL WATER LOSS DETECTION
// ============================================================
export function detectLeak(readings: SensorReading[]): LeakDetection {
  const valid = readings.filter(r => r.is_valid && !r.is_anomaly).slice(-60);
  const NONE: LeakDetection = {
    detected: false, severity: 'none',
    dropPercent: 0, expectedDropPercent: 0, excessDropPercent: 0,
    possibleCauses: [], action: 'Normal operation.', confidence: 0,
  };
  if (valid.length < 10) return NONE;

  const historicalRates: number[] = [];
  for (let i = 1; i < valid.length; i++) {
    const dt = (valid[i].timestamp - valid[i-1].timestamp) / 60000;
    if (dt > 0) {
      const rate = (valid[i-1].water_level - valid[i].water_level) / dt;
      if (rate >= 0) historicalRates.push(rate);
    }
  }
  if (historicalRates.length < 5) return NONE;

  historicalRates.sort((a, b) => a - b);
  const medianRate = historicalRates[Math.floor(historicalRates.length / 2)];

  const recent = valid.slice(-10);
  let currentRate = 0;
  if (recent.length > 1) {
    const dt = (recent[recent.length-1].timestamp - recent[0].timestamp) / 60000;
    const drop = recent[0].water_level - recent[recent.length-1].water_level;
    if (dt > 0) currentRate = Math.max(0, drop / dt);
  }

  const excess = currentRate - medianRate;
  const threshold = Math.max(0.5, medianRate * 2.0);
  if (excess < threshold) return NONE;

  const ratio = currentRate / Math.max(0.01, medianRate);
  const severity: LeakDetection['severity'] =
    ratio > 5 ? 'high' : ratio > 3 ? 'moderate' : 'low';

  const causes: string[] = [];
  if (severity === 'high') causes.push('Possible significant leakage');
  if (severity === 'moderate') causes.push('Possible pipe leakage or valve failure');
  causes.push('Sudden or unexpected high water usage');
  causes.push('Verify sensor and tank conditions');

  const dropPercent     = parseFloat((currentRate * 5).toFixed(1));
  const expectedDrop    = parseFloat((medianRate * 5).toFixed(1));
  const excessDropPct   = parseFloat((dropPercent - expectedDrop).toFixed(1));

  return {
    detected: true,
    severity,
    dropPercent,
    expectedDropPercent: expectedDrop,
    excessDropPercent: excessDropPct,
    possibleCauses: causes,
    action: 'Inspect tank and piping. Check valve positions. Verify sensor alignment.',
    confidence: Math.min(95, Math.round(60 + valid.length * 0.5)),
  };
}

// ============================================================
// 6. PUMP RECOMMENDATION
// ============================================================
export function recommendPump(
  currentLevel: number,
  prediction: PredictionResult,
  demand: DemandForecast,
  leak: LeakDetection,
  sensorHealth: SensorAnomalyResult,
  settings: AppSettings,
): PumpRecommendation {
  // Safety overrides
  if (currentLevel >= 95) return {
    action: 'OFF',
    reason: 'Tank is full. Pumping would cause overflow.',
    confidence: 100,
    safetyOverride: 'SAFETY: Tank at capacity.',
  };
  if (sensorHealth.healthScore < 40) return {
    action: 'MONITOR',
    reason: 'Sensor health is critically low. Cannot reliably determine tank status.',
    confidence: 60,
    safetyOverride: 'SAFETY: Unreliable sensor — manual inspection required.',
  };
  if (leak.detected && leak.severity === 'high') return {
    action: 'OFF',
    reason: 'High leak probability. Activating pump without fixing leak wastes water.',
    confidence: 80,
    safetyOverride: 'SAFETY: Possible major leak — do not pump.',
  };

  // AI scoring
  let score = 0;
  const reasons: string[] = [];

  if (currentLevel < settings.criticalLevel) { score += 40; reasons.push('current level is critical'); }
  else if (currentLevel < settings.warningLevel) { score += 20; reasons.push('current level is low'); }
  else if (currentLevel > settings.safeLevel) { score -= 20; reasons.push('current level is adequate'); }
  else if (currentLevel > 80) { score -= 30; reasons.push('current level is high'); }

  if (!prediction.insufficient && prediction.min60 != null) {
    if (prediction.min60 < settings.criticalLevel) { score += 30; reasons.push('predicted to reach critical in 60 min'); }
    else if (prediction.min60 < settings.warningLevel) { score += 15; reasons.push('predicted to reach warning in 60 min'); }
  }

  if (demand.nextHourDemand === 'high') { score += 15; reasons.push('next-hour demand is high'); }
  else if (demand.nextHourDemand === 'moderate') { score += 5; }

  if (prediction.trend === 'falling') { score += 10; }
  else if (prediction.trend === 'rising') { score -= 10; reasons.push('level is currently rising'); }

  if (leak.detected) { score -= 15; reasons.push('anomalous water loss detected'); }

  const action: PumpRecommendation['action'] =
    score >= 35 ? 'ON_RECOMMENDED' : score >= 10 ? 'MONITOR' : 'OFF';

  const topReasons = reasons.slice(0, 2).join(' and ');
  const reason = action === 'ON_RECOMMENDED'
    ? `Pump activation recommended because ${topReasons || 'water level is declining'}.`
    : action === 'MONITOR'
    ? `Monitor water levels — ${topReasons || 'conditions are changing'}.`
    : `Pump not needed. ${topReasons || 'Water level is sufficient'}.`;

  return {
    action,
    reason,
    confidence: Math.min(90, 50 + Math.abs(score)),
    safetyOverride: null,
  };
}

// ============================================================
// 7. VALIDATE SENSOR READING
// ============================================================
export function validateReading(
  distance_cm: number,
  history: SensorReading[],
  settings: AppSettings,
): { is_valid: boolean; water_level: number; confidence: number; reason?: string } {
  if (isNaN(distance_cm) || distance_cm < settings.minValidDistance || distance_cm > settings.maxValidDistance) {
    return {
      is_valid: false, water_level: 0, confidence: 0,
      reason: `Distance ${distance_cm}cm out of valid range [${settings.minValidDistance}–${settings.maxValidDistance}]cm`,
    };
  }

  const usableHeight = settings.tankHeight - settings.sensorOffset;
  const waterHeight  = Math.max(0, usableHeight - (distance_cm - settings.sensorOffset));
  const water_level  = Math.min(100, Math.max(0, (waterHeight / usableHeight) * 100));

  const recentLevels = history.slice(-20).filter(r => r.is_valid).map(r => r.water_level);
  const { isAnomaly, reason: anomalyReason, zscore } = detectSensorAnomaly(water_level, recentLevels);

  if (isAnomaly) {
    return { is_valid: false, water_level, confidence: 20, reason: anomalyReason };
  }

  const conf = recentLevels.length < 5
    ? 70
    : Math.min(99, Math.round(90 + Math.min(9, recentLevels.length * 0.2) - zscore * 5));

  return { is_valid: true, water_level, confidence: conf };
}
