import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, notFound, badRequest } from '../lib/http.js';
import { notify } from '../lib/notify.js';
import { sendMail } from '../lib/mailer.js';
import { thisYear } from '../lib/dates.js';

/* ---------------- leave entitlements per employee type ---------------- */
export const leaveTypes = Router();

leaveTypes.get('/', async (_req, res) => {
  res.json(
    await many(`
      SELECT j.id AS job_type_id, j.name AS job_type,
             COALESCE(json_agg(json_build_object('id', l.id, 'name', l.name, 'days', l.days) ORDER BY l.name)
                      FILTER (WHERE l.id IS NOT NULL), '[]') AS types
      FROM job_types j LEFT JOIN leave_types l ON l.job_type_id = j.id
      GROUP BY j.id ORDER BY j.name`),
  );
});

/** Replace the full list of leave types for one employee type. */
leaveTypes.put(
  '/:jobTypeId',
  requireRole('Admin'),
  validate(
    z.object({
      types: z
        .array(z.object({ name: z.string().trim().min(1).max(60), days: z.coerce.number().min(0).max(365) }))
        .max(20)
        .refine((a) => new Set(a.map((t) => t.name.toLowerCase())).size === a.length, 'leave type names must be unique'),
    }),
  ),
  async (req, res) => {
    const jobTypeId = idParam(req, 'jobTypeId');
    if (req.body.types.some((t) => t.name.toLowerCase() === 'lieu leave')) {
      throw badRequest('"Lieu leave" is managed per employee, not per type');
    }
    await tx(async (c) => {
      const jt = await c.query('SELECT 1 FROM job_types WHERE id = $1', [jobTypeId]);
      if (!jt.rowCount) throw notFound('Employee type');
      await c.query('DELETE FROM leave_types WHERE job_type_id = $1', [jobTypeId]);
      for (const t of req.body.types) {
        await c.query('INSERT INTO leave_types(job_type_id, name, days) VALUES ($1,$2,$3)', [jobTypeId, t.name, t.days]);
      }
    });
    res.json({ message: 'Leave types saved' });
  },
);

/* ---------------- company holidays (mandatory leave) ---------------- */
export const holidays = Router();

holidays.get('/', async (req, res) => {
  const year = Number(req.query.year) || thisYear();
  res.json(
    await many(
      `SELECT h.id, h.holiday_date, h.reason, e.full_name AS created_by,
              COALESCE(json_agg(json_build_object('id', b.id, 'name', b.name)) FILTER (WHERE b.id IS NOT NULL), '[]') AS branches
       FROM holidays h
       LEFT JOIN holiday_branches hb ON hb.holiday_id = h.id
       LEFT JOIN branches b ON b.id = hb.branch_id
       LEFT JOIN employees e ON e.id = h.created_by
       WHERE extract(year FROM h.holiday_date) = $1
       GROUP BY h.id, e.full_name ORDER BY h.holiday_date`,
      [year],
    ),
  );
});

holidays.post(
  '/',
  requireRole('Admin'),
  validate(
    z.object({
      holiday_date: z.iso.date(),
      reason: z.string().trim().min(1, 'is required').max(300),
      branch_ids: z.array(z.coerce.number().int().positive()).default([]), // empty = all branches
    }),
  ),
  async (req, res) => {
    const { holiday_date, reason, branch_ids } = req.body;
    const created = await tx(async (c) => {
      // clash if another holiday on the same date covers any of the same branches (or all branches)
      const clash = await c.query(
        `SELECT 1 FROM holidays h LEFT JOIN holiday_branches hb ON hb.holiday_id = h.id
         WHERE h.holiday_date = $1 AND (hb.branch_id IS NULL OR cardinality($2::int[]) = 0 OR hb.branch_id = ANY($2))`,
        [holiday_date, branch_ids],
      );
      if (clash.rowCount) throw badRequest('There is already a holiday on that date for these branches');
      const h = (
        await c.query('INSERT INTO holidays(holiday_date, reason, created_by) VALUES ($1,$2,$3) RETURNING *', [
          holiday_date, reason, req.user.id,
        ])
      ).rows[0];
      for (const b of branch_ids) {
        await c.query('INSERT INTO holiday_branches(holiday_id, branch_id) VALUES ($1,$2)', [h.id, b]);
      }
      return h;
    });

    // tell EVERY active employee in the affected branches (the old code only told one per branch)
    const people = await many(
      `SELECT id, email FROM employees WHERE is_active AND (cardinality($1::int[]) = 0 OR branch_id = ANY($1))`,
      [branch_ids],
    );
    notify(people.map((p) => p.id), { title: 'Company holiday', body: `${holiday_date}: ${reason}`, link: '/holidays' });
    sendMail({
      to: people.map((p) => p.email),
      subject: `Company holiday on ${holiday_date}`,
      text: `The office will be closed on ${holiday_date}.\nReason: ${reason}`,
    });
    res.status(201).json(created);
  },
);

holidays.delete('/:id', requireRole('Admin'), async (req, res) => {
  const row = await one('DELETE FROM holidays WHERE id = $1 RETURNING id', [idParam(req)]);
  if (!row) throw notFound('Holiday');
  res.status(204).end();
});
