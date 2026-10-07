'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Checks the SERVER's verified status for a short while after returning from the payment page. The page itself never marks anything as paid.
export default function OrderPoll({ refCode }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(async () => {
      n++;
      try { const r = await fetch('/api/order-status?ref=' + encodeURIComponent(refCode), { cache: 'no-store' }); const d = await r.json(); if (d.payment_status && d.payment_status !== 'UNPAID') { clearInterval(t); router.refresh(); } } catch (e) {}
      if (n > 20) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [refCode, router]);
  return <p className="low">Checking your payment&hellip;</p>;
}
