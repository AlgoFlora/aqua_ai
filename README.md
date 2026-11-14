# AQUA AI — Intelligent Water Level Monitoring System

> Real-time water tank monitoring with AI predictions, monthly reports, and role-based access.  
> Works as a **Web App** (Chrome/Edge via USB Web Serial) and **Android App** (via USB OTG cable).

---

## Table of Contents

1. [Hardware Requirements](#1-hardware-requirements)
2. [Wiring Diagram](#2-wiring-diagram)
3. [Arduino Setup & Firmware Upload](#3-arduino-setup--firmware-upload)
4. [Installing Dependencies (Web App)](#4-installing-dependencies-web-app)
5. [Running the Web App](#5-running-the-web-app)
6. [Building & Installing the Android APK](#6-building--installing-the-android-apk)
7. [Connecting via OTG (Android)](#7-connecting-via-otg-android)
8. [Connecting via USB (Web / Laptop)](#8-connecting-via-usb-web--laptop)
9. [Login Credentials](#9-login-credentials)
10. [Downloading Monthly Reports](#10-downloading-monthly-reports)
11. [How the Firmware Works](#11-how-the-firmware-works)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Hardware Requirements

| Component | Details |
|---|---|
| Arduino UNO | Any clone works |
| HC-SR04 Ultrasonic | Distance sensor |
| LCD 16×2 I2C | Address 0x27 (try 0x3F if display is blank) |
| Buzzer | Active buzzer, any rating |
| USB-A to USB-B cable | Arduino ↔ Laptop |
| USB OTG cable | Android phone ↔ Arduino |
| Jumper wires | Male-to-male and male-to-female |

---

## 2. Wiring Diagram

```
Arduino UNO
┌─────────────────────────────┐
│                             │
│  Pin 9   ──────── TRIG      │ HC-SR04
│  Pin 10  ──────── ECHO      │ Ultrasonic
│  5V      ──────── VCC       │ Sensor
│  GND     ──────── GND       │
│                             │
│  Pin 5   ──────── + (Buzzer)│
│  GND     ──────── - (Buzzer)│
│                             │
│  A4 (SDA)──────── SDA       │ LCD I2C
│  A5 (SCL)──────── SCL       │ 16×2
│  5V      ──────── VCC       │ Display
│  GND     ──────── GND       │
│                             │
└─────────────────────────────┘
```

> **Important:** Place the HC-SR04 sensor directly above the water tank opening, pointing down. The sensor should be approximately 3 cm above the maximum water level (top of tank).

---

## 3. Arduino Setup & Firmware Upload

### Step 1 — Install Arduino IDE
Download from: https://www.arduino.cc/en/software

### Step 2 — Install Required Library
Open Arduino IDE → **Tools → Manage Libraries** → search for:
- `LiquidCrystal I2C` by Frank de Brabander → Install

### Step 3 — Find Your LCD I2C Address
If the LCD shows nothing after upload, run an I2C scanner sketch first.  
Default address in the code is `0x27`. Change it to `0x3F` if needed:
```cpp
LiquidCrystal_I2C lcd(0x3F, 16, 2);   // ← change in firmware
```

### Step 4 — Upload the Firmware
1. Open `arduino/AquaAI_Firmware/AquaAI_Firmware.ino` in Arduino IDE
2. Select **Board → Arduino UNO**
3. Select the correct **Port** (e.g., COM3 on Windows, /dev/ttyUSB0 on Linux)
4. Click **Upload** (→ button)

### Step 5 — Verify in Serial Monitor
After upload, open **Tools → Serial Monitor**, set baud to `9600`.  
You should see JSON output like:
```json
{"distance_cm":5.20,"water_height":1.10,"level":17,"target_height":6.3}
```
If you see `NO_ECHO`, check sensor wiring.

---

## 4. Installing Dependencies (Web App)

**Prerequisites:** Node.js v18 or later — download from https://nodejs.org

```bash
# Navigate to the project folder
cd d:\IOT\aqua-ai

# Install all dependencies
npm install
```

---

## 5. Running the Web App

```bash
# Inside d:\IOT\aqua-ai
npm run dev
```

Open the browser at **http://localhost:5173**

> Use **Chrome** or **Edge** — Firefox does not support the Web Serial API required for USB Arduino connection.

---

## 6. Building & Installing the Android APK

### Prerequisites
- Android Studio installed (for building)
- OR use the pre-built APK: `D:\IOT\AquaAI.apk`

### Install pre-built APK on phone:
1. Enable **Developer Options → USB Debugging** on your phone
2. Connect phone to PC via USB (data cable)
3. Transfer `AquaAI.apk` to phone storage
4. Open file manager on phone → tap the APK → Install
5. If blocked: Settings → Security → **Install from Unknown Sources** → allow

### Build fresh APK (optional):
```bash
npm run build
npx cap sync android
# Then open android/ folder in Android Studio and build APK
```

---

## 7. Connecting via OTG (Android)

1. Install `AquaAI.apk` on your Android phone
2. Connect the **OTG cable** between your phone (USB-C or Micro-USB end) and the **Arduino UNO** (USB-B end)
3. Open the AquaAI app → Log in
4. On the Dashboard: tap **"Connect OTG"**
5. A permission dialog will appear — tap **Allow**
6. The status dot turns green and shows **"Arduino via USB OTG"**
7. Live data will start flowing within seconds

> If no dialog appears, unplug and replug the OTG cable, then tap Connect OTG again.

---

## 8. Connecting via USB (Web / Laptop)

1. Plug Arduino UNO into your **laptop USB port** via USB-A to USB-B cable
2. Open **Chrome** or **Edge** browser (not Firefox)
3. Go to **http://localhost:5173** (or wherever the app is hosted)
4. Log in → Dashboard → tap **"USB Arduino"**
5. A browser dialog asks to select a serial port → select the Arduino port (e.g., COM3)
6. Status turns green: **"Arduino via USB (Web Serial)"**

---

## 9. Login Credentials

| Role | Username | Password | Access |
|---|---|---|---|
| Admin | `admin` | `admin123` | Full access — all tabs, tank config, pump AI, live log |
| Society Member | `user` | `user123` | Dashboard, Analytics, Alerts, Download Report |

---

## 10. Downloading Monthly Reports

The report is available in two places:

1. **Dashboard** → "Download Monthly Report (.xlsx)" button (bottom of page)
2. **Analytics** → "Export .xlsx" button (top right of Analytics screen)

### What's in the Excel file?

**Sheet 1 — Daily Summary**
| Date | Avg Level (%) | Min Level (%) | Max Level (%) | Est. Usage (L) | Readings |
|---|---|---|---|---|---|
| 05 Nov 2026 | 72.4 | 58.0 | 88.0 | 12.3 | 1440 |

**Sheet 2 — Monthly Overview**
| Month | Days Tracked | Avg Level (%) | Est. Total Usage (L) | Total Readings |
|---|---|---|---|---|
| November 2026 | 5 | 68.2 | 61.5 | 7200 |

> Data is only from **real sensor readings** — no simulated or hardcoded data.

### On Android:
The file saves to your phone's **Documents** folder automatically.  
A toast notification confirms the save.

### On Web:
The browser downloads the file directly.

---

## 11. How the Firmware Works

- **Startup calibration:** Measures 20 readings of the empty tank → sets `emptyDistance`
- **Median filter:** Every reading takes 7 ultrasonic samples, sorts them, uses the **middle value** — this eliminates spikes and gives stable, non-fluctuating results
- **JSON output:** Each reading sent as `{"distance_cm":X,"water_height":Y,"level":Z,"target_height":6.3}`
- **LCD:** Shows `LEVEL: XX% AquaAI` on row 1, status on row 2
- **Buzzer:** 1 short beep on startup, 2 beeps when FULL
- **Full detection:** When level ≥ 100%, LCD shows "CONTAINER FULL" and buzzer alerts — then resumes monitoring once level drops below 90%

### Adjust for your tank:
In `AquaAI_Firmware.ino`, change:
```cpp
const float TARGET_HEIGHT = 6.3;   // ← set to your actual tank water capacity height in cm
```

---

## 12. Troubleshooting

| Problem | Solution |
|---|---|
| LCD is blank | Check I2C address — try 0x3F instead of 0x27 |
| No Serial JSON output | Check baud rate is 9600, check TRIG/ECHO wiring |
| Readings fluctuate | Sensor too close to edge — center it above water surface |
| "NO_ECHO" in Serial | Sensor not connected — check Pin 9 (TRIG) and Pin 10 (ECHO) |
| App says "Offline" on web | Must use Chrome or Edge — Firefox doesn't support Web Serial |
| OTG not detected | Enable "Install from Unknown Sources" and USB OTG permission |
| Download button greyed out | Need at least 1 reading — connect Arduino first |
| LCD address issue | Run I2C scanner: Tools → Examples → Wire → i2c_scanner |

---

## Project Structure

```
aqua-ai/
├── arduino/
│   └── AquaAI_Firmware/
│       └── AquaAI_Firmware.ino   ← Upload this to Arduino
├── src/
│   ├── main.tsx
│   ├── App.tsx                   ← Role-based navigation
│   ├── AppContext.tsx            ← State & AI engine bridge
│   ├── storage.ts                ← Data persistence (localStorage)
│   ├── usbManager.ts             ← USB Serial / OTG / Demo
│   ├── aiEngine.ts               ← AI prediction & leak detection
│   ├── reportExport.ts           ← Excel report generation
│   ├── components/
│   │   ├── BottomNav.tsx         ← Role-filtered navigation
│   │   └── WaterRing.tsx         ← Circular level indicator
│   └── screens/
│       ├── LoginScreen.tsx
│       ├── DashboardScreen.tsx   ← Admin + Member views
│       ├── AnalyticsScreen.tsx   ← Charts + Download
│       ├── PredictionScreen.tsx  ← AI forecasting (Admin)
│       ├── AlertsScreen.tsx
│       └── SettingsScreen.tsx    ← Admin only
└── android/                      ← Android (Capacitor) project
```
