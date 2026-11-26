import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { validate, patchOf } from '../middleware/validate.js';
import { idParam, notFound, forbidden, badRequest } from '../lib/http.js';
import { isAdmin, isManager } from '../lib/roles.js';
import { notify } from '../lib/notify.js';
import { loadProject } from './projects.js';

/**
 * One model for project tasks, one-time tasks, repeating tasks and sub-tasks (up to 3 levels).
 * Replaces the old copy-pasted level_two / level_three schemas.
 */
const router = Router();

const optId = z.coerce.number().int().positive().nullable().optional();
const optDate = z.iso.date().nullable().optional().or(z.literal('').transform(() => null));
const repeatRule = z.object({
  every: z.coerce.number().int().min(1).max(365).default(1),
  unit: z.enum(['day', 'week', 'month']),
  until: optDate,
});
const schema = z.object({
  title: z.string().trim().min(1, 'is required').max(300),
  description: z.string().trim().max(10000).default(''),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  kind: z.enum(['project', 'one_time', 'repeating']).default('one_time'),
  project_id: optId,
  parent_id: optId,
  due_date: optDate,
  assignee_id: optId,
  reporter_id: optId,
  estimate_hours: z.coerce.number().min(0).max(10000).nullable().optional(),
  repeat_rule: repeatRule.nullable().optional(),
});

const SELECT = `
  SELECT t.*, a.full_name AS assignee, r.full_name AS reporter, cb.full_name AS created_by_name,
         p.name AS project, p.owner_id AS project_owner_id,
         (SELECT count(*)::int FROM tasks s WHERE s.parent_id = t.id) AS subtask_count,
         (SELECT count(*)::int FROM tasks s WHERE s.parent_id = t.id AND s.status = 'done') AS subtask_done
  FROM tasks t
  LEFT JOIN employees a ON a.id = t.assignee_id
  LEFT JOIN employees r ON r.id = t.reporter_id
  LEFT JOIN employees cb ON cb.id = t.created_by
  LEFT JOIN projects p ON p.id = t.project_id`;

const involved = (u, t) => [t.assignee_id, t.reporter_id, t.created_by].includes(u.id);
const canEdit = (u, t) => isManager(u) || t.created_by === u.id || t.reporter_id === u.id || t.project_owner_id === u.id;

async function loadTask(id, user) {
  const t = await one(`${SELECT} WHERE t.id = $1`, [id]);
  if (!t) throw notFound('Task');
  if (!isManager(user) && !involved(user, t)) {
    if (!t.project_id) throw notFound('Task');
    await loadProject(t.project_id, user); // project members can see project tasks
  }
  return t;
}

const log = (c, taskId, actorId, action, changes = {}) =>
  c.query('INSERT INTO task_activity(task_id, actor_id, action, changes) VALUES ($1,$2,$3,$4)', [taskId, actorId, action, changes]);

/* ---------- list ---------- */
router.get('/', async (req, res) => {
  const { scope = 'assigned', status, project_id, kind, q } = req.query;
  const params = [];
  const where = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (scope === 'assigned') add('t.assignee_id = ?', req.user.id);
  else if (scope === 'reported') add('t.reporter_id = ?', req.user.id);
  else if (scope === 'created') add('t.created_by = ?', req.user.id);
  else if (scope === 'review') { add('t.reporter_id = ?', req.user.id); where.push(`t.approval = 'pending'`); }
  else if (scope === 'all') { if (!isManager(req.user)) throw forbidden(); }
  else throw badRequest('Unknown scope');
  if (status === 'open') where.push(`t.status <> 'done'`);
  else if (status) add('t.status = ?', status);
  if (project_id) add('t.project_id = ?', Number(project_id));
  if (kind) add('t.kind = ?', kind);
  if (q) add('(t.title ILIKE ? OR t.description ILIKE ?)', `%${q}%`);
  res.json(
    await many(
      `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY t.status = 'done', t.due_date NULLS LAST, CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.id DESC
       LIMIT 500`,
      params,
    ),
  );
});

/* ---------- one task with sub-tasks, comments, history ---------- */
router.get('/:id', async (req, res) => {
  const t = await loadTask(idParam(req), req.user);
  const [subtasks, comments, activity, ancestors] = await Promise.all([
    many(`WITH RECURSIVE sub AS (SELECT * FROM tasks WHERE parent_id = $1 UNION ALL SELECT c.* FROM tasks c JOIN sub ON c.parent_id = sub.id)
          SELECT s.id, s.parent_id, s.depth, s.title, s.status, s.priority, s.due_date, s.approval, a.full_name AS assignee
          FROM sub s LEFT JOIN employees a ON a.id = s.assignee_id ORDER BY s.depth, s.id`, [t.id]),
    many(`SELECT c.id, c.body, c.created_at, c.author_id, e.full_name AS author, e.avatar_path IS NOT NULL AS has_avatar
          FROM task_comments c LEFT JOIN employees e ON e.id = c.author_id WHERE c.task_id = $1 ORDER BY c.created_at`, [t.id]),
    many(`SELECT a.id, a.action, a.changes, a.created_at, e.full_name AS actor
          FROM task_activity a LEFT JOIN employees e ON e.id = a.actor_id WHERE a.task_id = $1 ORDER BY a.created_at DESC LIMIT 100`, [t.id]),
    many(`WITH RECURSIVE up AS (SELECT id, parent_id, title, depth FROM tasks WHERE id = $1 UNION ALL
            SELECT p.id, p.parent_id, p.title, p.depth FROM tasks p JOIN up ON up.parent_id = p.id)
          SELECT id, title FROM up WHERE id <> $1 ORDER BY depth`, [t.id]),
  ]);
  Object.assign(t, {
    subtasks, comments, activity, ancestors,
    can_edit: canEdit(req.user, t),
    can_update_status: canEdit(req.user, t) || t.assignee_id === req.user.id,
    can_review: t.approval === 'pending' && (t.reporter_id === req.user.id || isManager(req.user)) && t.assignee_id !== req.user.id,
    can_delete: isAdmin(req.user) || t.created_by === req.user.id,
  });
  res.json(t);
});

/* ---------- create ---------- */
router.post('/', validate(schema), async (req, res) => {
  const b = { ...req.body };
  let depth = 1;
  if (b.parent_id) {
    const parent = await loadTask(b.parent_id, req.user);
    if (!canEdit(req.user, parent) && parent.assignee_id !== req.user.id) throw forbidden('You cannot add sub-tasks here');
    if (parent.depth >= 3) throw badRequest('Sub-tasks can only go three levels deep');
    depth = parent.depth + 1;
    b.project_id = parent.project_id;
    b.kind = parent.project_id ? 'project' : 'one_time'; // sub-tasks don't repeat on their own
    b.repeat_rule = null;
  } else if (b.project_id) {
    const p = await loadProject(b.project_id, req.user);
    const isReporter = await one(`SELECT 1 FROM project_members WHERE project_id = $1 AND employee_id = $2 AND member_role = 'reporter'`, [p.id, req.user.id]);
    if (!isManager(req.user) && p.owner_id !== req.user.id && !isReporter) throw forbidden('Only the project owner or reporters can add tasks');
    b.kind = 'project';
  } else {
    if (b.kind === 'project') throw badRequest('Choose a project');
    // employees can create tasks for themselves; managers for anyone
    if (!isManager(req.user) && b.assignee_id && b.assignee_id !== req.user.id) throw forbidden('Only managers can assign tasks to others');
  }
  if (b.kind === 'repeating' && !b.repeat_rule) throw badRequest('Set how often the task repeats');
  if (b.kind === 'repeating' && !b.due_date) throw badRequest('A repeating task needs a first due date');
  if (b.kind !== 'repeating') b.repeat_rule = null;
  if (!b.assignee_id) b.assignee_id = req.user.id;
  if (b.reporter_id === b.assignee_id) b.reporter_id = null; // nobody approves their own work

  const id = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO tasks(project_id, parent_id, depth, kind, title, description, priority, due_date, assignee_id, reporter_id,
                         estimate_hours, repeat_rule, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [b.project_id ?? null, b.parent_id ?? null, depth, b.kind, b.title, b.description, b.priority, b.due_date ?? null,
        b.assignee_id, b.reporter_id ?? null, b.estimate_hours ?? null, b.repeat_rule, req.user.id],
    );
    await log(c, r.rows[0].id, req.user.id, 'created');
    return r.rows[0].id;
  });
  if (b.assignee_id !== req.user.id) notify(b.assignee_id, { title: 'New task assigned to you', body: b.title, link: `/tasks/${id}` });
  if (b.reporter_id && b.reporter_id !== req.user.id) notify(b.reporter_id, { title: 'You are the reviewer of a task', body: b.title, link: `/tasks/${id}` });
  res.status(201).json({ id });
});

/* ---------- edit details ---------- */
const EDITABLE = ['title', 'description', 'priority', 'due_date', 'assignee_id', 'reporter_id', 'estimate_hours', 'repeat_rule'];

router.patch('/:id', validate(patchOf(schema.omit({ kind: true, project_id: true, parent_id: true }))), async (req, res) => {
  const t = await loadTask(idParam(req), req.user);
  if (!canEdit(req.user, t)) throw forbidden('You cannot edit this task');
  const b = req.body;
  if (b.repeat_rule !== undefined && t.kind !== 'repeating') delete b.repeat_rule;
  if (b.repeat_rule === null && t.kind === 'repeating') throw badRequest('A repeating task needs a repeat rule');
  const assignee = b.assignee_id !== undefined ? b.assignee_id : t.assignee_id;
  const reporter = b.reporter_id !== undefined ? b.reporter_id : t.reporter_id;
  if (assignee && assignee === reporter) throw badRequest('The assignee cannot also be the reviewer');

  const changes = {};
  for (const k of EDITABLE) {
    if (b[k] !== undefined && JSON.stringify(b[k]) !== JSON.stringify(t[k])) changes[k] = { from: t[k], to: b[k] };
  }
  if (!Object.keys(changes).length) return res.json({ message: 'No changes' });
  const keys = Object.keys(changes);
  await tx(async (c) => {
    await c.query(
      `UPDATE tasks SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
      [t.id, ...keys.map((k) => b[k])],
    );
    await log(c, t.id, req.user.id, 'edited', changes);
  });
  if (changes.assignee_id && b.assignee_id && b.assignee_id !== req.user.id) {
    notify(b.assignee_id, { title: 'A task was assigned to you', body: b.title || t.title, link: `/tasks/${t.id}` });
  }
  res.json({ message: 'Task saved' });
});

/* ---------- status: todo → in_progress → done (→ review) ---------- */
function nextDue(due, rule) {
  const d = new Date(`${due}T00:00:00Z`);
  if (rule.unit === 'day') d.setUTCDate(d.getUTCDate() + rule.every);
  if (rule.unit === 'week') d.setUTCDate(d.getUTCDate() + 7 * rule.every);
  if (rule.unit === 'month') d.setUTCMonth(d.getUTCMonth() + rule.every);
  const iso = d.toISOString().slice(0, 10);
  return rule.until && iso > rule.until ? null : iso;
}

router.post(
  '/:id/status',
  validate(z.object({ status: z.enum(['todo', 'in_progress', 'done']), note: z.string().trim().max(2000).optional() })),
  async (req, res) => {
    const t = await loadTask(idParam(req), req.user);
    if (!canEdit(req.user, t) && t.assignee_id !== req.user.id) throw forbidden('Only the assignee can update progress');
    const { status, note } = req.body;
    if (status === t.status) return res.json({ message: 'No change' });
    if (status === 'done') {
      const open = await one(`SELECT count(*)::int AS n FROM tasks WHERE parent_id = $1 AND status <> 'done'`, [t.id]);
      if (open.n) throw badRequest(`Finish the ${open.n} open sub-task(s) first`);
    }
    // needs review if someone other than the person finishing it is the reviewer
    const needsReview = status === 'done' && t.reporter_id && t.reporter_id !== req.user.id;
    let nextId = null;
    await tx(async (c) => {
      await c.query(
        `UPDATE tasks SET status = $2,
           started_at = CASE WHEN $2 = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END,
           completed_at = CASE WHEN $2 = 'done' THEN now() ELSE NULL END,
           completion_note = CASE WHEN $2 = 'done' THEN $3 ELSE completion_note END,
           approval = CASE WHEN $2 = 'done' THEN $4 ELSE NULL END,
           approval_note = CASE WHEN $2 = 'done' THEN NULL ELSE approval_note END,
           updated_at = now()
         WHERE id = $1`,
        [t.id, status, note || null, needsReview ? 'pending' : null],
      );
      await log(c, t.id, req.user.id, 'status', { status: { from: t.status, to: status }, ...(note ? { note } : {}) });
      // repeating task: schedule the next occurrence when this one is done
      if (status === 'done' && t.kind === 'repeating' && t.due_date && t.repeat_rule) {
        const due = nextDue(t.due_date, t.repeat_rule);
        const exists = await c.query(`SELECT 1 FROM task_activity WHERE task_id = $1 AND action = 'next_created'`, [t.id]);
        if (due && !exists.rowCount) {
          nextId = (await c.query(
            `INSERT INTO tasks(kind, title, description, priority, due_date, assignee_id, reporter_id, estimate_hours, repeat_rule, created_by)
             SELECT kind, title, description, priority, $2, assignee_id, reporter_id, estimate_hours, repeat_rule, created_by FROM tasks WHERE id = $1
             RETURNING id`,
            [t.id, due],
          )).rows[0].id;
          await log(c, t.id, req.user.id, 'next_created', { next_task_id: nextId, due_date: due });
          await log(c, nextId, req.user.id, 'created', { repeated_from: t.id });
        }
      }
    });
    if (needsReview) notify(t.reporter_id, { title: 'Task ready for review', body: t.title, link: `/tasks/${t.id}` });
    res.json({ message: status === 'done' ? (needsReview ? 'Marked done — sent for review' : 'Marked done') : 'Status updated', next_task_id: nextId });
  },
);

router.post(
  '/:id/review',
  validate(z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(2000).optional() })),
  async (req, res) => {
    const t = await loadTask(idParam(req), req.user);
    if (t.approval !== 'pending') throw badRequest('This task is not waiting for review');
    if (t.assignee_id === req.user.id || (t.reporter_id !== req.user.id && !isManager(req.user))) throw forbidden('You cannot review this task');
    const { decision, note } = req.body;
    if (decision === 'rejected' && !note) throw badRequest('Tell the assignee what needs to change');
    await tx(async (c) => {
      await c.query(
        `UPDATE tasks SET approval = $2, approval_note = $3,
           status = CASE WHEN $2 = 'rejected' THEN 'in_progress' ELSE status END,
           completed_at = CASE WHEN $2 = 'rejected' THEN NULL ELSE completed_at END, updated_at = now()
         WHERE id = $1`,
        [t.id, decision, note || null],
      );
      await log(c, t.id, req.user.id, decision, note ? { note } : {});
    });
    notify(t.assignee_id, {
      title: decision === 'approved' ? 'Your task was approved' : 'Your task needs changes',
      body: `${t.title}${note ? ` — ${note}` : ''}`,
      link: `/tasks/${t.id}`,
    });
    res.json({ message: decision === 'approved' ? 'Approved' : 'Sent back to the assignee' });
  },
);

/* ---------- comments ---------- */
router.post('/:id/comments', validate(z.object({ body: z.string().trim().min(1).max(5000) })), async (req, res) => {
  const t = await loadTask(idParam(req), req.user);
  const c = await one('INSERT INTO task_comments(task_id, author_id, body) VALUES ($1,$2,$3) RETURNING *', [t.id, req.user.id, req.body.body]);
  notify([t.assignee_id, t.reporter_id, t.created_by].filter((x) => x && x !== req.user.id), {
    title: `${req.user.full_name} commented`, body: t.title, link: `/tasks/${t.id}`,
  });
  res.status(201).json(c);
});

router.delete('/:id/comments/:commentId', async (req, res) => {
  const t = await loadTask(idParam(req), req.user);
  const row = await one(
    `DELETE FROM task_comments WHERE id = $1 AND task_id = $2 AND (author_id = $3 OR $4) RETURNING id`,
    [idParam(req, 'commentId'), t.id, req.user.id, isAdmin(req.user)],
  );
  if (!row) throw notFound('Comment');
  res.status(204).end();
});

router.delete('/:id', async (req, res) => {
  const t = await loadTask(idParam(req), req.user);
  if (!isAdmin(req.user) && t.created_by !== req.user.id) throw forbidden('Only the creator or an admin can delete a task');
  await one('DELETE FROM tasks WHERE id = $1', [t.id]);
  res.status(204).end();
});

export default router;
