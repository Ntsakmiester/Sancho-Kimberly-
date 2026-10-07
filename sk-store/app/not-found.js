import Link from 'next/link';
export default function NotFound() {
  return <section className="wrap shop"><h2>Page not found</h2><p className="lead">That page does not exist.</p><Link className="btn" href="/shop">Back to the shop</Link></section>;
}
