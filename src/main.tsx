import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.tsx'

// On desktop/laptop, add beautiful phone frame + branded background
const isCapacitorAndroid = () => {
  const cap = (window as any).Capacitor;
  return cap != null && typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android';
};

if (!isCapacitorAndroid()) {
  document.body.classList.add('web-desktop');
}

// Render the info panel beside the phone on desktop
const desktopPanel = document.createElement('div');
desktopPanel.className = 'desktop-info-panel';
desktopPanel.innerHTML = `
  <div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#0891b2,#06b6d4);display:flex;align-items:center;justify-content:center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2C12 2 5 10 5 14a7 7 0 0 0 14 0C19 10 12 2 12 2z"/></svg>
      </div>
      <span style="font-family:'Outfit',sans-serif;font-size:26px;font-weight:800;color:white;letter-spacing:-0.5px">AQUA AI</span>
    </div>
    <p style="font-size:14px;color:rgba(255,255,255,0.55);margin-bottom:16px">Intelligent Water Management System</p>
    <div class="info-tag">🌐 Web Edition</div>
  </div>
  <div>
    <div class="info-feature"><span>💧</span> Real-time water level monitoring</div>
    <div class="info-feature"><span>🤖</span> AI-powered predictions & forecasts</div>
    <div class="info-feature"><span>🔍</span> Leak detection & anomaly alerts</div>
    <div class="info-feature"><span>⚡</span> Smart pump intelligence</div>
    <div class="info-feature"><span>📊</span> Live analytics & charts</div>
    <div class="info-feature"><span>🖥️</span> Web Serial API (Chrome/Edge)</div>
  </div>
  <div>
    <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:14px 16px">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">DEMO CREDENTIALS</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.8">
        <strong style="color:white">Admin:</strong> admin / admin123<br>
        <strong style="color:white">User:</strong> user / user123
      </div>
    </div>
  </div>
`;

// We'll inject it next to the root after mount
const rootEl = document.getElementById('root')!;
const wrapper = document.createElement('div');
wrapper.className = 'web-page-layout';
wrapper.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;';
document.body.insertBefore(wrapper, rootEl);
wrapper.appendChild(rootEl);
wrapper.appendChild(desktopPanel);

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
