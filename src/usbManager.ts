// ============================================================
// USB SERIAL BRIDGE
// 3 modes:
//   1. Web Serial API (Chrome/Edge on laptop — Arduino via USB)
//   2. Capacitor Android USB Host (phone + OTG)
//   3. Demo Simulator (no hardware)
// ============================================================

import { SensorReading, AppSettings, genId } from './storage';
import { validateReading } from './aiEngine';

// ── Sensor-error sentinel — returned instead of null so callers can surface it ──
export const SENSOR_ERROR_SENTINEL = 'SENSOR_ERROR';

// ============================================================
// SHARED LINE PARSER — handles both firmware formats:
//   New JSON: {"distance_cm":4.2,"water_height":2.1,"level":67,"target_height":6.3}
//   Old text: "Empty: 10.2 cm | Current: 5.1 cm | Water: 5.1 cm | Level: 81%"
//   Events:   "EMPTY DISTANCE: 10.2"  |  "NO ECHO"  |  "CONTAINER FULL - ..."
// ============================================================
function parseArduinoLine(
  line: string,
  history: SensorReading[],
  settings: AppSettings,
  emptyDistanceRef: { value: number },
): SensorReading | null {
  try {
    // ── Sensor-error lines — do NOT produce a data reading ─
    if (line === 'NO ECHO' || line.startsWith('SENSOR ERROR')) {
      return null;
    }

    // ── Calibration output: "EMPTY DISTANCE: 10.20" ────────
    // Record the emptyDistance reference for dashboard display
    if (line.startsWith('EMPTY DISTANCE:')) {
      const m = line.match(/EMPTY DISTANCE:\s*([\d.]+)/);
      if (m) emptyDistanceRef.value = parseFloat(m[1]);
      return null;  // Not a data reading — skip
    }

    // ── Informational lines (CONTAINER FULL, SWITCH OFF, …) ─
    if (!line.includes('Current:') && !line.startsWith('{')) return null;

    // ── Try JSON first (new firmware) ──────────────────────
    if (line.startsWith('{')) {
      const parsed = JSON.parse(line);
      if (parsed.event || parsed.error) return null;   // calibration / event, skip
      if (typeof parsed.distance_cm !== 'number') return null;

      // Always use the Arduino's own level calculation (from ultrasonic)
      // as the primary water_level — it's computed directly on the sensor.
      const arduinoLevel = typeof parsed.level === 'number'
        ? Math.min(100, Math.max(0, parsed.level))
        : 0;

      // Extract emptyDistance from JSON if provided
      if (typeof parsed.empty_distance === 'number' && parsed.empty_distance > 0) {
        emptyDistanceRef.value = parsed.empty_distance;
      }

      // Use a loose distance range so nothing gets wrongly dropped
      const looseSettings = {
        ...settings,
        minValidDistance: Math.min(settings.minValidDistance, 2),
        maxValidDistance: Math.max(settings.maxValidDistance, 400),
      };
      // Run AI validation for anomaly/confidence scoring only — don't override level
      const validated = validateReading(parsed.distance_cm, history, looseSettings);
      return {
        id: genId(),
        timestamp: Date.now(),
        distance_cm: parsed.distance_cm,
        water_level: arduinoLevel,          // ← direct from ultrasonic sensor
        empty_distance_cm: emptyDistanceRef.value > 0 ? emptyDistanceRef.value : undefined,
        is_valid: validated.is_valid,
        confidence: validated.confidence,
        is_anomaly: !validated.is_valid,
        anomaly_reason: validated.reason,
      } as SensorReading;
    }

    // ── Fallback: old plain-text firmware ──────────────────
    // Format: "Empty: 10.2 cm | Current: 5.1 cm | Water: 5.1 cm | Level: 81%"
    if (line.includes('Current:') && line.includes('Level:')) {
      const emptyMatch   = line.match(/Empty:\s*([\d.]+)\s*cm/);
      const currentMatch = line.match(/Current:\s*([\d.]+)\s*cm/);
      const waterMatch   = line.match(/Water:\s*([\d.]+)\s*cm/);
      const levelMatch   = line.match(/Level:\s*(\d+)%/);
      if (!currentMatch || !levelMatch) return null;

      const distance_cm = parseFloat(currentMatch[1]);
      const levelRaw    = Math.min(100, Math.max(0, parseInt(levelMatch[1], 10)));

      // Keep emptyDistance up-to-date from inline readings (each line contains it)
      if (emptyMatch) {
        const em = parseFloat(emptyMatch[1]);
        if (em > 0) emptyDistanceRef.value = em;
      }

      const looseSettings = {
        ...settings,
        minValidDistance: Math.min(settings.minValidDistance, 2),
        maxValidDistance: Math.max(settings.maxValidDistance, 400),
      };
      const validated = validateReading(distance_cm, history, looseSettings);
      return {
        id: genId(),
        timestamp: Date.now(),
        distance_cm,
        // Use levelRaw directly from Arduino — never let AI override the real reading
        water_level: levelRaw,
        empty_distance_cm: emptyDistanceRef.value > 0 ? emptyDistanceRef.value : undefined,
        water_height_cm: waterMatch ? parseFloat(waterMatch[1]) : undefined,
        is_valid: validated.is_valid,
        confidence: validated.confidence,
        is_anomaly: !validated.is_valid,
        anomaly_reason: validated.reason,
      } as SensorReading;
    }
  } catch {
    // Malformed line — ignore silently
  }
  return null;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type ReadingCallback = (reading: SensorReading) => void;
type StatusCallback  = (status: ConnectionStatus, msg?: string) => void;

// ---- Platform detection ----
function isCapacitorAndroid(): boolean {
  const cap = (window as any).Capacitor;
  return cap != null && typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android';
}

function hasWebSerial(): boolean {
  return 'serial' in navigator;
}

// ============================================================
// WEB SERIAL API (Chrome / Edge on laptop/desktop)
// ============================================================
class WebSerialBridge {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private running = false;
  private buffer  = '';
  private history: SensorReading[] = [];
  private emptyDistanceRef = { value: 0 };  // tracks calibration reference
  private onReading: ReadingCallback;
  private onStatus: StatusCallback;
  private settings: AppSettings;

  constructor(onReading: ReadingCallback, onStatus: StatusCallback, settings: AppSettings) {
    this.onReading = onReading;
    this.onStatus  = onStatus;
    this.settings  = settings;
  }

  async connect() {
    try {
      this.onStatus('connecting', 'Select Arduino port in the browser dialog…');
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      this.running = true;
      this.onStatus('connected', 'Arduino connected via USB (Web Serial)');
      // Get writer for sending commands
      if (this.port.writable) {
        this.writer = this.port.writable.getWriter();
      }
      this.readLoop(); // non-blocking — runs in background
    } catch (e: any) {
      if (e?.name === 'NotFoundError') {
        this.onStatus('disconnected', 'No port selected. Click "USB Arduino" to try again.');
      } else {
        this.onStatus('error', `Serial error: ${e?.message ?? String(e)}`);
      }
    }
  }

  private async readLoop() {
    // Use getReader() directly — avoids the pipeTo stream-lock bug
    const decoder = new TextDecoder();
    let buffer = '';
    let reader: any = null;
    try {
      reader = this.port.readable.getReader();
      this.reader = reader;
      while (this.running) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) this.parseLine(trimmed);
          }
        }
      }
    } catch (e: any) {
      if (this.running) {
        this.onStatus('disconnected', 'Arduino disconnected. Reconnect USB and click "USB Arduino".');
      }
    } finally {
      try { reader?.releaseLock(); } catch {}
    }
  }

  private parseLine(line: string) {
    const reading = parseArduinoLine(line, this.history, this.settings, this.emptyDistanceRef);
    if (!reading) return;
    this.history = [...this.history.slice(-100), reading];
    this.onReading(reading);
  }

  async sendCommand(cmd: string) {
    try {
      if (this.writer) {
        await this.writer.write(new TextEncoder().encode(cmd + '\n'));
      }
    } catch {}
  }

  async stop() {
    this.running = false;
    try { await this.reader?.cancel(); } catch {}
    try { this.reader?.releaseLock(); } catch {}
    try { await this.writer?.releaseLock(); } catch {}
    try { await this.port?.close(); } catch {}
    this.port = null; this.reader = null; this.writer = null;
  }

  updateSettings(s: AppSettings) { this.settings = s; }
}

// ============================================================
// DEMO SIMULATOR
// ============================================================
class DemoSimulator {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running      = false;
  private fillLevel    = 0;   // starts at 0, counts up to 100 then resets
  private history: SensorReading[] = [];
  private onReading: ReadingCallback;
  private settings: AppSettings;

  constructor(onReading: ReadingCallback, settings: AppSettings) {
    this.onReading = onReading;
    this.settings  = settings;
  }

  start() { this.fillLevel = 0; this.running = true; this.schedule(); }

  private schedule() {
    if (!this.running) return;
    this.timer = setTimeout(() => { this.emit(); this.schedule(); }, this.settings.readingInterval);
  }

  private emit() {
    // Advance level by 1 each tick: 0 → 1 → 2 → … → 100 → reset to 0
    this.fillLevel = this.fillLevel >= 100 ? 0 : this.fillLevel + 1;

    // Simulate distances matching Arduino formula:
    //   emptyDistance = tankHeight (sensor flush with empty container top)
    //   distance      = emptyDistance - waterHeight
    //   waterHeight   = (fillLevel/100) * targetHeight
    const targetHeight  = 6.3;  // Matches Arduino targetHeight constant
    const emptyDist     = this.settings.tankHeight;  // calibrated empty distance
    const waterH        = (this.fillLevel / 100) * targetHeight;
    const baseDist      = Math.max(0, emptyDist - waterH);
    const distance_cm   = parseFloat((baseDist + (Math.random() - 0.5) * 0.1).toFixed(2));

    const reading: SensorReading = {
      id: genId(),
      timestamp: Date.now(),
      distance_cm,
      // Exact integer level 0→100, no AI override
      water_level: this.fillLevel,
      empty_distance_cm: emptyDist,
      water_height_cm: parseFloat(waterH.toFixed(2)),
      is_valid: true,
      confidence: 99,
      is_anomaly: false,
      anomaly_reason: undefined,
    } as SensorReading;
    this.history = [...this.history.slice(-100), reading];
    this.onReading(reading);
  }

  updateSettings(s: AppSettings) { this.settings = s; }
  stop() { this.running = false; if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
}

// ============================================================
// ANDROID USB (Capacitor native plugin)
// ============================================================
class AndroidUSBBridge {
  private onReading: ReadingCallback;
  private onStatus: StatusCallback;
  private settings: AppSettings;
  private history: SensorReading[] = [];
  private emptyDistanceRef = { value: 0 };  // tracks calibration reference
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(onReading: ReadingCallback, onStatus: StatusCallback, settings: AppSettings) {
    this.onReading = onReading; this.onStatus = onStatus; this.settings = settings;
  }

  async connect() {
    try {
      this.onStatus('connecting', 'Requesting USB permission…');
      const plugins = (window as any).Capacitor?.Plugins;
      if (!plugins?.UsbSerial) throw new Error('UsbSerial plugin not available');
      const result = await plugins.UsbSerial.connect({ baudRate: 9600 });
      if (result?.success) {
        this.onStatus('connected', 'Arduino UNO connected via USB OTG');
        this.startPolling();
      } else {
        this.onStatus('error', result?.message ?? 'Failed to connect to Arduino');
      }
    } catch (e: any) {
      this.onStatus('error', `USB error: ${e?.message ?? String(e)}`);
    }
  }

  private startPolling() {
    this.pollTimer = setInterval(async () => {
      try {
        const plugins = (window as any).Capacitor?.Plugins;
        const result = await plugins.UsbSerial.read();
        if (result?.data) {
          for (const line of result.data.split('\n')) {
            const t = line.trim(); if (t) this.parseLine(t);
          }
        }
      } catch {
        this.onStatus('disconnected', 'Arduino disconnected. Reconnect USB cable.');
        this.stop();
      }
    }, this.settings.readingInterval);
  }

  private parseLine(line: string) {
    const reading = parseArduinoLine(line, this.history, this.settings, this.emptyDistanceRef);
    if (!reading) return;
    this.history = [...this.history.slice(-100), reading];
    this.onReading(reading);
  }

  async sendCommand(cmd: string) {
    try { await (window as any).Capacitor?.Plugins?.UsbSerial?.write({ data: cmd + '\n' }); } catch {}
  }

  stop() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }
}

// ============================================================
// Main USB Manager — auto-selects correct bridge
// ============================================================
export class UsbManager {
  private demo:      DemoSimulator | null = null;
  private webSerial: WebSerialBridge | null = null;
  private android:   AndroidUSBBridge | null = null;
  private onReading: ReadingCallback;
  private onStatus:  StatusCallback;
  private settings:  AppSettings;
  public  isDemoMode   = false;
  public  isWebSerial  = false;

  constructor(onReading: ReadingCallback, onStatus: StatusCallback, settings: AppSettings) {
    this.onReading = onReading;
    this.onStatus  = onStatus;
    this.settings  = settings;
  }

  async connect(mode: 'demo' | 'webserial' | 'android' | 'auto' = 'auto') {
    await this.disconnect();

    if (mode === 'demo' || this.settings.demoMode) {
      this.startDemo();
    } else if (mode === 'webserial' || (!isCapacitorAndroid() && hasWebSerial())) {
      this.isDemoMode  = false;
      this.isWebSerial = true;
      this.webSerial   = new WebSerialBridge(this.onReading, this.onStatus, this.settings);
      await this.webSerial.connect();
    } else if (mode === 'android' || isCapacitorAndroid()) {
      this.isDemoMode  = false;
      this.isWebSerial = false;
      this.android     = new AndroidUSBBridge(this.onReading, this.onStatus, this.settings);
      await this.android.connect();
    } else {
      this.startDemo();
    }
  }

  private startDemo() {
    this.isDemoMode  = true;
    this.isWebSerial = false;
    this.demo = new DemoSimulator(this.onReading, this.settings);
    this.demo.start();
    this.onStatus('connected', 'Demo simulation active — no hardware needed');
  }

  async disconnect() {
    this.demo?.stop();
    await this.webSerial?.stop();
    this.android?.stop();
    this.demo = null; this.webSerial = null; this.android = null;
    this.isDemoMode = false; this.isWebSerial = false;
  }

  async sendCommand(cmd: string) {
    await this.webSerial?.sendCommand(cmd);
    await this.android?.sendCommand(cmd);
  }

  updateSettings(s: AppSettings) {
    this.settings = s;
    this.demo?.updateSettings(s);
    this.webSerial?.updateSettings(s);
  }

  /** True if Web Serial is available (Chrome/Edge on laptop) */
  static hasWebSerial(): boolean { return hasWebSerial(); }
}
