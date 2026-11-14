// ============================================================
// REPORT EXPORT — Monthly Water Usage Reports
// Generates a 2-sheet Excel (.xlsx) file:
//   Sheet 1: Daily Summary  (one row per date)
//   Sheet 2: Monthly Summary (one row per month)
// Works on Web (browser download) and Android (Filesystem)
// ============================================================

import * as XLSX from 'xlsx';
import { SensorReading, AppSettings } from './storage';

// ── Types ────────────────────────────────────────────────────
export interface DailyRow {
  Date: string;
  'Avg Level (%)': number;
  'Min Level (%)': number;
  'Max Level (%)': number;
  'Est. Usage (L)': number;
  Readings: number;
}

export interface MonthlyRow {
  Month: string;
  'Days Tracked': number;
  'Avg Level (%)': number;
  'Est. Total Usage (L)': number;
  'Total Readings': number;
}

// ── Litre estimate ────────────────────────────────────────────
// 1% level change in a typical cylindrical overhead tank (0.5m dia, height from settings)
function pctToLitres(dropPct: number, settings: AppSettings): number {
  const r = 0.25;                             // 0.5m diameter → 0.25m radius
  const h = (settings.tankHeight / 100);      // cm → m
  // Volume of 1% = π * r² * h * 0.01
  const litresPerPct = Math.PI * r * r * h * 100 * 0.01;
  return parseFloat((dropPct * litresPerPct).toFixed(1));
}

// ── Date key helpers ──────────────────────────────────────────
function toDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toMonthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(key: string): string {
  const [y, m, day] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[parseInt(m) - 1]} ${y}`;
}

function formatMonth(key: string): string {
  const [y, m] = key.split('-');
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

// ── Build daily summary rows ──────────────────────────────────
export function buildDailySummary(
  readings: SensorReading[],
  settings: AppSettings,
): DailyRow[] {
  const valid = readings.filter(r => r.is_valid && !r.is_anomaly)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Group by date
  const byDate: Record<string, SensorReading[]> = {};
  for (const r of valid) {
    const key = toDateKey(r.timestamp);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  }

  return Object.keys(byDate).sort().map(dateKey => {
    const rows = byDate[dateKey];
    const levels = rows.map(r => r.water_level);
    const avg = parseFloat((levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1));
    const min = parseFloat(Math.min(...levels).toFixed(1));
    const max = parseFloat(Math.max(...levels).toFixed(1));

    // Usage = sum of all drops throughout the day
    let totalDrop = 0;
    for (let i = 1; i < rows.length; i++) {
      const drop = rows[i - 1].water_level - rows[i].water_level;
      if (drop > 0) totalDrop += drop;
    }

    return {
      Date: formatDate(dateKey),
      'Avg Level (%)': avg,
      'Min Level (%)': min,
      'Max Level (%)': max,
      'Est. Usage (L)': pctToLitres(totalDrop, settings),
      Readings: rows.length,
    };
  });
}

// ── Build monthly summary rows ────────────────────────────────
export function buildMonthlySummary(
  readings: SensorReading[],
  settings: AppSettings,
): MonthlyRow[] {
  const valid = readings.filter(r => r.is_valid && !r.is_anomaly)
    .sort((a, b) => a.timestamp - b.timestamp);

  const byMonth: Record<string, SensorReading[]> = {};
  for (const r of valid) {
    const key = toMonthKey(r.timestamp);
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(r);
  }

  return Object.keys(byMonth).sort().map(monthKey => {
    const rows = byMonth[monthKey];
    const levels = rows.map(r => r.water_level);
    const avg = parseFloat((levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1));

    // Count distinct days
    const days = new Set(rows.map(r => toDateKey(r.timestamp))).size;

    let totalDrop = 0;
    for (let i = 1; i < rows.length; i++) {
      const drop = rows[i - 1].water_level - rows[i].water_level;
      if (drop > 0) totalDrop += drop;
    }

    return {
      Month: formatMonth(monthKey),
      'Days Tracked': days,
      'Avg Level (%)': avg,
      'Est. Total Usage (L)': pctToLitres(totalDrop, settings),
      'Total Readings': rows.length,
    };
  });
}

// ── Style helpers for SheetJS ─────────────────────────────────
function applyHeaderStyle(ws: XLSX.WorkSheet, range: XLSX.Range) {
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cell]) continue;
    ws[cell].s = {
      font:      { bold: true, color: { rgb: 'FFFFFF' } },
      fill:      { fgColor: { rgb: '0891B2' } },
      alignment: { horizontal: 'center' },
    };
  }
}

// ── Main export function ──────────────────────────────────────
export function downloadExcelReport(
  readings: SensorReading[],
  settings: AppSettings,
  filename?: string,
): void {
  const daily   = buildDailySummary(readings, settings);
  const monthly = buildMonthlySummary(readings, settings);

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Daily Summary ────────────────────────────────
  const wsDaily = XLSX.utils.json_to_sheet(
    daily.length > 0 ? daily : [{ Date: 'No data', 'Avg Level (%)': 0, 'Min Level (%)': 0, 'Max Level (%)': 0, 'Est. Usage (L)': 0, Readings: 0 }]
  );
  const dailyRange = XLSX.utils.decode_range(wsDaily['!ref'] ?? 'A1');
  applyHeaderStyle(wsDaily, dailyRange);
  // Set column widths
  wsDaily['!cols'] = [
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Summary');

  // ── Sheet 2: Monthly Overview ─────────────────────────────
  const wsMonthly = XLSX.utils.json_to_sheet(
    monthly.length > 0 ? monthly : [{ Month: 'No data', 'Days Tracked': 0, 'Avg Level (%)': 0, 'Est. Total Usage (L)': 0, 'Total Readings': 0 }]
  );
  const monthlyRange = XLSX.utils.decode_range(wsMonthly['!ref'] ?? 'A1');
  applyHeaderStyle(wsMonthly, monthlyRange);
  wsMonthly['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Overview');

  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const name  = filename ?? `AquaAI_Water_Report_${month.replace(' ', '_')}.xlsx`;

  // ── Platform-aware download ───────────────────────────────
  const cap = (window as any).Capacitor;
  if (cap && cap.getPlatform() === 'android') {
    // Android: write to Downloads via Capacitor Filesystem
    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const plugins = cap.Plugins;
    if (plugins?.Filesystem) {
      plugins.Filesystem.writeFile({
        path: name,
        data: buf,
        directory: 'DOCUMENTS',
        encoding: 'base64',
      }).then(() => {
        if (plugins.Toast) plugins.Toast.show({ text: `Report saved: ${name}` });
      }).catch((e: any) => {
        console.error('Filesystem write failed', e);
        // Fallback: web download
        XLSX.writeFile(wb, name);
      });
    } else {
      XLSX.writeFile(wb, name);
    }
  } else {
    // Web: triggers browser download
    XLSX.writeFile(wb, name);
  }
}
