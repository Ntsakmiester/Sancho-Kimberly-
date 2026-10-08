'use client';
import { useEffect, useState } from 'react';
export default function AIKeys() {
 const [keys,setKeys]=useState([]),[ready,setReady]=useState(false),[provider,setProvider]=useState('nvidia'),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const load=async()=>{const r=await fetch('/api/owner/ai/keys',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load keys.');setKeys(d.keys);setReady(d.encryption_ready);};
 useEffect(()=>{load().catch(()=>setStatus('Could not load key settings.'));},[]);
 const change=async(data)=>{setBusy(true);setStatus('');try{const r=await fetch('/api/owner/ai/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not update keys.');setValue('');await load();setStatus('Keys updated. New requests use the updated pool.');}catch(e){setStatus(e.message);}finally{setBusy(false);}};
 return <section style={{padding:'16px 0',maxWidth:620}} aria-label="AI provider keys">
  <h3>API keys</h3><p className="low">Only the owner can manage keys. Saved keys are encrypted on the server and shown only by their last four characters. Dashboard NVIDIA keys replace AI_API_KEYS when NVIDIA is primary; dashboard Gemini keys replace GEMINI_API_KEYS for backup. Removing all dashboard keys for a provider restores that provider's environment pool. Environment keys cannot be removed here.</p>
  {!ready && <p className="account-feedback">Before saving keys, set AI_KEY_ENCRYPTION_SECRET in Vercel to 64 random hex characters and redeploy. Keep that secret stable and backed up: changing it makes saved keys unreadable. Environment keys still work without it.</p>}
  <form className="office-form" onSubmit={e=>{e.preventDefault();change({action:'add',provider,value});}}>
   <label className="label">Provider<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="nvidia">NVIDIA (primary)</option><option value="gemini">Google Gemini (backup)</option></select></label>
   <label className="label">New API key(s)<input type="password" value={value} onChange={e=>setValue(e.target.value)} autoComplete="new-password" maxLength={22000} required placeholder="Full key, or comma-separated keys" /></label>
   <p className="low">{provider === 'gemini' ? 'Google AI Studio keys: standard AIza or newer auth AQ. keys. Paste the complete key only, without quotes. Saved keys still need provider verification with Test AI.' : 'NVIDIA keys start with nvapi-. Paste the complete key only.'}</p>
   <button className="btn" disabled={!ready||busy||!value.trim()}>Add keys</button>
  </form>
  <ul style={{paddingLeft:20}}>{keys.map(k=><li key={k.id} style={{margin:'12px 0'}}>{k.provider}: ••••{k.last4} <button type="button" className="ul" disabled={busy} onClick={()=>change({action:'remove',id:k.id})}>Remove</button></li>)}</ul>
  <p className="low" aria-live="polite">{status}</p>
 </section>;
}
