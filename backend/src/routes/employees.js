import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { many, one, query } from '../db/pool.js';
import { config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { validate, patchOf, parse } from '../middleware/validate.js';
import { imageUpload, saveUpload, sendStored, removeStored } from '../middleware/upload.js';
import { idParam, notFound, forbidden, badRequest } from '../lib/http.js';
import { ROLES, isAdmin, isManager, atLeast } from '../lib/roles.js';
import { sendMail, mailEnabled } from '../lib/mailer.js';
import { newResetToken } from '../lib/tokens.js';
import { leaveBalance, LIEU } from '../lib/leaveBalance.js';
import { passwordSchema } from './auth.js';

const router = Router();

const str = (max = 200) => z.string().trim().max(max).optional().default('');
const optDate = z.iso.date().nullable().optional().or(z.literal('').transform(() => null));
const optId = z.coerce.number().int().positive().nullable().optional().or(z.literal('').transform(() => null));

const personal = {
  profile: z
    .object({
      dob: str(10), gender: str(20), national_id: str(30), marital_status: str(20),
      mobile: str(30), landline: str(30), personal_email: str(120),
      permanent_address: str(300), current_address: str(300), education: str(300), school: str(200),
    })
    .partial()
    .optional(),
  bank: z.object({ bank_name: str(100), account_name: str(120), branch: str(100), account_number: str(40) }).partial().optional(),
  emergency: z
    .object({ name: str(120), relationship: str(60), mobile: str(30), landline: str(30), email: str(120) })
    .partial()
    .optional(),
  social: z.object({ linkedin: str(200), facebook: str(200), whatsapp: str(40) }).partial().optional(),
};

const employment = {
  emp_code: z.string().trim().min(1, 'is required').max(30),
  email: z.string().trim().toLowerCase().email(),
  full_name: z.string().trim().min(1, 'is required').max(150),
  role: z.enum(ROLES).default('Employee'),
  reporter_id: optId,
  branch_id: optId,
  job_type_id: optId,
  department_id: optId,
  designation_id: optId,
  start_date: optDate,
  end_date: optDate,
};

const createSchema = z.object({ ...employment, ...personal, password: passwordSchema.optional() });
const updateSchema = patchOf(z.object({ ...employment, ...personal }));
const selfSchema = z.object({ full_name: employment.full_name.optional(), ...personal }).strict();

const DIRECTORY = `
  SELECT e.id, e.emp_code, e.full_name, e.email, e.role, e.is_active,
         e.department_id, d.name AS department, e.designation_id, g.name AS designation,
         e.branch_id, b.name AS branch, e.job_type_id, j.name AS job_type,
         e.reporter_id, r.full_name AS reporter, e.start_date,
         e.avatar_path IS NOT NULL AS has_avatar, e.profile->>'mobile' AS mobile
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN designations g ON g.id = e.designation_id
  LEFT JOIN branches b ON b.id = e.branch_id
  LEFT JOIN job_types j ON j.id = e.job_type_id
  LEFT JOIN employees r ON r.id = e.reporter_id`;

/** Can `actor` change role / grant `role` to someone? Only Super Admins manage admins. */
function assertCanAssignRole(actor, role, target) {
  const touchesAdmins = ['Admin', 'Super Admin'].includes(role) || ['Admin', 'Super Admin'].includes(target?.role);
  if (touchesAdmins && !atLeast(actor, 'Super Admin')) throw forbidden('Only a Super Admin can manage admin accounts');
}

/* -------- directory (everyone signed in: needed to pick assignees) -------- */
router.get('/', async (req, res) => {
  const { q, active } = req.query;
  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(e.full_name ILIKE $${params.length} OR e.email ILIKE $${params.length} OR e.emp_code ILIKE $${params.length})`);
  }
  if (active === 'true' || active === 'false') where.push(`e.is_active = ${active === 'true'}`);
  if (!isAdmin(req.user)) where.push('e.is_active'); // non-admins only see current staff
  res.json(await many(`${DIRECTORY} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY e.full_name`, params));
});

/* -------- CSV export (admin) -------- */
router.get('/export.csv', requireRole('Admin'), async (_req, res) => {
  const rows = await many(`${DIRECTORY} ORDER BY e.emp_code`);
  const cols = ['emp_code', 'full_name', 'email', 'role', 'is_active', 'department', 'designation', 'branch', 'job_type', 'reporter', 'start_date', 'mobile'];
  const esc = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  res.type('text/csv').attachment('employees.csv');
  res.send([cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n'));
});

/* -------- one employee -------- */
router.get('/:id', async (req, res) => {
  const id = idParam(req);
  const self = id === req.user.id;
  const row = await one(
    `SELECT x.*, e.end_date, e.lieu_days, e.profile, e.bank, e.emergency, e.social,
            e.id_front_path IS NOT NULL AS has_id_front, e.id_back_path IS NOT NULL AS has_id_back
     FROM (${DIRECTORY} WHERE e.id = $1) x JOIN employees e ON e.id = x.id`,
    [id],
  );
  if (!row) throw notFound('Employee');
  if (!self && !isAdmin(req.user)) {
    // colleagues & managers don't get bank / ID / home details
    delete row.bank;
    delete row.emergency;
    row.profile = { mobile: row.profile.mobile };
    if (!isManager(req.user)) delete row.lieu_days;
  }
  res.json(row);
});

router.post('/', requireRole('Admin'), validate(createSchema), async (req, res) => {
  const b = req.body;
  assertCanAssignRole(req.user, b.role);
  const invite = !b.password;
  const password = b.password || crypto.randomBytes(24).toString('base64url');
  const { token, hash } = newResetToken();
  const emp = await one(
    `INSERT INTO employees(emp_code, email, full_name, role, password_hash, reporter_id, branch_id, job_type_id,
        department_id, designation_id, start_date, end_date, profile, bank, emergency, social,
        reset_token_hash, reset_token_expires)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, CASE WHEN $17::text IS NULL THEN NULL ELSE now() + interval '72 hours' END)
     RETURNING id, emp_code, email, full_name, role`,
    [
      b.emp_code, b.email, b.full_name, b.role, await bcrypt.hash(password, 12), b.reporter_id ?? null,
      b.branch_id ?? null, b.job_type_id ?? null, b.department_id ?? null, b.designation_id ?? null,
      b.start_date ?? null, b.end_date ?? null, b.profile ?? {}, b.bank ?? {}, b.emergency ?? {}, b.social ?? {},
      invite ? hash : null,
    ],
  );
  const link = `${config.appUrl}/reset-password?token=${token}&welcome=1`;
  if (invite) {
    // passwords are never emailed; the person sets their own
    sendMail({
      to: emp.email,
      subject: 'Your Office HR account',
      text: `Hi ${emp.full_name},\n\nAn account has been created for you. Set your password here (valid for 72 hours):\n${link}\n\nYour sign-in email is ${emp.email}.`,
    });
  }
  res.status(201).json({ ...emp, ...(invite && !mailEnabled ? { invite_link: link } : {}) });
});

router.post('/:id/invite', requireRole('Admin'), async (req, res) => {
  const { token, hash } = newResetToken();
  const emp = await one(
    `UPDATE employees SET reset_token_hash = $2, reset_token_expires = now() + interval '72 hours'
     WHERE id = $1 AND is_active RETURNING email, full_name`,
    [idParam(req), hash],
  );
  if (!emp) throw notFound('Active employee');
  const link = `${config.appUrl}/reset-password?token=${token}&welcome=1`;
  sendMail({ to: emp.email, subject: 'Set your Office HR password', text: `Hi ${emp.full_name},\n\nSet your password here (valid for 72 hours):\n${link}` });
  res.json({ message: 'Invitation sent', ...(!mailEnabled ? { invite_link: link } : {}) });
});

router.patch('/:id', async (req, res) => {
  const id = idParam(req);
  const self = id === req.user.id;
  if (!isAdmin(req.user)) {
    if (!self) throw forbidden();
    // employees may edit only their personal details — never role, email, ID, reporting line
    return saveEmployee(id, parse(selfSchema, req.body), res);
  }
  const body = parse(updateSchema, req.body);
  const target = await one('SELECT id, role FROM employees WHERE id = $1', [id]);
  if (!target) throw notFound('Employee');
  if (body.role && body.role !== target.role) {
    if (self) throw forbidden('You cannot change your own role');
    assertCanAssignRole(req.user, body.role, target);
  }
  if (body.reporter_id === id) throw badRequest('An employee cannot report to themselves');
  await saveEmployee(id, body, res);
});

const SIMPLE_COLS = ['emp_code', 'email', 'full_name', 'role', 'reporter_id', 'branch_id', 'job_type_id', 'department_id', 'designation_id', 'start_date', 'end_date'];
const JSON_COLS = ['profile', 'bank', 'emergency', 'social'];

async function saveEmployee(id, body, res) {
  const sets = [];
  const params = [id];
  for (const c of SIMPLE_COLS) {
    if (body[c] !== undefined) {
      params.push(body[c]);
      sets.push(`${c} = $${params.length}`);
    }
  }
  for (const c of JSON_COLS) {
    if (body[c] !== undefined) {
      params.push(body[c]);
      sets.push(`${c} = ${c} || $${params.length}::jsonb`); // merge, so partial forms don't wipe other keys
    }
  }
  if (!sets.length) return res.json({ message: 'Nothing to update' });
  const row = await one(`UPDATE employees SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING id`, params);
  if (!row) throw notFound('Employee');
  res.json({ message: 'Saved' });
}

router.patch(
  '/:id/status',
  requireRole('Admin'),
  validate(z.object({ is_active: z.boolean() })),
  async (req, res) => {
    const id = idParam(req);
    if (id === req.user.id) throw badRequest('You cannot deactivate your own account');
    const target = await one('SELECT role FROM employees WHERE id = $1', [id]);
    if (!target) throw notFound('Employee');
    assertCanAssignRole(req.user, target.role, target);
    await query('UPDATE employees SET is_active = $2, updated_at = now() WHERE id = $1', [id, req.body.is_active]);
    res.json({ message: req.body.is_active ? 'Account activated' : 'Account deactivated' });
  },
);

router.delete('/:id', requireRole('Super Admin'), async (req, res) => {
  const id = idParam(req);
  if (id === req.user.id) throw badRequest('You cannot delete your own account');
  const row = await one('DELETE FROM employees WHERE id = $1 RETURNING avatar_path, id_front_path, id_back_path', [id]);
  if (!row) throw notFound('Employee');
  Object.values(row).forEach(removeStored);
  res.status(204).end();
});

/* -------- leave balance & lieu days -------- */
router.get('/:id/leave-balance', async (req, res) => {
  const id = idParam(req);
  if (id !== req.user.id && !isManager(req.user)) throw forbidden();
  res.json(await leaveBalance(id, Number(req.query.year) || undefined));
});

router.patch(
  '/:id/lieu',
  requireRole('Admin'),
  validate(z.object({ lieu_days: z.coerce.number().min(0).max(365) })),
  async (req, res) => {
    const id = idParam(req);
    const bal = await leaveBalance(id);
    const used = bal.find((b) => b.name === LIEU)?.used || 0;
    if (req.body.lieu_days < used) throw badRequest(`This person has already taken ${used} lieu day(s) this year`);
    const row = await one('UPDATE employees SET lieu_days = $2 WHERE id = $1 RETURNING id', [id, req.body.lieu_days]);
    if (!row) throw notFound('Employee');
    res.json({ message: 'Lieu leave updated' });
  },
);

/* -------- pictures: avatar + ID card scans -------- */
const canEditFiles = (req, id) => id === req.user.id || isAdmin(req.user);

router.post('/:id/avatar', imageUpload(), async (req, res) => {
  const id = idParam(req);
  if (!canEditFiles(req, id)) throw forbidden();
  if (!req.file) throw badRequest('Choose an image to upload');
  const old = await one('SELECT avatar_path FROM employees WHERE id = $1', [id]);
  if (!old) throw notFound('Employee');
  await query('UPDATE employees SET avatar_path = $2 WHERE id = $1', [id, await saveUpload(req.file, 'avatars')]);
  removeStored(old.avatar_path);
  res.json({ message: 'Photo updated' });
});

router.get('/:id/avatar', async (req, res) => {
  const row = await one('SELECT avatar_path FROM employees WHERE id = $1', [idParam(req)]);
  if (!row?.avatar_path) throw notFound('Photo');
  await sendStored(res, row.avatar_path);
});

const ID_COLS = { front: 'id_front_path', back: 'id_back_path' };

router.post('/:id/id-doc/:side', imageUpload(), async (req, res) => {
  const id = idParam(req);
  const col = ID_COLS[req.params.side];
  if (!col) throw notFound();
  if (!canEditFiles(req, id)) throw forbidden();
  if (!req.file) throw badRequest('Choose an image to upload');
  const old = await one(`SELECT ${col} AS p FROM employees WHERE id = $1`, [id]);
  if (!old) throw notFound('Employee');
  await query(`UPDATE employees SET ${col} = $2 WHERE id = $1`, [id, await saveUpload(req.file, 'id-docs')]);
  removeStored(old.p);
  res.json({ message: 'Document uploaded' });
});

router.get('/:id/id-doc/:side', async (req, res) => {
  const id = idParam(req);
  const col = ID_COLS[req.params.side];
  if (!col) throw notFound();
  if (!canEditFiles(req, id)) throw forbidden(); // ID scans: owner + admins only
  const row = await one(`SELECT ${col} AS p FROM employees WHERE id = $1`, [id]);
  if (!row?.p) throw notFound('Document');
  await sendStored(res, row.p, 'private, no-store');
});

export default router;
