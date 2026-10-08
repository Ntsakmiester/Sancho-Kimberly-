'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
// Storefront hamburger menu: full-screen drawer with search and expandable categories.
// Categories come from the server (the categories table), so new ones appear here automatically.
export default function NavDrawer({ categories = [], signedIn = false }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const hidden = pathname.startsWith('/admin') || pathname.startsWith('/owner');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [shopOpen, setShopOpen] = useState(true);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; removeEventListener('keydown', onKey); };
  }, [open]);
  if (hidden) return null;
  const close = () => setOpen(false);
  const search = (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get('q').toString().trim().slice(0, 60);
    close();
    router.push(q ? '/shop?q=' + encodeURIComponent(q) : '/shop');
  };
  return (
    <>
      <button className="navburger" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && mounted && createPortal(
        <div className="drawer" role="dialog" aria-label="Menu">
          <div className="drawer-scrim" onClick={close} />
          <div className="drawer-panel">
            <header className="drawer-head">
              <form className="drawer-search" role="search" onSubmit={search}>
                <input name="q" placeholder="Search" aria-label="Search products" maxLength={60} autoFocus />
                <button type="button" className="drawer-close" onClick={close} aria-label="Close menu">&times;</button>
              </form>
            </header>
            <nav className="drawer-nav" aria-label="Store menu">
              <button className="drawer-section" onClick={() => setShopOpen((o) => !o)} aria-expanded={shopOpen}>
                SHOP <span className={shopOpen ? 'drawer-chev open' : 'drawer-chev'} aria-hidden="true" />
              </button>
              {shopOpen && (
                <div className="drawer-sub-inner">
                  <Link href="/shop" onClick={close}>All products</Link>
                  {categories.map((c) => <Link key={c} href={'/shop?cat=' + encodeURIComponent(c)} onClick={close}>{c}</Link>)}
                </div>
              )}
              <Link className="drawer-link" href={signedIn ? '/account' : '/login'} onClick={close}>{signedIn ? 'MY ACCOUNT' : 'SIGN IN'}</Link>
              <Link className="drawer-link" href="/cart" onClick={close}>CART</Link>
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
