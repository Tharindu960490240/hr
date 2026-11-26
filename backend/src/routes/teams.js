import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { validate, patchOf } from '../middleware/validate.js';
import { idParam, notFound } from '../lib/http.js';
import { notify } from '../lib/notify.js';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(1, 'is required').max(120),
  description: z.string().trim().max(1000).default(''),
  leader_id: z.coerce.number().int().positive().nullable().optional(),
  member_ids: z.array(z.coerce.number().int().positive()).max(200).default([]),
});

const SELECT = `
  SELECT t.id, t.name, t.description, t.leader_id, l.full_name AS leader,
         COALESCE(json_agg(json_build_object('id', e.id, 'full_name', e.full_name, 'has_avatar', e.avatar_path IS NOT NULL)
                  ORDER BY e.full_name) FILTER (WHERE e.id IS NOT NULL), '[]') AS members
  FROM teams t
  LEFT JOIN employees l ON l.id = t.leader_id
  LEFT JOIN team_members m ON m.team_id = t.id
  LEFT JOIN employees e ON e.id = m.employee_id`;

router.get('/', async (_req, res) => {
  res.json(await many(`${SELECT} GROUP BY t.id, l.full_name ORDER BY t.name`));
});

router.get('/mine', async (req, res) => {
  res.json(
    await many(
      `${SELECT} WHERE t.leader_id = $1 OR EXISTS (SELECT 1 FROM team_members x WHERE x.team_id = t.id AND x.employee_id = $1)
       GROUP BY t.id, l.full_name ORDER BY t.name`,
      [req.user.id],
    ),
  );
});

async function save(id, b, userId) {
  return tx(async (c) => {
    let teamId = id;
    if (!id) {
      teamId = (await c.query('INSERT INTO teams(name, description, leader_id) VALUES ($1,$2,$3) RETURNING id', [
        b.name, b.description, b.leader_id ?? null,
      ])).rows[0].id;
    } else {
      const r = await c.query(
        `UPDATE teams SET name = COALESCE($2,name), description = COALESCE($3,description),
           leader_id = CASE WHEN $4::boolean THEN $5 ELSE leader_id END WHERE id = $1`,
        [id, b.name, b.description, b.leader_id !== undefined, b.leader_id ?? null],
      );
      if (!r.rowCount) throw notFound('Team');
    }
    let added = [];
    if (b.member_ids) {
      const before = (await c.query('SELECT employee_id FROM team_members WHERE team_id = $1', [teamId])).rows.map((r) => r.employee_id);
      await c.query('DELETE FROM team_members WHERE team_id = $1', [teamId]);
      await c.query('INSERT INTO team_members(team_id, employee_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING', [
        teamId, [...new Set(b.member_ids)],
      ]);
      added = b.member_ids.filter((m) => !before.includes(m) && m !== userId);
    }
    return { teamId, added };
  });
}

router.post('/', requireRole('Manager'), validate(schema), async (req, res) => {
  const { teamId, added } = await save(null, req.body, req.user.id);
  notify(added, { title: 'You were added to a team', body: req.body.name, link: '/teams/mine' });
  res.status(201).json(await one(`${SELECT} WHERE t.id = $1 GROUP BY t.id, l.full_name`, [teamId]));
});

router.patch('/:id', requireRole('Manager'), validate(patchOf(schema)), async (req, res) => {
  const { teamId, added } = await save(idParam(req), req.body, req.user.id);
  notify(added, { title: 'You were added to a team', body: req.body.name || '', link: '/teams/mine' });
  res.json(await one(`${SELECT} WHERE t.id = $1 GROUP BY t.id, l.full_name`, [teamId]));
});

router.delete('/:id', requireRole('Manager'), async (req, res) => {
  const row = await one('DELETE FROM teams WHERE id = $1 RETURNING id', [idParam(req)]);
  if (!row) throw notFound('Team');
  res.status(204).end();
});

export default router;
