import { Router } from 'express';
import { todayISO } from '../lib/dates.js';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, notFound, forbidden, badRequest } from '../lib/http.js';
import { isManager } from '../lib/roles.js';

/* ---------------- daily work reports ---------------- */
export const workReports = Router();

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'use HH:MM');
const schema = z
  .object({
    work_date: z.iso.date(),
    time_in: time,
    time_out: time,
    rating: z.coerce.number().int().min(1).max(5),
    notes: z.string().trim().max(2000).default(''),
    items: z
      .array(
        z
          .object({
            start_time: time,
            end_time: time,
            task_id: z.coerce.number().int().positive().nullable().optional(),
            description: z.string().trim().min(1, 'describe what you worked on').max(500),
          })
          .refine((i) => i.end_time > i.start_time, { message: 'end must be after start', path: ['end_time'] }),
      )
      .min(1, 'add at least one activity')
      .max(40),
  })
  .refine((v) => v.time_out > v.time_in, { message: 'time out must be after time in', path: ['time_out'] });

const LIST = `
  SELECT w.*, e.full_name AS employee, e.emp_code, e.avatar_path IS NOT NULL AS has_avatar,
         (SELECT count(*)::int FROM work_report_items i WHERE i.report_id = w.id) AS item_count
  FROM work_reports w JOIN employees e ON e.id = w.employee_id`;

workReports.get('/', async (req, res) => {
  const employeeId = req.query.employee_id ? Number(req.query.employee_id) : req.user.id;
  if (employeeId !== req.user.id && !isManager(req.user)) throw forbidden();
  const params = [];
  const where = [];
  if (req.query.all === 'true' && isManager(req.user)) {
    /* every employee */
  } else {
    params.push(employeeId);
    where.push(`w.employee_id = $${params.length}`);
  }
  if (req.query.from) { params.push(req.query.from); where.push(`w.work_date >= $${params.length}`); }
  if (req.query.to) { params.push(req.query.to); where.push(`w.work_date <= $${params.length}`); }
  res.json(await many(`${LIST} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY w.work_date DESC, e.full_name LIMIT 500`, params));
});

workReports.get('/:id', async (req, res) => {
  const row = await one(`${LIST} WHERE w.id = $1`, [idParam(req)]);
  if (!row) throw notFound('Work report');
  if (row.employee_id !== req.user.id && !isManager(req.user)) throw forbidden();
  row.items = await many(
    `SELECT i.*, t.title AS task_title FROM work_report_items i LEFT JOIN tasks t ON t.id = i.task_id
     WHERE i.report_id = $1 ORDER BY i.start_time`,
    [row.id],
  );
  res.json(row);
});

async function checkDay(c, employeeId, date) {
  if (date > todayISO()) throw badRequest('You cannot report work for a future date');
  // inclusive range — the old code treated the last day of a leave as a work day
  const onLeave = await c.query(
    `SELECT 1 FROM requests WHERE employee_id = $1 AND kind = 'leave' AND status = 'approved'
       AND $2::date BETWEEN start_date AND end_date`,
    [employeeId, date],
  );
  if (onLeave.rowCount) throw badRequest("You're on approved leave that day");
}

async function saveItems(c, reportId, items) {
  await c.query('DELETE FROM work_report_items WHERE report_id = $1', [reportId]);
  for (const i of items) {
    await c.query(
      'INSERT INTO work_report_items(report_id, start_time, end_time, task_id, description) VALUES ($1,$2,$3,$4,$5)',
      [reportId, i.start_time, i.end_time, i.task_id ?? null, i.description],
    );
  }
}

workReports.post('/', validate(schema), async (req, res) => {
  const b = req.body;
  const id = await tx(async (c) => {
    await checkDay(c, req.user.id, b.work_date);
    const exists = await c.query('SELECT 1 FROM work_reports WHERE employee_id = $1 AND work_date = $2', [req.user.id, b.work_date]);
    if (exists.rowCount) throw badRequest('You already submitted a report for that day — edit it instead');
    const r = await c.query(
      `INSERT INTO work_reports(employee_id, work_date, time_in, time_out, rating, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.user.id, b.work_date, b.time_in, b.time_out, b.rating, b.notes],
    );
    await saveItems(c, r.rows[0].id, b.items);
    return r.rows[0].id;
  });
  res.status(201).json({ id, message: 'Work report saved' });
});

workReports.put('/:id', validate(schema), async (req, res) => {
  const id = idParam(req);
  const b = req.body;
  await tx(async (c) => {
    const row = (await c.query('SELECT employee_id, work_date FROM work_reports WHERE id = $1', [id])).rows[0];
    if (!row) throw notFound('Work report');
    if (row.employee_id !== req.user.id) throw forbidden();
    if (b.work_date !== row.work_date) throw badRequest('The date of a report cannot be changed');
    await c.query('UPDATE work_reports SET time_in = $2, time_out = $3, rating = $4, notes = $5 WHERE id = $1', [
      id, b.time_in, b.time_out, b.rating, b.notes,
    ]);
    await saveItems(c, id, b.items);
  });
  res.json({ message: 'Work report updated' });
});

workReports.delete('/:id', async (req, res) => {
  const row = await one('DELETE FROM work_reports WHERE id = $1 AND employee_id = $2 RETURNING id', [idParam(req), req.user.id]);
  if (!row) throw notFound('Work report');
  res.status(204).end();
});

/* ---------------- attendance for a day (managers) ---------------- */
export const attendance = Router();

attendance.get('/', requireRole('Manager'), async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : todayISO();
  const rows = await many(
    `SELECT e.id, e.emp_code, e.full_name, e.avatar_path IS NOT NULL AS has_avatar, b.name AS branch, d.name AS department,
            w.id AS report_id, w.time_in, w.time_out,
            r.kind AS request_kind, r.leave_type,
            EXISTS (SELECT 1 FROM holidays h LEFT JOIN holiday_branches hb ON hb.holiday_id = h.id
                    WHERE h.holiday_date = $1 AND (hb.branch_id IS NULL OR hb.branch_id = e.branch_id)) AS is_holiday,
            extract(isodow FROM $1::date) >= 6 AS is_weekend
     FROM employees e
     LEFT JOIN branches b ON b.id = e.branch_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN work_reports w ON w.employee_id = e.id AND w.work_date = $1
     LEFT JOIN LATERAL (
       SELECT kind, leave_type FROM requests
       WHERE employee_id = e.id AND status = 'approved' AND $1::date BETWEEN start_date AND end_date
       ORDER BY kind = 'leave' DESC LIMIT 1
     ) r ON true
     WHERE e.is_active AND (e.start_date IS NULL OR e.start_date <= $1) AND (e.end_date IS NULL OR e.end_date >= $1)
     ORDER BY e.full_name`,
    [date],
  );
  for (const r of rows) {
    r.status = r.is_holiday ? 'holiday'
      : r.is_weekend && !r.report_id ? 'weekend'
      : r.request_kind === 'leave' ? 'leave'
      : r.request_kind === 'wfh' ? (r.report_id ? 'wfh' : 'wfh_no_report')
      : r.report_id ? 'present' : 'no_report';
  }
  res.json({ date, rows });
});
