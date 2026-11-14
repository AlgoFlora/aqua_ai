import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  SensorReading, AppSettings, Alert,
  getReadings, saveReading, getSettings, saveSettings,
  getAlerts, saveAlert, acknowledgeAlert, clearAlerts, clearReadings,
  getStoredUser, login, logout, genId, AuthUser
} from './storage';
import {
  predictWaterLevel, forecastDemand, detectLeak,
  computeSensorHealth, recommendPump,
  PredictionResult, DemandForecast, LeakDetection,
  SensorAnomalyResult, PumpRecommendation
} from './aiEngine';
import { UsbManager, ConnectionStatus } from './usbManager';

interface AppContextType {
  user: AuthUser | null;
  doLogin: (u: string, p: string) => boolean;
  doLogout: () => void;
  connectionStatus: ConnectionStatus;
  connectionMsg: string;
  isDemoMode: boolean;
  isWebSerial: boolean;
  hasWebSerial: boolean;
  connectArduino: (mode?: 'demo' | 'webserial' | 'android' | 'auto') => void;
  disconnectArduino: () => void;
  sendCommand: (cmd: string) => void;
  latestReading: SensorReading | null;
  readings: SensorReading[];
  prediction: PredictionResult | null;
  demand: DemandForecast | null;
  leak: LeakDetection | null;
  sensorHealth: SensorAnomalyResult | null;
  pumpRec: PumpRecommendation | null;
  alerts: Alert[];
  unreadAlertCount: number;
  ackAlert: (id: string) => void;
  clearAllAlerts: () => void;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  resetHistory: () => void;
}

const AppContext = createContext<AppContextType | null>(null);
export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp must be inside AppProvider');
  return c;
}

const AI_INTERVAL_MS = 10000;

export function AppProvider({ children }: { children: ReactNode }) {
  // Always start at login — don't auto-restore session
  const [user, setUser]                   = useState<AuthUser | null>(null);
  const [connectionStatus, setConnStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionMsg, setConnMsg]       = useState('');
  const [isDemoMode, setIsDemoMode]       = useState(false);
  const [isWebSerial, setIsWebSerial]     = useState(false);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [readings, setReadings]           = useState<SensorReading[]>(() => getReadings(500));
  const [prediction, setPrediction]       = useState<PredictionResult | null>(null);
  const [demand, setDemand]               = useState<DemandForecast | null>(null);
  const [leak, setLeak]                   = useState<LeakDetection | null>(null);
  const [sensorHealth, setSensorHealth]   = useState<SensorAnomalyResult | null>(null);
  const [pumpRec, setPumpRec]             = useState<PumpRecommendation | null>(null);
  const [alerts, setAlerts]               = useState<Alert[]>(() => getAlerts());
  const [settings, setSettings]           = useState<AppSettings>(() => getSettings());

  const usbRef  = useRef<UsbManager | null>(null);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAI  = useRef<number>(0);

  const doLogin = useCallback((u: string, p: string): boolean => {
    const result = login(u, p);
    if (result) { setUser(result); return true; }
    return false;
  }, []);

  const doLogout = useCallback(() => {
    logout(); setUser(null);
    usbRef.current?.disconnect(); setConnStatus('disconnected');
  }, []);

  const getOrCreateUsb = useCallback((s: AppSettings) => {
    if (!usbRef.current) {
      usbRef.current = new UsbManager(
        (reading: SensorReading) => {
          saveReading(reading);
          setLatestReading(reading);
          setReadings(prev => [...prev, reading].slice(-1000));
        },
        (status: ConnectionStatus, msg?: string) => {
          setConnStatus(status);
          setConnMsg(msg ?? '');
          setIsDemoMode(usbRef.current?.isDemoMode ?? false);
          setIsWebSerial(usbRef.current?.isWebSerial ?? false);
        },
        s
      );
    }
    return usbRef.current;
  }, []);

  const connectArduino = useCallback((mode: 'demo' | 'webserial' | 'android' | 'auto' = 'auto') => {
    const mgr = getOrCreateUsb(settings);
    mgr.connect(mode).then(() => {
      setIsDemoMode(mgr.isDemoMode);
      setIsWebSerial(mgr.isWebSerial);
    });
  }, [settings, getOrCreateUsb]);

  const disconnectArduino = useCallback(() => {
    usbRef.current?.disconnect().then(() => {
      setConnStatus('disconnected'); setConnMsg('');
      setIsDemoMode(false); setIsWebSerial(false);
    });
  }, []);

  const sendCommand = useCallback((cmd: string) => {
    usbRef.current?.sendCommand(cmd);
  }, []);

  const runAI = useCallback(() => {
    const now = Date.now();
    if (now - lastAI.current < AI_INTERVAL_MS) return;
    lastAI.current = now;

    const allReadings    = getReadings(2000);
    const currentLevel   = latestReading?.water_level ?? 50;
    const currentSettings = getSettings();

    const pred   = predictWaterLevel(allReadings);
    const dem    = forecastDemand(allReadings);
    const lk     = detectLeak(allReadings);
    const health = computeSensorHealth(allReadings.slice(-200));
    const pump   = recommendPump(currentLevel, pred, dem, lk, health, currentSettings);

    setPrediction(pred); setDemand(dem); setLeak(lk); setSensorHealth(health); setPumpRec(pump);

    const newAlerts: Alert[] = [];
    if (currentLevel <= currentSettings.criticalLevel) {
      newAlerts.push({ id: genId(), timestamp: now, type: 'critical', category: 'level', acknowledged: false,
        title: 'Critical Water Level',
        description: `Water at ${currentLevel.toFixed(0)}% — below critical threshold of ${currentSettings.criticalLevel}%.`,
        action: 'Replenish water supply immediately.' });
      if (currentSettings.buzzerAlerts) sendCommand('ALERT_CRITICAL');
    } else if (currentLevel <= currentSettings.warningLevel) {
      newAlerts.push({ id: genId(), timestamp: now, type: 'warning', category: 'level', acknowledged: false,
        title: 'Low Water Level',
        description: `Water at ${currentLevel.toFixed(0)}% — approaching warning threshold.`,
        action: 'Monitor and prepare to replenish.' });
    }
    if (lk.detected && lk.severity !== 'none') {
      newAlerts.push({ id: genId(), timestamp: now,
        type: lk.severity === 'high' ? 'critical' : 'warning', category: 'leak', acknowledged: false,
        title: 'Possible Abnormal Water Loss',
        description: `Water dropped ${lk.dropPercent.toFixed(1)}% in 5 min vs expected ${lk.expectedDropPercent.toFixed(1)}%.`,
        action: lk.action });
      if (lk.severity === 'high' && currentSettings.buzzerAlerts) sendCommand('BUZZER_ON');
    }
    if (!pred.insufficient && pred.criticalETA != null && pred.criticalETA < 60) {
      newAlerts.push({ id: genId(), timestamp: now, type: 'warning', category: 'prediction', acknowledged: false,
        title: 'Critical Level Predicted Soon',
        description: `AI predicts critical level in ~${pred.criticalETA} minutes.`,
        action: 'Start water replenishment.' });
    }
    if (health.healthScore < 60) {
      newAlerts.push({ id: genId(), timestamp: now, type: 'warning', category: 'sensor', acknowledged: false,
        title: 'Sensor Health Degraded', description: health.explanation,
        action: 'Check sensor connections.' });
    }
    newAlerts.forEach(a => saveAlert(a));
    if (newAlerts.length > 0) setAlerts(getAlerts());
  }, [latestReading, sendCommand]);

  useEffect(() => {
    if (!latestReading) return;
    if (aiTimer.current) clearTimeout(aiTimer.current);
    aiTimer.current = setTimeout(runAI, 2000);
  }, [latestReading, runAI]);

  useEffect(() => {
    const stored = getReadings(500);
    if (stored.length > 0) { setReadings(stored); setTimeout(runAI, 1000); }
  }, []);

  const updateSettings = useCallback((delta: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...delta };
      saveSettings(next); usbRef.current?.updateSettings(next); return next;
    });
  }, []);

  const resetHistory = useCallback(() => {
    clearReadings(); clearAlerts();
    setReadings([]); setAlerts([]); setLatestReading(null);
    setPrediction(null); setPumpRec(null); setLeak(null); setSensorHealth(null); setDemand(null);
  }, []);

  const ackAlert = useCallback((id: string) => { acknowledgeAlert(id); setAlerts(getAlerts()); }, []);
  const clearAllAlerts = useCallback(() => { clearAlerts(); setAlerts([]); }, []);
  const unreadAlertCount = alerts.filter(a => !a.acknowledged).length;

  const ctx: AppContextType = {
    user, doLogin, doLogout,
    connectionStatus, connectionMsg, isDemoMode, isWebSerial,
    hasWebSerial: UsbManager.hasWebSerial(),
    connectArduino, disconnectArduino, sendCommand,
    latestReading, readings,
    prediction, demand, leak, sensorHealth, pumpRec,
    alerts, unreadAlertCount, ackAlert, clearAllAlerts,
    settings, updateSettings, resetHistory,
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}
