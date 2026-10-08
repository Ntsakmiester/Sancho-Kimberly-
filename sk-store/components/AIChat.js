'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCart } from './CartProvider';
import { price } from '../lib/format';

const CHIPS = ['Track my order', 'What can I return?', 'What are your shipping options?', 'Help me find something'];
const toCards = (d) => [...(d.products || []).map((p) => ({ ...p, kind: 'product' })), ...(d.orders || []).map((o) => ({ ...o, kind: 'order' }))];

function ProductCard({ c }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const href = c.url || `/product/${c.slug}`;
  return (
    <div className="ai-card">
      {c.image ? <img src={c.image} alt="" /> : null}
      <div>
        <b><a href={href} className="ai-card-link">{c.name}</a></b>
        <div className="price">{price(c.effective_cents ?? c.price_cents)}</div>
        {c.in_stock
          ? c.add_to_cart
            ? <button className="btn ai-add" onClick={() => { cart.add({ slug: c.add_to_cart.slug, name: c.add_to_cart.name, size: c.add_to_cart.size, colour: c.add_to_cart.colour || '', price_cents: c.add_to_cart.price_cents, image: c.add_to_cart.image }); setAdded(true); setTimeout(() => setAdded(false), 1800); }}>{added ? 'Added \u2713' : `Add size ${c.add_to_cart.size}`}</button>
            : <a className="btn ai-add" href={href}>Choose size</a>
          : <span className="low">Out of stock right now</span>}
      </div>
    </div>
  );
}
function OrderCard({ c }) {
  return (
    <div className="ai-card">
      <div>
        <b>{c.ref}</b> <span className="status-pill">{c.status}</span>
        <div className="price">{c.total}</div>
        <div className="low">{(c.items || []).join(', ') || 'Order items'}</div>
      </div>
    </div>
  );
}
export default function AIChat({ signedIn, firstName }) {
  const pathname = usePathname() || '';
  if (pathname.startsWith('/admin') || pathname.startsWith('/owner') || pathname.startsWith('/login') || pathname.startsWith('/checkout')) return null;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [human, setHuman] = useState(false);
  const [name, setName] = useState('Assistant');
  const [proactive, setProactive] = useState(false);
  const [cid, setCid] = useState(null);
  const [err, setErr] = useState('');
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');
  const [hist, setHist] = useState(null);
  const [sugg, setSugg] = useState([]);
  const boxRef = useRef(null);
  const scroll = () => { requestAnimationFrame(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }); };
  useEffect(() => {
    if (!open) return;
    fetch('/api/ai/chat').then((r) => r.json()).then((d) => { setName(d.name || 'Assistant'); setProactive(!!d.proactive); }).catch(() => {});
  }, [open]);
  // Proactive nudge on product pages (45s), once per session, opt-out respected.
  useEffect(() => {
    if (!proactive || open || typeof window === 'undefined') return;
    if (!location.pathname.startsWith('/product')) return;
    try { if (localStorage.getItem('sk_ai_mute') || sessionStorage.getItem('sk_ai_nudged')) return; } catch (e) { return; }
    const t = setTimeout(() => {
      setOpen(true); sessionStorage.setItem('sk_ai_nudged', '1');
      setMsgs((m) => m.length ? m : [{ role: 'assistant', text: 'Hi! Can I help you find what you are looking for? I can check sizes, prices and stock for you.' }]);
    }, 45000);
    return () => clearTimeout(t);
  }, [proactive, open]);
  const send = async (text) => {
    text = (text || input).trim(); if (!text || busy) return;
    setErr(''); setNoteFor(null);
    setMsgs((m) => [...m, { role: 'user', text }]); setInput(''); setTyping(true); setBusy(true); setSugg([]); scroll();
    try {
      const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, conversation_id: cid }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 429) { setErr(d.message?.content || 'A moment please - you are sending messages very quickly.'); return; }
      if (d.error) throw new Error(d.error);
      if (d.conversationId) setCid(d.conversationId);
      if (d.handoff) setHuman(true);
      if (d.message?.content) setMsgs((m) => [...m, { role: 'assistant', id: d.message.id, text: d.message.content, cards: toCards(d) }]);
      if (Array.isArray(d.suggestions) && d.suggestions.length) setSugg(d.suggestions.slice(0, 3));
    } catch (e) { setErr('Sorry, the assistant is unavailable right now. Please try again.'); }
    finally { setTyping(false); setBusy(false); scroll(); }
  };
  const feedback = async (mid, rating, noteText) => {
    try { await fetch('/api/ai/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message_id: mid, rating, note: noteText || undefined }) }); } catch (e) { /* soft */ }
    setMsgs((m) => m.map((x) => (x.id === mid ? { ...x, feedback: rating } : x)));
    setNoteFor(null); setNote('');
  };
  const loadHist = async () => {
    if (hist) { setHist(null); return; }
    const d = await fetch('/api/ai/conversations').then((r) => r.json()).catch(() => ({ conversations: [] }));
    setHist(d.conversations || []);
  };
  const openConv = async (id) => {
    const d = await fetch(`/api/ai/conversations/${id}`).then((r) => r.json()).catch(() => null);
    if (d?.messages) {
      setMsgs(d.messages.map((m) => ({ role: m.role === 'customer' ? 'user' : 'assistant', id: m.role === 'assistant' ? m.id : undefined, text: m.content, cards: toCards(m), feedback: m.feedback || undefined })));
      setCid(id); setHuman(d.conversation?.status === 'HUMAN'); setHist(null); setSugg([]); scroll();
    }
  };
  const newConv = () => { setMsgs([]); setCid(null); setHuman(false); setHist(null); setErr(''); setSugg([]); };
  return (<>
    <button className="support-fab" aria-label="Chat with us" aria-expanded={open} onClick={() => setOpen(!open)}>&#128172;</button>
    {open && (
      <section className="support-panel ai-panel" aria-label={`${name} chat`}>
        <header>
          <div><b>{name}</b>{human && <span className="low"> · human support</span>}</div>
          <div className="ai-panel-actions">
            {signedIn && <button className="linklike low" onClick={loadHist}>{hist ? 'Hide' : 'History'}</button>}
            {msgs.length > 0 && <button className="linklike low" onClick={newConv}>New chat</button>}
            <button className="linklike" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
        </header>
        {hist && (
          <div className="ai-hist">
            {hist.length === 0 && <div className="low">No earlier conversations.</div>}
            {hist.map((h) => <button key={h.public_id} className="linklike ai-hist-row" onClick={() => openConv(h.public_id)}>
              {new Date(h.updated_at || h.created_at).toLocaleDateString('en-ZA')} · {h.title || (h.status === 'HUMAN' ? 'Human support' : 'Chat')}</button>)}
          </div>
        )}
        <div className="log" ref={boxRef} aria-live="polite">
          {msgs.length === 0 && (
            <div className="ai-empty">
              <p>Hi{signedIn && firstName ? ` ${firstName}` : ''}! I can help you find products, check stock, track orders and answer questions about the store.</p>
              <div className="ai-chips">{CHIPS.map((c) => <button key={c} className="ai-chip" onClick={() => send(c)}>{c}</button>)}</div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={m.id || i} className={`ai-msg ${m.role === 'user' ? 'ai-mine' : 'ai-theirs'}`}>
              <div className="bubble">{m.text}</div>
              {m.cards?.length > 0 && <div className="ai-cards">{m.cards.map((c, j) => c.kind === 'order' ? <OrderCard key={j} c={c} /> : <ProductCard key={j} c={c} />)}</div>}
              {m.role === 'assistant' && m.id && !human && (
                <div className="ai-fb">
                  {noteFor === m.id ? (
                    <span>
                      <input className="ai-note-input" placeholder="What was wrong? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
                      <button className="linklike" onClick={() => feedback(m.id, -1, note)}>Send</button>
                    </span>
                  ) : (<>
                    <button className="linklike" aria-label="Helpful" title="Helpful" onClick={() => feedback(m.id, 1)}>{m.feedback === 1 ? '👍✓' : '👍'}</button>
                    <button className="linklike" aria-label="Not helpful" title="Not helpful" onClick={() => (m.feedback === -1 ? feedback(m.id, -1) : setNoteFor(m.id))}>{m.feedback === -1 ? '👎✓' : '👎'}</button>
                  </>)}
                </div>
              )}
            </div>
          ))}
          {typing && <div className="ai-msg ai-theirs"><div className="bubble ai-typing"><span /><span /><span /></div></div>}
          {!typing && sugg.length > 0 && <div className="ai-chips" style={{ marginBottom: 8 }}>{sugg.map((s) => <button key={s} className="ai-chip" onClick={() => send(s)}>{s}</button>)}</div>}
          {err && <div className="low" style={{ color: '#b3261e' }}>{err}</div>}
        </div>
        <div className="ai-escrow">
          {!human && msgs.length > 0 && <button className="linklike low" onClick={() => send('Talk to a human')}>Talk to a human</button>}
          <button className="linklike low" title="Stop proactive help" onClick={() => { try { localStorage.setItem('sk_ai_mute', '1'); } catch (e) {} setProactive(false); }}>Mute</button>
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={human ? 'Message our team...' : 'Ask anything about the store...'} maxLength={500} aria-label="Message" />
          <button className="btn" disabled={busy || !input.trim()}>Send</button>
        </form>
      </section>
    )}
  </>);
}
