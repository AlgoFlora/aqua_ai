import React, { useState } from 'react';
import { useApp } from '../AppContext';

export default function LoginScreen() {
  const { doLogin } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (u = username, p = password) => {
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const ok = doLogin(u, p);
    setLoading(false);
    if (!ok) setError('Invalid username or password');
  };

  const demoLogin = (role: 'admin' | 'user') => {
    const creds = role === 'admin' ? ['admin','admin123'] : ['user','user123'];
    setUsername(creds[0]); setPassword(creds[1]);
    handleLogin(creds[0], creds[1]);
  };

  return (
    <div className="login-screen">
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header Art */}
      <div style={{ paddingTop: 60, textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 88, height: 88, borderRadius: 26,
          background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px', boxShadow: '0 8px 32px rgba(8,145,178,0.3)'
        }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2C12 2 5 10 5 14a7 7 0 0 0 14 0C19 10 12 2 12 2z"/>
            <path d="M8.5 14.5a3.5 3.5 0 0 0 7 0" opacity="0.6"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 36, fontWeight: 800, color: '#0e7490', letterSpacing: '-0.5px' }}>
          AQUA AI
        </h1>
        <p style={{ fontSize: 15, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
          Intelligent Water Management
        </p>
      </div>

      {/* Login Card */}
      <div style={{
        background: 'white', borderRadius: 24, padding: '28px 24px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)', border: '1px solid #e0f2fe'
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>Welcome back</h2>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Sign in to your account</p>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#991b1b' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Username */}
        <div className="input-group">
          <label className="input-label">Username</label>
          <div className="input-wrap">
            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <input className="input-field" type="text" placeholder="Enter username"
              value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" />
          </div>
        </div>

        {/* Password */}
        <div className="input-group">
          <label className="input-label">Password</label>
          <div className="input-wrap">
            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input className="input-field" type={showPass ? 'text' : 'password'} placeholder="Enter password"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ paddingRight: 48 }} />
            <button onClick={() => setShowPass(!showPass)} style={{
              position: 'absolute', right: 14, background: 'none', border: 'none',
              cursor: 'pointer', color: '#94a3b8', padding: 4
            }}>
              {showPass
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <input type="checkbox" id="remember" checked={remember} onChange={e => setRemember(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#0891b2' }} />
          <label htmlFor="remember" style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>Remember me</label>
        </div>

        {/* Login Button */}
        <button className="btn btn-primary btn-full" onClick={() => handleLogin()} disabled={loading}>
          {loading ? <><div className="spinner" /> Signing in...</> : 'Sign In'}
        </button>

        {/* Demo Access */}
        <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
          <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 12, fontWeight: 500 }}>
            DEMO ACCESS
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" style={{ flex: 1, padding: '10px' }} onClick={() => demoLogin('admin')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Admin Demo
            </button>
            <button className="btn btn-outline" style={{ flex: 1, padding: '10px' }} onClick={() => demoLogin('user')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              User Demo
            </button>
          </div>
          <div style={{ marginTop: 12, background: '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
            <strong>Admin:</strong> admin / admin123<br/>
            <strong>User:</strong> user / user123
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#94a3b8' }}>
        AQUA AI — Intelligent Water Management v1.0
      </div>
      </div>{/* inner wrapper */}
    </div>
  );
}
