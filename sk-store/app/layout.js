import './globals.css';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getUser } from '../lib/auth';
import CartProvider from '../components/CartProvider';
import CartLink from '../components/CartLink';
import ServiceBanner from '../components/ServiceBanner';
export const metadata = { title: 'Sancho Kimberly', description: 'Streetwear from the kasi, delivered nationwide.' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default async function Root({ children }) {
  const user = await getUser({ headers: headers() });
  const customerSignedIn = user?.role === 'customer';
  return (
    <html lang="en">
      <body><CartProvider>
        <ServiceBanner />
        <header><div className="wrap">
          <Link className="logo" href="/"><img className="brandimg" src="/logo-word.png" alt="Sancho Kimberly" /></Link>
          <nav><Link href="/shop">Shop</Link><Link href={customerSignedIn ? '/account' : '/login'} aria-label={customerSignedIn ? 'My account' : 'Customer login'} title={customerSignedIn ? 'My account' : 'Customer login'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
          </Link><CartLink /></nav>
        </div></header>
        <main>{children}</main>
        <footer><div className="wrap"><img className="brandimg mono" src="/logo-mono.png" alt="SK monogram" /><br />Sancho Kimberly &nbsp;&nbsp; @sancho.kimberlyco on TikTok</div></footer>
      </CartProvider></body>
    </html>
  );
}
