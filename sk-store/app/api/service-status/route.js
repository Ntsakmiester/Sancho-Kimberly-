import { getServiceState, storefrontBlocked } from '../../../lib/service';
export const dynamic = 'force-dynamic';
// Public, non-sensitive storefront status for the customer-facing notice banner.
export async function GET() {
  const s = await getServiceState();
  return Response.json({ open: !storefrontBlocked(s), status: s.status });
}
