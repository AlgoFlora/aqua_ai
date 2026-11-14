// ============================================================
// LOCAL STORAGE LAYER — AquaAI Data Persistence
// ============================================================

export interface SensorReading {
  id: string;
  timestamp: number;
  distance_cm: number;
  water_level: number;
  empty_distance_cm?: number;  // Reference calibration distance (emptyDistance from Arduino)
  water_height_cm?: number;    // Directly extracted from Arduino output: emptyDistance - distance
  is_valid: boolean;
  confidence: number;
  is_anomaly: boolean;
  anomaly_reason?: string;
}

export interface AppSettings {
  tankHeight: number;
  sensorOffset: number;
  minValidDistance: number;
  maxValidDistance: number;
  criticalLevel: number;
  warningLevel: number;
  safeLevel: number;
  readingInterval: number;
  buzzerAlerts: boolean;
  aiRecommendations: boolean;
  demoMode: boolean;
  dataRetentionDays: number;
}

export interface Alert {
  id: string;
  timestamp: number;
  type: 'critical' | 'warning' | 'info';
  category: 'leak' | 'sensor' | 'level' | 'prediction' | 'connection';
  title: string;
  description: string;
  action?: string;
  acknowledged: boolean;
}

export interface AuthUser {
  username: string;
  role: 'admin' | 'user';
  name: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  tankHeight: 7,           // 7 cm physical tank height
  sensorOffset: 3,         // sensor is 3 cm above top of tank (10cm from bottom - 7cm tank)
  minValidDistance: 2,     // min readable distance (sensor can't read < 2cm)
  maxValidDistance: 12,    // max plausible distance (empty tank + margin)
  criticalLevel: 20,       // ≤20% = ~1.4cm water → pump should be ON
  warningLevel: 40,        // ≤40% = ~2.8cm water → Warning
  safeLevel: 60,           // >60% = ~4.2cm+ water → Safe
  readingInterval: 500,    // match Arduino's 500ms send interval
  buzzerAlerts: true,
  aiRecommendations: true,
  demoMode: false,
  dataRetentionDays: 30,
};

const KEYS = {
  readings: 'aquaai_readings',
  settings: 'aquaai_settings',
  alerts: 'aquaai_alerts',
  user: 'aquaai_user',
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function getReadings(limit?: number): SensorReading[] {
  try {
    const raw = localStorage.getItem(KEYS.readings);
    const all: SensorReading[] = raw ? JSON.parse(raw) : [];
    const sorted = all.sort((a, b) => a.timestamp - b.timestamp);
    return limit ? sorted.slice(-limit) : sorted;
  } catch { return []; }
}

export function saveReading(reading: SensorReading): void {
  try {
    const all = getReadings();
    all.push(reading);
    const settings = getSettings();
    const cutoff = Date.now() - settings.dataRetentionDays * 24 * 60 * 60 * 1000;
    const pruned = all.filter(r => r.timestamp > cutoff);
    // Keep max 5000 readings to avoid storage overflow
    const final = pruned.slice(-5000);
    localStorage.setItem(KEYS.readings, JSON.stringify(final));
  } catch (e) {
    console.error('Failed to save reading', e);
  }
}

export function clearReadings(): void {
  localStorage.removeItem(KEYS.readings);
}

export function getValidReadings(limit?: number): SensorReading[] {
  return getReadings(limit).filter(r => r.is_valid && !r.is_anomaly);
}

export function getAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(KEYS.alerts);
    const all: Alert[] = raw ? JSON.parse(raw) : [];
    return all.sort((a, b) => b.timestamp - a.timestamp);
  } catch { return []; }
}

export function saveAlert(alert: Alert): void {
  try {
    const all = getAlerts();
    const recentSimilar = all.find(
      a => a.category === alert.category && a.title === alert.title &&
           Math.abs(a.timestamp - alert.timestamp) < 60000
    );
    if (recentSimilar) return;
    const updated = [alert, ...all].slice(0, 200);
    localStorage.setItem(KEYS.alerts, JSON.stringify(updated));
  } catch {}
}

export function acknowledgeAlert(id: string): void {
  try {
    const all = getAlerts();
    const updated = all.map(a => a.id === id ? { ...a, acknowledged: true } : a);
    localStorage.setItem(KEYS.alerts, JSON.stringify(updated));
  } catch {}
}

export function clearAlerts(): void {
  localStorage.removeItem(KEYS.alerts);
}

const USERS = [
  { username: 'admin', password: 'admin123', role: 'admin' as const, name: 'Administrator' },
  { username: 'user',  password: 'user123',  role: 'user'  as const, name: 'Water Operator' },
];

export function login(username: string, password: string): AuthUser | null {
  const u = USERS.find(u => u.username === username && u.password === password);
  if (!u) return null;
  const user: AuthUser = { username: u.username, role: u.role, name: u.name };
  localStorage.setItem(KEYS.user, JSON.stringify(user));
  return user;
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function logout(): void {
  localStorage.removeItem(KEYS.user);
}

export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
