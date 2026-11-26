import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { validate, patchOf } from '../middleware/validate.js';
import { idParam, notFound } from '../lib/http.js';

/**
 * Simple reference tables (departments, employee types, project categories, designations).
 * Everyone signed in can read; Admins can write.
 */
function lookupRouter({ table, label, extra = {}, selectSql, orderBy = 'name' }) {
  const router = Router();
  const base = z.object({
    name: z.string().trim().min(1, 'is required').max(120),
    description: z.string().trim().max(1000).default(''),
    ...extra,
  });
  const cols = Object.keys(base.shape);
  const listSql = selectSql || `SELECT * FROM ${table} t`;

  router.get('/', async (_req, res) => {
    res.json(await many(`${listSql} ORDER BY ${orderBy}`));
  });

  router.post('/', requireRole('Admin'), validate(base), async (req, res) => {
    const vals = cols.map((c) => req.body[c]);
    const row = await one(
      `INSERT INTO ${table}(${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
      vals,
    );
    res.status(201).json(row);
  });

  router.patch('/:id', requireRole('Admin'), validate(patchOf(base)), async (req, res) => {
    const id = idParam(req);
    const keys = cols.filter((c) => req.body[c] !== undefined);
    if (!keys.length) return res.json(await one(`SELECT * FROM ${table} WHERE id = $1`, [id]));
    const row = await one(
      `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...keys.map((k) => req.body[k])],
    );
    if (!row) throw notFound(label);
    res.json(row);
  });

  router.delete('/:id', requireRole('Admin'), async (req, res) => {
    const row = await one(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [idParam(req)]);
    if (!row) throw notFound(label);
    res.status(204).end();
  });

  return router;
}

export const departments = lookupRouter({ table: 'departments', label: 'Department' });
export const jobTypes = lookupRouter({ table: 'job_types', label: 'Employee type' });
export const categories = lookupRouter({ table: 'project_categories', label: 'Category' });
export const designations = lookupRouter({
  table: 'designations',
  label: 'Designation',
  extra: { department_id: z.coerce.number().int().positive('select a department') },
  selectSql: `SELECT t.*, d.name AS department FROM designations t JOIN departments d ON d.id = t.department_id`,
  orderBy: 'd.name, t.name',
});
