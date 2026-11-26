import { Router } from 'express';
import { todayISO } from '../lib/dates.js';
import { many, one } from '../db/pool.js';
import { isAdmin, isManager } from '../lib/roles.js';
import { leaveBalance } from '../lib/leaveBalance.js';

const router = Router();

router.get('/', async (req, res) => {
  const me = req.user.id;
  const today = todayISO();
  const [tasks, dueSoon, myRequests, balance, reportToday, holidays, toReview] = await Promise.all([
    one(`SELECT count(*) FILTER (WHERE status = 'todo')::int AS todo,
                count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
                count(*) FILTER (WHERE status = 'done' AND completed_at > now() - interval '30 days')::int AS done_30d,
                count(*) FILTER (WHERE status <> 'done' AND due_date < $2)::int AS overdue
         FROM tasks WHERE assignee_id = $1`, [me, today]),
    many(`SELECT t.id, t.title, t.due_date, t.priority, t.status, p.name AS project
          FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
          WHERE t.assignee_id = $1 AND t.status <> 'done' AND t.due_date IS NOT NULL
          ORDER BY t.due_date LIMIT 6`, [me]),
    many(`SELECT id, kind, leave_type, start_date, end_date, status FROM requests
          WHERE employee_id = $1 AND end_date >= $2 AND status IN ('pending','approved') ORDER BY start_date LIMIT 5`, [me, today]),
    leaveBalance(me),
    one('SELECT id FROM work_reports WHERE employee_id = $1 AND work_date = $2', [me, today]),
    many(`SELECT DISTINCT h.holiday_date, h.reason FROM holidays h LEFT JOIN holiday_branches hb ON hb.holiday_id = h.id
          WHERE h.holiday_date >= $1 AND (hb.branch_id IS NULL OR hb.branch_id = $2) ORDER BY h.holiday_date LIMIT 4`, [today, req.user.branch_id]),
    one(`SELECT count(*)::int AS n FROM tasks WHERE reporter_id = $1 AND approval = 'pending'`, [me]),
  ]);
  const out = { tasks, due_soon: dueSoon, my_requests: myRequests, leave_balance: balance, reported_today: Boolean(reportToday), holidays, to_review: toReview.n };

  if (isManager(req.user)) {
    const scope = isAdmin(req.user) ? 'true' : 'e.reporter_id = $1';
    const [approvals, people, projects, outToday, weekly] = await Promise.all([
      one(`SELECT count(*)::int AS n FROM requests r JOIN employees e ON e.id = r.employee_id
           WHERE r.status = 'pending' AND r.employee_id <> $1 AND ${scope}`, [me]),
      one(`SELECT count(*) FILTER (WHERE is_active)::int AS active, count(*)::int AS total FROM employees`),
      one(`SELECT count(*) FILTER (WHERE status = 'active')::int AS active, count(*) FILTER (WHERE status = 'planned')::int AS planned,
                  count(*) FILTER (WHERE status = 'completed')::int AS completed FROM projects`),
      many(`SELECT e.full_name, r.kind, r.leave_type, r.end_date FROM requests r JOIN employees e ON e.id = r.employee_id
            WHERE r.status = 'approved' AND $1::date BETWEEN r.start_date AND r.end_date ORDER BY r.kind, e.full_name`, [today]),
      many(`SELECT d::date AS day,
                   (SELECT count(*)::int FROM work_reports w WHERE w.work_date = d::date) AS reports,
                   (SELECT count(*)::int FROM requests r WHERE r.status = 'approved' AND r.kind = 'leave' AND d::date BETWEEN r.start_date AND r.end_date) AS on_leave
            FROM generate_series($1::date - 13, $1::date, interval '1 day') d
            WHERE extract(isodow FROM d) < 6 ORDER BY d`, [today]),
    ]);
    out.manager = { pending_approvals: approvals.n, people, projects, out_today: outToday, weekly };
  }
  res.json(out);
});

export default router;
