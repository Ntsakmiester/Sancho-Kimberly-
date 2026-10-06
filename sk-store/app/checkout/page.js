import { storefrontGate } from '../../lib/gate';
import CheckoutForm from '../../components/CheckoutForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout | Sancho Kimberly' };
export default async function Checkout() {
  const gateMsg = await storefrontGate();
  if (gateMsg) return <section className="wrap shop"><h2>Checkout unavailable</h2><div className="empty"><b>Temporarily unavailable</b><p>{gateMsg}</p></div></section>;
  return <CheckoutForm />;
}
