'use client';
import { useState } from 'react';
export default function OwnerMfa({ enabled, ready }) {
  const [active, setActive] = useState(enabled), [setup, setSetup] = useState(null), [codes, setCodes] = useState(null);
  const [password, setPassword] = useState(''), [code, setCode] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function act(action) {
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/owner/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, password, code }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Please try again.');
      if (action === 'begin') setSetup(data);
      if (action === 'cancel') { setSetup(null); setPassword(''); setCode(''); }
      if (action === 'enable') { setSetup(null); setActive(true); setCodes(data.recovery_codes); setPassword(''); setCode(''); setMessage('Two-step login is enabled. Save your recovery codes before leaving this page.'); }
      if (action === 'disable') { setActive(false); setCodes(null); setPassword(''); setCode(''); setMessage('Two-step login is disabled.'); }
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="card" style={{ marginBottom: 24, padding: 20, maxWidth: 620 }}>
    <h3>Owner two-step login</h3>
    <p>Optional extra protection: {active ? 'enabled' : 'off'}. When enabled, your password and an authenticator code are needed to log in.</p>
    {!ready && !active && <p className="err">Set AI_KEY_ENCRYPTION_SECRET in the server environment before setup. It encrypts the authenticator key; keep it safe and unchanged.</p>}
    {message && <p role="status">{message}</p>}
    {codes && <div><h4>Recovery codes</h4><p>Save these somewhere private. Each code works once instead of an authenticator code if you lose your phone. These codes are shown only now.</p><pre style={{ whiteSpace: 'pre-wrap' }}>{codes.join('\n')}</pre><button className="btn" onClick={() => { const blob = new Blob([codes.join('\n')], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'sk-store-recovery-codes.txt'; a.click(); URL.revokeObjectURL(url); }}>Download recovery codes</button><button className="btn" style={{ marginLeft: 8 }} onClick={() => setCodes(null)}>I saved them</button></div>}
    {!codes && <form onSubmit={e => { e.preventDefault(); act(active ? 'disable' : setup ? 'enable' : 'begin'); }} style={{ display: 'grid', gap: 10 }}>
      <label>Current password<input aria-label="Current password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {setup && <div><p>Scan this in an authenticator app, or enter the setup key manually. Setup expires after 10 minutes. Login remains unchanged until you confirm a code.</p><img src={setup.qr} width="220" height="220" alt="Authenticator setup QR code" /><p>Setup key: <code style={{ overflowWrap: 'anywhere' }}>{setup.secret}</code></p></div>}
      {(active || setup) && <label>{active ? 'Fresh authenticator code or unused recovery code' : 'Six-digit authenticator code'}<input aria-label="Authenticator code" autoComplete="one-time-code" required maxLength={32} value={code} onChange={e => setCode(e.target.value)} /></label>}
      <button className="btn" disabled={busy || (!ready && !active)}>{busy ? 'Please wait...' : active ? 'Disable two-step login' : setup ? 'Confirm and enable' : 'Set up two-step login'}</button>
      {setup && <button type="button" className="btn" disabled={busy} onClick={() => act('cancel')}>Cancel setup</button>}
    </form>}
    <p className="low">Never share setup keys or recovery codes. Password reset does not switch this protection off.</p>
  </section>;
}
