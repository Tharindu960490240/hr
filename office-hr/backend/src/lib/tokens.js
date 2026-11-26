import crypto from 'node:crypto';

export function newResetToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
