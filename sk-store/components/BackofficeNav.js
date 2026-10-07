'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
export default function BackofficeNav({ items, label }) {
  const pathname = usePathname();
  const ref = useRef(null);
  useEffect(() => { const nav = ref.current; const active = nav?.querySelector('[aria-current=page]'); if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, active.offsetLeft - nav.offsetLeft - 12); }, [pathname]);
  return <nav ref={ref} className="office-nav" aria-label={label}>{items.map(([href, text]) => {
    const root = href === '/admin/dashboard' || href === '/owner/dashboard';
    const active = root ? pathname === href : pathname === href || pathname.startsWith(href + '/');
    return <Link key={href} href={href} aria-current={active ? 'page' : undefined}>{text}</Link>;
  })}<form method="post" action="/api/auth/logout"><button className="office-logout">Log out</button></form></nav>;
}
