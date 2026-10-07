'use client';
import { useEffect, useRef } from 'react';
// Progressive enhancement: content is visible without JS; do not hide above-the-fold cards.
export default function ScrollReveal({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current, media = matchMedia('(prefers-reduced-motion: reduce)');
    if (!el || media.matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.remove('reveal-pending'); observer.unobserve(e.target); } }, { threshold: 0.08 });
    if (el.getBoundingClientRect().top >= innerHeight) { el.classList.add('reveal-pending'); observer.observe(el); }
    const reset = () => { if (media.matches) { el.classList.remove('reveal-pending'); observer.disconnect(); } };
    media.addEventListener('change', reset);
    return () => { observer.disconnect(); el.classList.remove('reveal-pending'); media.removeEventListener('change', reset); };
  }, []);
  return <div className="product-reveal" ref={ref}>{children}</div>;
}
