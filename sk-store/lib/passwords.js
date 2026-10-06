import crypto from 'node:crypto';
// Password hashing: scrypt with per-password random salt (no plaintext, ever).
const N = 16384, r = 8, p = 1, LEN = 64;
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, LEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [alg, n, rr, pp, saltB64, keyB64] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const key = crypto.scryptSync(String(pw), Buffer.from(saltB64, 'base64'), LEN, { N: +n, r: +rr, p: +pp });
    return crypto.timingSafeEqual(key, Buffer.from(keyB64, 'base64'));
  } catch { return false; }
}
export const token = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
