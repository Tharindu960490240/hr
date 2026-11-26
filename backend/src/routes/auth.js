import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { config } from '../config.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, badRequest } from '../lib/http.js';
import { sendMail } from '../lib/mailer.js';
import { newResetToken, hashToken } from '../lib/tokens.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

export const passwordSchema = z
  .string()
  .min(8, 'must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'must contain a capital letter (A–Z)')
  .regex(/[a-z]/, 'must contain a small letter (a–z)')
  .regex(/[0-9]/, 'must contain a number (0–9)')
  .regex(/[^A-Za-z0-9]/, 'must contain a symbol, e.g. @ $ ! % * ? &');

export const ME_SQL = `
  SELECT e.id, e.emp_code, e.email, e.role, e.full_name, e.branch_id, e.avatar_path IS NOT NULL AS has_avatar,
         d.name AS department, g.name AS designation, b.name AS branch
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN designations g ON g.id = e.designation_id
  LEFT JOIN branches b ON b.id = e.branch_id
  WHERE e.id = $1`;

router.post(
  '/login',
  limiter,
  validate(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) })),
  async (req, res) => {
    const { email, password } = req.body;
    const emp = await one('SELECT id, role, password_hash, is_active FROM employees WHERE email = $1', [email]);
    // same message for unknown email and wrong password, so accounts can't be discovered
    const ok = emp && (await bcrypt.compare(password, emp.password_hash));
    if (!ok) throw new HttpError(401, 'Email or password is incorrect');
    if (!emp.is_active) throw new HttpError(403, 'Your account has been deactivated. Please contact HR.');
    res.json({ token: signToken(emp), user: await one(ME_SQL, [emp.id]) });
  },
);

router.get('/me', requireAuth, async (req, res) => {
  res.json(await one(ME_SQL, [req.user.id]));
});

router.post(
  '/change-password',
  requireAuth,
  validate(z.object({ current: z.string().min(1), next: passwordSchema })),
  async (req, res) => {
    const emp = await one('SELECT id, role, password_hash FROM employees WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(req.body.current, emp.password_hash))) {
      throw badRequest('Your current password is incorrect');
    }
    if (req.body.current === req.body.next) throw badRequest('Choose a password different from the current one');
    await query(
      'UPDATE employees SET password_hash = $1, password_changed_at = now(), updated_at = now() WHERE id = $2',
      [await bcrypt.hash(req.body.next, 12), emp.id],
    );
    // other sessions are invalidated; hand back a fresh token for this one
    res.json({ message: 'Password changed', token: signToken(emp) });
  },
);

router.post(
  '/forgot-password',
  limiter,
  validate(z.object({ email: z.string().trim().email() })),
  async (req, res) => {
    const emp = await one('SELECT id, email, full_name FROM employees WHERE email = $1 AND is_active', [req.body.email]);
    if (emp) {
      const { token, hash } = newResetToken();
      await query(
        `UPDATE employees SET reset_token_hash = $1, reset_token_expires = now() + interval '30 minutes' WHERE id = $2`,
        [hash, emp.id],
      );
      sendMail({
        to: emp.email,
        subject: 'Reset your password',
        text: `Hi ${emp.full_name},\n\nUse this link within 30 minutes to choose a new password:\n${config.appUrl}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
      });
    }
    res.json({ message: 'If that email belongs to an active account, a reset link has been sent.' });
  },
);

router.post(
  '/reset-password',
  limiter,
  validate(z.object({ token: z.string().min(20), password: passwordSchema })),
  async (req, res) => {
    const emp = await one(
      `SELECT id FROM employees WHERE reset_token_hash = $1 AND reset_token_expires > now() AND is_active`,
      [hashToken(req.body.token)],
    );
    if (!emp) throw badRequest('This reset link is invalid or has expired. Please request a new one.');
    await query(
      `UPDATE employees SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL,
              password_changed_at = now(), updated_at = now() WHERE id = $2`,
      [await bcrypt.hash(req.body.password, 12), emp.id],
    );
    res.json({ message: 'Password updated. You can sign in now.' });
  },
);

export default router;
