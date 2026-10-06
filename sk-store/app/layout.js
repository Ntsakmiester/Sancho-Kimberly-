import './globals.css';
import Link from 'next/link';
import CartProvider from '../components/CartProvider';
import CartLink from '../components/CartLink';
import ServiceBanner from '../components/ServiceBanner';
export const metadata = { title: 'Sancho Kimberly', description: 'Streetwear from the kasi, delivered nationwide.' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function Root({ children }) {
  return (
    <html lang="en">
      <body><CartProvider>
        <ServiceBanner />
        <header><div className="wrap">
          <Link className="logo" href="/"><img className="brandimg" src="/logo-word.png" alt="Sancho Kimberly" /></Link>
          <nav><Link href="/shop">Shop</Link><CartLink /></nav>
        </div></header>
        <main>{children}</main>
        <footer><div className="wrap"><img className="brandimg mono" src="/logo-mono.png" alt="SK monogram" /><br />Sancho Kimberly &nbsp;&nbsp; @sancho.kimberlyco on TikTok</div></footer>
      </CartProvider></body>
    </html>
  );
}
