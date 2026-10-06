'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
// Customer-facing notice when the owner suspends the storefront or runs maintenance.
// Never shown on owner/admin areas - those always keep working.
export default function ServiceBanner() {
  const path = usePathname() || '';
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (path.startsWith('/owner') || path.startsWith('/admin')) return;
    fetch('/api/service-status').then((r) => r.json()).then((d) => {
      if (d.open) setMsg('');
      else setMsg(d.status === 'MAINTENANCE'
        ? 'We are doing a quick bit of maintenance. The store will be back shortly.'
        : 'Our store is temporarily unavailable. Please check back soon.');
    }).catch(() => {});
  }, [path]);
  if (!msg || path.startsWith('/owner') || path.startsWith('/admin')) return null;
  return <div style={{ background: '#111', color: '#fff', textAlign: 'center', padding: '10px 16px', fontSize: 14 }}>{msg}</div>;
}
