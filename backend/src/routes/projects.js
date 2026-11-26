import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { validate, patchOf } from '../middleware/validate.js';
import { idParam, notFound, forbidden } from '../lib/http.js';
import { isAdmin, isManager } from '../lib/roles.js';
import { notify } from '../lib/notify.js';

const router = Router();

const ids = z.array(z.coerce.number().int().positive()).max(300).default([]);
const optDate = z.iso.date().nullable().optional().or(z.literal('').transform(() => null));
const schema = z
  .object({
    name: z.string().trim().min(1, 'is required').max(200),
    description: z.string().trim().max(5000).default(''),
    category_id: z.coerce.number().int().positive().nullable().optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    status: z.enum(['planned', 'active', 'on_hold', 'completed', 'cancelled']).default('planned'),
    start_date: optDate,
    end_date: optDate,
    note: z.string().trim().max(2000).default(''),
    member_ids: ids,
    reporter_ids: ids,
    team_ids: ids,
    kpis: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  });

/** Projects a user can see: managers see all; others see ones they own, belong to, or whose team they're in. */
export const VISIBLE = `(
  $1::int IS NULL OR p.owner_id = $1
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.employee_id = $1)
  OR EXISTS (SELECT 1 FROM project_teams pt JOIN team_members tm ON tm.team_id = pt.team_id
             WHERE pt.project_id = p.id AND tm.employee_id = $1)
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p.id AND (t.assignee_id = $1 OR t.reporter_id = $1))
)`;

const LIST = `
  SELECT p.*, c.name AS category, o.full_name AS owner,
         (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count,
         (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
  FROM projects p
  LEFT JOIN project_categories c ON c.id = p.category_id
  LEFT JOIN employees o ON o.id = p.owner_id`;

const viewerId = (user) => (isManager(user) ? null : user.id);

router.get('/', async (req, res) => {
  res.json(await many(`${LIST} WHERE ${VISIBLE} ORDER BY p.status = 'completed', p.end_date NULLS LAST, p.name`, [viewerId(req.user)]));
});

export async function loadProject(id, user) {
  const p = await one(`${LIST} WHERE p.id = $2 AND ${VISIBLE}`, [viewerId(user), id]);
  if (!p) throw notFound('Project');
  return p;
}

router.get('/:id', async (req, res) => {
  const p = await loadProject(idParam(req), req.user);
  const [members, teams, kpis, tasks] = await Promise.all([
    many(`SELECT pm.member_role, e.id, e.full_name, e.avatar_path IS NOT NULL AS has_avatar
          FROM project_members pm JOIN employees e ON e.id = pm.employee_id WHERE pm.project_id = $1 ORDER BY e.full_name`, [p.id]),
    many(`SELECT t.id, t.name FROM project_teams pt JOIN teams t ON t.id = pt.team_id WHERE pt.project_id = $1 ORDER BY t.name`, [p.id]),
    many('SELECT id, name FROM project_kpis WHERE project_id = $1 ORDER BY id', [p.id]),
    many(`SELECT t.id, t.parent_id, t.depth, t.title, t.status, t.priority, t.due_date, t.approval,
                 a.full_name AS assignee, t.assignee_id, r.full_name AS reporter
          FROM tasks t LEFT JOIN employees a ON a.id = t.assignee_id LEFT JOIN employees r ON r.id = t.reporter_id
          WHERE t.project_id = $1 ORDER BY t.depth, t.due_date NULLS LAST, t.id`, [p.id]),
  ]);
  p.members = members.filter((m) => m.member_role === 'member');
  p.reporters = members.filter((m) => m.member_role === 'reporter');
  Object.assign(p, { teams, kpis, tasks, can_edit: canEdit(req.user, p) });
  res.json(p);
});

const canEdit = (user, p) => isAdmin(user) || p.owner_id === user.id;

async function saveLinks(c, id, b) {
  const sets = [];
  if (b.member_ids || b.reporter_ids) {
    for (const [role, list] of [['member', b.member_ids], ['reporter', b.reporter_ids]]) {
      if (!list) continue;
      await c.query('DELETE FROM project_members WHERE project_id = $1 AND member_role = $2', [id, role]);
      await c.query(
        `INSERT INTO project_members(project_id, employee_id, member_role) SELECT $1, unnest($2::int[]), $3 ON CONFLICT DO NOTHING`,
        [id, [...new Set(list)], role],
      );
      sets.push(...list);
    }
  }
  if (b.team_ids) {
    await c.query('DELETE FROM project_teams WHERE project_id = $1', [id]);
    await c.query('INSERT INTO project_teams(project_id, team_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING', [id, [...new Set(b.team_ids)]]);
  }
  if (b.kpis) {
    await c.query('DELETE FROM project_kpis WHERE project_id = $1', [id]);
    for (const k of b.kpis) await c.query('INSERT INTO project_kpis(project_id, name) VALUES ($1,$2)', [id, k]);
  }
  return sets;
}

router.post('/', requireRole('Manager'), validate(schema), async (req, res) => {
  const b = req.body;
  const { id, people } = await tx(async (c) => {
    const p = (await c.query(
      `INSERT INTO projects(name, description, category_id, owner_id, priority, status, start_date, end_date, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [b.name, b.description, b.category_id ?? null, req.user.id, b.priority, b.status, b.start_date ?? null, b.end_date ?? null, b.note],
    )).rows[0];
    return { id: p.id, people: await saveLinks(c, p.id, b) };
  });
  notify(people.filter((x) => x !== req.user.id), { title: 'You were added to a project', body: b.name, link: `/projects/${id}` });
  res.status(201).json({ id });
});

router.patch('/:id', validate(patchOf(schema)), async (req, res) => {
  const p = await loadProject(idParam(req), req.user);
  if (!canEdit(req.user, p)) throw forbidden('Only the project owner or an admin can edit this project');
  const b = req.body;
  const cols = ['name', 'description', 'category_id', 'priority', 'status', 'start_date', 'end_date', 'note'].filter((k) => b[k] !== undefined);
  await tx(async (c) => {
    if (cols.length) {
      await c.query(`UPDATE projects SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [p.id, ...cols.map((k) => b[k])]);
    }
    await saveLinks(c, p.id, b);
  });
  res.json({ message: 'Project saved' });
});

router.delete('/:id', async (req, res) => {
  const p = await loadProject(idParam(req), req.user);
  if (!canEdit(req.user, p)) throw forbidden();
  await one('DELETE FROM projects WHERE id = $1', [p.id]);
  res.status(204).end();
});

export default router;
