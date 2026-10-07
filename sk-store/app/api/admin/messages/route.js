import { adminPost } from '../../../../lib/adminapi';
import { sendMessage } from '../../../../lib/messages';
import { ipOf } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';
// Owner and administrators only (staff cannot broadcast to customers). Redirects are same-origin paths from a fixed list.
const BACKS = ['/admin/dashboard/messages', '/owner/dashboard/messages'];
export const POST = adminPost(null, (b) => (BACKS.includes(b.back) ? b.back : '/admin/dashboard/messages'), async ({ req, g, b, ok, err }) => {
  if (!['owner', 'admin'].includes(g.user.role)) return err('Only the owner or an administrator can message customers.', 403);
  const n = await sendMessage({ to: b.to, email: b.email, subject: b.subject, body: b.body, by: g.user, ip: ipOf(req) });
  return ok(`Sent to ${n} customer${n === 1 ? '' : 's'}.`);
});
