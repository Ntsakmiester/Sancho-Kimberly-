import './globals.css';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getUser } from '../lib/auth';
import CartProvider from '../components/CartProvider';
import CartLink from '../components/CartLink';
import { unreadCount } from '../lib/messages';
import ServiceBanner from '../components/ServiceBanner';
import AIChat from '../components/AIChat';
import NavDrawer from '../components/NavDrawer';
import pool from '../lib/db';

export const metadata = { title: 'Sancho Kimberly', description: 'Streetwear from the kasi, delivered nationwide.' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default async function Root({ children }) {
  const user = await getUser({ headers: headers() });
  const customerSignedIn = user?.role === 'customer';
  const unread = customerSignedIn ? await unreadCount(user.id).catch(() => 0) : 0;
  const menuCats = await pool.query('select name from categories where active order by position,name').then((r) => r.rows.map((x) => x.name)).catch(() => []);
  return (
    <html lang="en">
      <body><CartProvider>
        <ServiceBanner />
        <header><div className="wrap">
          <NavDrawer categories={menuCats} signedIn={customerSignedIn} />
          <Link className="logo" href="/"><img className="brandimg" src="/logo-word.png" alt="Sancho Kimberly" /></Link>
          <nav><Link href="/shop">Shop</Link><Link href={customerSignedIn ? '/account' : '/login'} aria-label={customerSignedIn ? 'My account' : 'Customer login'} title={customerSignedIn ? 'My account' : 'Customer login'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>{unread > 0 && <span className="badge" aria-label={`${unread} unread messages`}>{unread > 99 ? '99+' : unread}</span>}
          </Link><CartLink /></nav>
        </div></header>
        <main>{children}</main>
        <footer><div className="wrap"><img className="brandimg mono" src="/logo-mono.png" alt="SK monogram" /><br />Sancho Kimberly &nbsp;&nbsp; @sancho.kimberlyco on TikTok</div></footer>
        <AIChat signedIn={customerSignedIn} firstName={((user?.name || '').split(' ')[0]) || ''} />
      </CartProvider></body>
    </html>
  );
}
