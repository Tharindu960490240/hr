import { Router } from 'express';
import { todayISO } from '../lib/dates.js';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { idParam, notFound, forbidden, badRequest, conflict } from '../lib/http.js';
import { isAdmin, isManager } from '../lib/roles.js';
import { notify, adminIds } from '../lib/notify.js';
import { sendMail } from '../lib/mailer.js';
import { leaveBalance } from '../lib/leaveBalance.js';

/** Leave and work-from-home requests. */
const router = Router();

const LABEL = { leave: 'leave', wfh: 'work from home' };

const SELECT = `
  SELECT r.*, e.full_name AS employee, e.emp_code, e.reporter_id, e.avatar_path IS NOT NULL AS has_avatar, d.full_name AS decided_by_name,
         CASE WHEN r.kind = 'leave' THEN working_days(r.start_date, r.end_date, e.branch_id)
              ELSE (r.end_date - r.start_date + 1) END AS days
  FROM requests r
  JOIN employees e ON e.id = r.employee_id
  LEFT JOIN employees d ON d.id = r.decided_by`;

const bodySchema = z
  .object({
    kind: z.enum(['leave', 'wfh']),
    leave_type: z.string().trim().max(60).optional().nullable(),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
    reason: z.string().trim().min(3, 'please give a reason').max(1000),
  })
  .refine((v) => v.end_date >= v.start_date, { message: 'end date must be on or after the start date', path: ['end_date'] })
  .refine((v) => v.kind === 'wfh' || v.leave_type, { message: 'choose a leave type', path: ['leave_type'] });

/** Who may approve/reject a given request. */
function canDecide(user, reqRow) {
  if (reqRow.employee_id === user.id) return false; // never your own
  if (isAdmin(user)) return true;
  return isManager(user) && reqRow.reporter_id === user.id;
}

/** Overlap + balance checks shared by create and edit. */
async function checkRequest(c, employeeId, body, excludeId = 0) {
  const overlap = await c.query(
    `SELECT kind, start_date, end_date FROM requests
     WHERE employee_id = $1 AND id <> $2 AND status IN ('pending','approved')
       AND daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]') LIMIT 1`,
    [employeeId, excludeId, body.start_date, body.end_date],
  );
  if (overlap.rowCount) {
    const o = overlap.rows[0];
    throw conflict(`You already have a ${LABEL[o.kind]} request from ${o.start_date} to ${o.end_date}`);
  }
  if (body.kind !== 'leave') return;

  const emp = (await c.query('SELECT branch_id FROM employees WHERE id = $1', [employeeId])).rows[0];
  const days = (await c.query('SELECT working_days($1, $2, $3) AS d', [body.start_date, body.end_date, emp.branch_id])).rows[0].d;
  if (days === 0) throw badRequest('Those dates are all weekends or company holidays');

  const year = Number(body.start_date.slice(0, 4));
  if (Number(body.end_date.slice(0, 4)) !== year) throw badRequest('Please split leave that crosses into a new year into two requests');
  const balance = await leaveBalance(employeeId, year, c);
  const type = balance.find((b) => b.name === body.leave_type);
  if (!type) throw badRequest(`"${body.leave_type}" is not a leave type for your employment type`);
  // pending excludes the request being edited (it is re-counted below)
  let pending = type.pending;
  if (excludeId) {
    const prev = (await c.query(
      `SELECT working_days(start_date, end_date, $2) AS d FROM requests WHERE id = $1 AND status = 'pending' AND leave_type = $3`,
      [excludeId, emp.branch_id, body.leave_type],
    )).rows[0];
    pending -= prev?.d || 0;
  }
  const available = type.remaining - pending;
  if (days > available) {
    throw badRequest(`Not enough ${body.leave_type}: this request needs ${days} day(s), you have ${Math.max(available, 0)} available`);
  }
}

router.get('/', async (req, res) => {
  const { scope = 'mine', kind, status, from, to, employee_id } = req.query;
  const where = [];
  const params = [];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (scope === 'mine') add('r.employee_id = ?', req.user.id);
  else if (scope === 'approvals') {
    if (!isManager(req.user)) throw forbidden();
    if (!isAdmin(req.user)) add('e.reporter_id = ?', req.user.id);
    add('r.employee_id <> ?', req.user.id);
  } else throw badRequest('Unknown scope');
  if (kind) add('r.kind = ?', kind);
  if (status) add('r.status = ?', status);
  if (employee_id) add('r.employee_id = ?', Number(employee_id));
  if (from) add('r.end_date >= ?', from);
  if (to) add('r.start_date <= ?', to);
  res.json(await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY r.start_date DESC, r.id DESC LIMIT 500`, params));
});

router.post('/', validate(bodySchema), async (req, res) => {
  const b = req.body;
  const created = await tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [req.user.id]); // serialise per employee (no double-booking)
    await checkRequest(c, req.user.id, b);
    return (
      await c.query(
        `INSERT INTO requests(employee_id, kind, leave_type, start_date, end_date, reason)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [req.user.id, b.kind, b.kind === 'leave' ? b.leave_type : null, b.start_date, b.end_date, b.reason],
      )
    ).rows[0];
  });

  const row = await one(`${SELECT} WHERE r.id = $1`, [created.id]);
  const approvers = row.reporter_id ? [row.reporter_id] : await adminIds();
  notify(approvers, {
    title: `New ${LABEL[b.kind]} request`,
    body: `${row.employee}: ${b.start_date} → ${b.end_date}`,
    link: '/approvals',
  });
  if (config.mail.hrInbox) {
    sendMail({
      to: config.mail.hrInbox,
      replyTo: req.user.email,
      subject: `${row.employee} requested ${LABEL[b.kind]}`,
      text: `${row.employee} (${row.emp_code}) requested ${LABEL[b.kind]}${b.leave_type ? ` (${b.leave_type})` : ''}\nFrom: ${b.start_date}\nTo: ${b.end_date}\nReason: ${b.reason}\n\nReview: ${config.appUrl}/approvals`,
    });
  }
  res.status(201).json(row);
});

async function ownPending(req) {
  const row = await one(`${SELECT} WHERE r.id = $1`, [idParam(req)]);
  if (!row) throw notFound('Request');
  if (row.employee_id !== req.user.id) throw forbidden();
  if (row.status !== 'pending') throw badRequest(`This request is already ${row.status}`);
  return row;
}

router.patch('/:id', validate(bodySchema), async (req, res) => {
  const row = await ownPending(req);
  const b = req.body;
  if (b.kind !== row.kind) throw badRequest('You cannot change the request type; cancel it and create a new one');
  await tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [req.user.id]);
    await checkRequest(c, req.user.id, b, row.id);
    await c.query(
      `UPDATE requests SET leave_type = $2, start_date = $3, end_date = $4, reason = $5 WHERE id = $1 AND status = 'pending'`,
      [row.id, b.kind === 'leave' ? b.leave_type : null, b.start_date, b.end_date, b.reason],
    );
  });
  res.json(await one(`${SELECT} WHERE r.id = $1`, [row.id]));
});

router.delete('/:id', async (req, res) => {
  const row = await ownPending(req);
  await one('DELETE FROM requests WHERE id = $1', [row.id]);
  res.status(204).end();
});

router.post('/:id/cancel', validate(z.object({ reason: z.string().trim().min(3, 'please give a reason').max(500) })), async (req, res) => {
  const row = await one(`${SELECT} WHERE r.id = $1`, [idParam(req)]);
  if (!row) throw notFound('Request');
  const mine = row.employee_id === req.user.id;
  if (!mine && !isAdmin(req.user)) throw forbidden();
  if (!['pending', 'approved'].includes(row.status)) throw badRequest(`This request is already ${row.status}`);
  const today = todayISO();
  if (mine && !isAdmin(req.user) && row.status === 'approved' && row.start_date <= today) {
    throw badRequest('Leave that has already started can only be cancelled by HR');
  }
  await one(`UPDATE requests SET status = 'cancelled', cancel_reason = $2 WHERE id = $1`, [row.id, req.body.reason]);
  if (!mine) notify(row.employee_id, { title: `Your ${LABEL[row.kind]} was cancelled`, body: req.body.reason, link: '/requests' });
  else if (row.status === 'approved' && row.decided_by) {
    notify(row.decided_by, { title: `${row.employee} cancelled approved ${LABEL[row.kind]}`, body: req.body.reason, link: '/approvals' });
  }
  res.json({ message: 'Request cancelled' });
});

for (const action of ['approve', 'reject']) {
  router.post(
    `/:id/${action}`,
    validate(z.object({ note: action === 'reject' ? z.string().trim().min(3, 'please give a reason').max(500) : z.string().trim().max(500).optional() })),
    async (req, res) => {
      const row = await one(`${SELECT} WHERE r.id = $1`, [idParam(req)]);
      if (!row) throw notFound('Request');
      if (!canDecide(req.user, row)) throw forbidden('You cannot approve or reject this request');
      const status = action === 'approve' ? 'approved' : 'rejected';
      // status guard in WHERE: two approvers clicking at once can't both win
      const updated = await one(
        `UPDATE requests SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4
         WHERE id = $1 AND status = 'pending' RETURNING id`,
        [row.id, status, req.user.id, req.body.note || null],
      );
      if (!updated) throw conflict(`This request is already ${row.status}`);

      const what = LABEL[row.kind];
      notify(row.employee_id, {
        title: `Your ${what} request was ${status}`,
        body: `${row.start_date} → ${row.end_date}${req.body.note ? ` — ${req.body.note}` : ''}`,
        link: '/requests',
      });
      const emp = await one('SELECT email FROM employees WHERE id = $1', [row.employee_id]);
      sendMail({
        to: emp.email,
        subject: `Your ${what} request was ${status}`,
        text: `Your ${what} request for ${row.start_date} to ${row.end_date} was ${status} by ${req.user.full_name}.${req.body.note ? `\nNote: ${req.body.note}` : ''}`,
      });
      res.json(await one(`${SELECT} WHERE r.id = $1`, [row.id]));
    },
  );
}

export default router;
