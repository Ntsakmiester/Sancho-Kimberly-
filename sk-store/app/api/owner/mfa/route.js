import pool from '../../../../lib/db';
import { requireRole, verifyPassword, audit, ipOf, sha256 } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
import { rateLimit } from '../../../../lib/rate';
import { newSecret, matchingStep, encryptKey, decryptKey, recoveryCodes, recoveryHash, verifyOwnerMfa } from '../../../../lib/totp';
import QRCode from 'qrcode';
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(req) {
  const g = await requireRole(req, 'owner'); if (!g.user) return reply({ error: 'Forbidden.' }, g.status || 403);
  if (!(await rateLimit('mfa:' + g.user.id, 5, 300))) return reply({ error: 'Too many attempts. Wait five minutes.' }, 429);
  const b = await bodyOf(req);
  if (String(b.password || '').length > 200) return reply({ error: 'Password is too long.' }, 400);
  const u = (await pool.query('select * from users where id=$1', [g.user.id])).rows[0];
  if (!verifyPassword(String(b.password || ''), u.password_hash)) return reply({ error: 'Enter your current password.' }, 403);
  try {
    if (b.action === 'begin') {
      if (u.totp_enabled) return reply({ error: 'Two-step login is already enabled.' }, 409);
      const secret = newSecret();
      await pool.query("update users set totp_pending=$2,totp_pending_until=now()+interval '10 minutes' where id=$1 and not totp_enabled", [u.id, encryptKey(secret)]);
      const uri = 'otpauth://totp/' + encodeURIComponent('SK Store:' + u.email) + '?secret=' + secret + '&issuer=SK%20Store&algorithm=SHA1&digits=6&period=30';
      return reply({ secret, qr: await QRCode.toDataURL(uri, { width: 220, margin: 2 }) });
    }
    if (b.action === 'cancel') {
      await pool.query('update users set totp_pending=null,totp_pending_until=null where id=$1', [u.id]); return reply({ ok: true });
    }
    if (b.action === 'enable') {
      if (u.totp_enabled || !u.totp_pending || new Date(u.totp_pending_until) <= new Date()) return reply({ error: 'Start setup again. Setup expired or is already enabled.' }, 400);
      const step = matchingStep(decryptKey(u.totp_pending), String(b.code || '').trim());
      if (step == null) return reply({ error: 'That code did not match. Check the authenticator and try again.' }, 400);
      const codes = recoveryCodes();
      const updated = await pool.query('update users set totp_enabled=true,totp_secret=totp_pending,totp_last_step=$2,totp_pending=null,totp_pending_until=null,totp_recovery_hashes=$3 where id=$1 and totp_pending=$4 and totp_pending_until>now() and not totp_enabled returning id', [u.id, step, JSON.stringify(codes.map(recoveryHash)), u.totp_pending]);
      if (!updated.rowCount) return reply({ error: 'Setup changed. Start again.' }, 409);
      // Revoke other sessions; keep the current working session.
      const raw = ((req.headers.get('cookie') || '').match(/(?:^|;\s*)sk_session=([^;]+)/) || [])[1] || '';
      await pool.query('delete from sessions where user_id=$1 and token_hash<>$2', [u.id, sha256(raw)]);
      await audit('OWNER_MFA_ENABLED', { accountId: u.id, role: 'owner', ip: ipOf(req) });
      return reply({ ok: true, recovery_codes: codes });
    }
    if (b.action === 'disable') {
      if (!(await verifyOwnerMfa(u.id, String(b.code || '').trim(), { disable: true }))) return reply({ error: 'Enter a fresh authenticator code or an unused recovery code.' }, 400);
      await audit('OWNER_MFA_DISABLED', { accountId: u.id, role: 'owner', ip: ipOf(req) }); return reply({ ok: true });
    }
    return reply({ error: 'Unknown action.' }, 400);
  } catch (e) { return reply({ error: 'Could not update two-step login. Check that AI_KEY_ENCRYPTION_SECRET is configured and unchanged, then try again.' }, 400); }
}
