'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
// Simple rule-based support assistant for the storefront. No AI, no server calls, no cost:
// every answer below is a fixed reply matched on keywords. Keep answers factual - only what the store actually does.

const TOPICS = ['Delivery', 'Track my order', 'Sizes', 'Returns & exchanges', 'Payment', 'Contact us'];
function answerFor(text, ship, contacts) {
  const t = text.toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));
  if (has('contact', 'human', 'person', 'whatsapp', 'email', 'phone', 'call', 'instagram', 'facebook', 'tiktok', 'reach', 'talk')) {
    if (contacts.length) return { text: 'You can reach Sancho Kimberly on any of these:', links: contacts };
    return { text: 'You can find Sancho Kimberly on TikTok @sancho.kimberlyco.' };
  }
  if (has('deliver', 'shipping', 'ship', 'arrive', 'how long', 'courier')) {
    if (ship) return { text: `Standard delivery is R${(ship.fee / 100).toFixed(0)} anywhere in South Africa${ship.freeOver != null ? `, free on orders over R${(ship.freeOver / 100).toFixed(0)}` : ''}. It takes about ${ship.min} to ${ship.max} working days.` };
    return { text: 'We deliver anywhere in South Africa. The exact fee and timing show at checkout before you pay.' };
  }
  if (has('track', 'where is my', 'order status', 'my order', 'status')) return { text: 'Right after checkout you get an order page link with live status. If you shopped while signed in, every order is also under Account, then Orders.' };
  if (has('size', 'fit', 'measure')) return { text: 'Tees come in S, M, L and XL. Beanies are one size. You pick the colour and size on the product page before adding to cart.' };
  if (has('return', 'exchange', 'refund', 'send back')) return { text: 'Changed your mind? Returns are free within 7 days of delivery.', links: contacts.length ? contacts : null, linksIntro: 'To start a return, contact us:' };
  if (has('pay', 'payment', 'card', 'eft', 'cash')) return { text: 'You pay online at checkout - the available payment options show on the payment step. Nothing is charged before you confirm.' };
  if (has('sign in', 'login', 'log in', 'password', 'account', 'register')) return { text: 'Tap the person icon at the top right to sign in or create an account. Forgot your password? There is a reset link on the sign-in page.' };
  if (has('hi', 'hello', 'hey', 'sawubona', 'dumela')) return { text: 'Hi! I can help with delivery, tracking your order, sizes, returns, payment and signing in. What do you need?' };
  return { text: 'I can help with delivery, tracking your order, sizes, returns, payment and signing in. Try one of the topics below.' };
}
export default function SupportChat({ shipping, contacts = [] }) {
  const pathname = usePathname() || '';
  const hidden = pathname.startsWith('/admin') || pathname.startsWith('/owner');
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ from: 'bot', text: 'Hi! Need a hand? Ask about delivery, your order, sizes, returns or payment.' }]);
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  useEffect(() => { if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [msgs, open]);
  if (hidden) return null;
  const ask = (q) => {
    const text = String(q || '').trim();
    if (!text) return;
    const a = answerFor(text, shipping, contacts);
    setMsgs((m) => [...m.slice(-30), { from: 'me', text }, { from: 'bot', text: a.text, links: a.links, linksIntro: a.linksIntro }]);
    setDraft('');
  };
  return (
    <>
      {open && (
        <section className="support-panel" role="dialog" aria-label="Store help">
          <header className="support-head"><strong>Need help?</strong><button className="support-close" onClick={() => setOpen(false)} aria-label="Close help">&times;</button></header>
          <div className="support-msgs" ref={listRef} aria-live="polite">
            {msgs.map((m, i) => (
              <p key={i} className={m.from === 'me' ? 'support-me' : 'support-bot'}>
                {m.text}
                {m.links && (
                  <span className="support-contact">
                    {m.linksIntro && <span className="support-contact-intro">{m.linksIntro}</span>}
                    {m.links.map((l) => <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"><span className="support-contact-label">{l.label}</span><span className="support-contact-value">{l.text}</span></a>)}
                  </span>
                )}
              </p>
            ))}
          </div>
          <div className="chips support-chips">{TOPICS.map((t) => <button key={t} type="button" onClick={() => ask(t)}>{t}</button>)}</div>
          <form className="support-form" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a question" aria-label="Type a question" maxLength={200} />
            <button className="btn" type="submit">Send</button>
          </form>
        </section>
      )}
      <button className="support-fab" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close help chat' : 'Open help chat'} aria-expanded={open}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
      </button>
    </>
  );
}
