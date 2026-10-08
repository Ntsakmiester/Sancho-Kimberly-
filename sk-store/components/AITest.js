'use client';
import { useState } from 'react';
export default function AITest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const test = async () => {
    if (busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const r = await fetch('/api/owner/ai/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Test could not run.');
      setResult(d);
    } catch (e) { setError(e.message || 'Test could not run.'); }
    finally { setBusy(false); }
  };
  return <section style={{ padding: '16px 0', maxWidth: 620 }} aria-label="AI connection test">
    <h3>Test AI connection</h3>
    <p className="low">Runs one small request with the first configured primary key. If it fails, tests the first Gemini backup key. Uses provider quota and may incur a small charge under your account's pricing. No customer data is sent and no keys are displayed.</p>
    <button type="button" className="btn" disabled={busy} onClick={test}>{busy ? 'Testing...' : 'Test AI'}</button>
    <div aria-live="polite">
      {error && <p className="low">{error}</p>}
      {result && <>
        <p>{result.ok ? `Connected: ${result.provider} / ${result.model}` : 'No provider answered. Fixed store answers remain available.'}</p>
        {result.attempts.map((a, i) => <div key={i} className="account-feedback" style={{ marginTop: 12, overflowWrap: 'anywhere' }}>
          <b>{a.provider} / {a.model || 'no model set'}</b>
          <p className="low">{a.keyCount} key(s) configured{a.status ? ` · HTTP ${a.status}` : ''}{a.ms != null ? ` · ${a.ms} ms` : ''}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{a.ok ? `Answer: ${a.reply}` : `Error: ${a.error}`}</p>
        </div>)}
      </>}
    </div>
  </section>;
}
