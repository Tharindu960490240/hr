import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db/pool.js';
import { HttpError, forbidden } from '../lib/http.js';
import { atLeast } from '../lib/roles.js';

export function signToken(emp) {
  return jwt.sign({ sub: emp.id, role: emp.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** Verifies the bearer token and loads the current employee (so deactivation / role changes apply at once). */
export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next(new HttpError(401, 'Please sign in'));
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
  const emp = await one(
    `SELECT id, role, is_active, email, full_name, branch_id, password_changed_at FROM employees WHERE id = $1`,
    [payload.sub],
  );
  if (!emp || !emp.is_active) return next(new HttpError(401, 'Your account is not active'));
  // tokens issued before a password change are no longer valid
  if (payload.iat * 1000 < new Date(emp.password_changed_at).getTime() - 1000) {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
  req.user = emp;
  next();
}

export const requireRole = (role) => (req, _res, next) =>
  atLeast(req.user, role) ? next() : next(forbidden());
