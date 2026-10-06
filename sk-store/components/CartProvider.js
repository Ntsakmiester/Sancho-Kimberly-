'use client';
import { createContext, useContext, useEffect, useState } from 'react';
const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);
export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem('sk-cart') || '[]')); } catch (e) {} setReady(true); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem('sk-cart', JSON.stringify(items)); } catch (e) {} }, [items, ready]);
  const add = (it) => setItems((cur) => {
    const i = cur.findIndex((x) => x.slug === it.slug && x.size === it.size);
    if (i >= 0) { const n = [...cur]; n[i] = { ...n[i], qty: Math.min(10, n[i].qty + 1) }; return n; }
    return [...cur, { ...it, qty: 1 }];
  });
  const setQty = (slug, size, qty) => setItems((cur) => cur.map((x) => (x.slug === slug && x.size === size ? { ...x, qty: Math.max(1, Math.min(10, qty)) } : x)));
  const remove = (slug, size) => setItems((cur) => cur.filter((x) => !(x.slug === slug && x.size === size)));
  const clear = () => setItems([]);
  const count = items.reduce((n, x) => n + x.qty, 0);
  const subtotal = items.reduce((n, x) => n + x.qty * x.price_cents, 0);
  return <Ctx.Provider value={{ items, add, setQty, remove, clear, count, subtotal, ready }}>{children}</Ctx.Provider>;
}
