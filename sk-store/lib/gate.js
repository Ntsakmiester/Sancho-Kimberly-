import { getServiceState, storefrontBlocked } from './service';
// Professional temporary-unavailability copy shown to customers only.
export async function storefrontGate() {
  const s = await getServiceState();
  if (!storefrontBlocked(s)) return null;
  return s.status === 'MAINTENANCE'
    ? 'We are doing a quick bit of maintenance. The store will be back shortly - please check back soon.'
    : 'Our store is temporarily unavailable. We apologise for the inconvenience - please check back soon.';
}
