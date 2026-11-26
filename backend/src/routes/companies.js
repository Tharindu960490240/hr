import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { validate, patchOf } from '../middleware/validate.js';
import { imageUpload, saveUpload, sendStored, removeStored } from '../middleware/upload.js';
import { idParam, notFound, badRequest } from '../lib/http.js';

const router = Router();

const companySchema = z.object({
  name: z.string().trim().min(1, 'is required').max(150),
  description: z.string().trim().max(2000).default(''),
  admin_email: z.string().trim().email().or(z.literal('')).default(''),
  admin_contact: z.string().trim().max(40).default(''),
});
const branchSchema = z.object({
  name: z.string().trim().min(1, 'is required').max(120),
  contact: z.string().trim().max(40).default(''),
  address: z.string().trim().max(300).default(''),
  city: z.string().trim().max(120).default(''),
});

router.get('/', async (_req, res) => {
  res.json(
    await many(`
      SELECT c.id, c.name, c.description, c.admin_email, c.admin_contact, c.logo_path IS NOT NULL AS has_logo,
             COALESCE(json_agg(b ORDER BY b.name) FILTER (WHERE b.id IS NOT NULL), '[]') AS branches
      FROM companies c LEFT JOIN branches b ON b.company_id = c.id
      GROUP BY c.id ORDER BY c.name`),
  );
});

router.get('/branches', async (_req, res) => {
  res.json(
    await many(`SELECT b.*, c.name AS company FROM branches b JOIN companies c ON c.id = b.company_id ORDER BY c.name, b.name`),
  );
});

router.post('/', requireRole('Admin'), validate(companySchema), async (req, res) => {
  const b = req.body;
  res.status(201).json(
    await one(
      `INSERT INTO companies(name, description, admin_email, admin_contact) VALUES ($1,$2,NULLIF($3,''),$4) RETURNING *`,
      [b.name, b.description, b.admin_email, b.admin_contact],
    ),
  );
});

router.patch('/:id', requireRole('Admin'), validate(patchOf(companySchema)), async (req, res) => {
  const b = req.body;
  const row = await one(
    `UPDATE companies SET name = COALESCE($2,name), description = COALESCE($3,description),
       admin_email = CASE WHEN $4::text IS NULL THEN admin_email ELSE NULLIF($4,'') END,
       admin_contact = COALESCE($5,admin_contact)
     WHERE id = $1 RETURNING *`,
    [idParam(req), b.name, b.description, b.admin_email, b.admin_contact],
  );
  if (!row) throw notFound('Company');
  res.json(row);
});

router.delete('/:id', requireRole('Super Admin'), async (req, res) => {
  const row = await one('DELETE FROM companies WHERE id = $1 RETURNING logo_path', [idParam(req)]);
  if (!row) throw notFound('Company');
  removeStored(row.logo_path);
  res.status(204).end();
});

// ---- logo ----
router.post('/:id/logo', requireRole('Admin'), imageUpload(), async (req, res) => {
  if (!req.file) throw badRequest('Choose an image to upload');
  const id = idParam(req);
  const old = await one('SELECT logo_path FROM companies WHERE id = $1', [id]);
  if (!old) throw notFound('Company');
  await one('UPDATE companies SET logo_path = $2 WHERE id = $1', [id, await saveUpload(req.file, 'logos')]);
  removeStored(old.logo_path);
  res.json({ message: 'Logo updated' });
});

router.get('/:id/logo', async (req, res) => {
  const row = await one('SELECT logo_path FROM companies WHERE id = $1', [idParam(req)]);
  if (!row?.logo_path) throw notFound('Logo');
  await sendStored(res, row.logo_path);
});

// ---- branches ----
router.post('/:id/branches', requireRole('Admin'), validate(branchSchema), async (req, res) => {
  const b = req.body;
  res.status(201).json(
    await one(
      `INSERT INTO branches(company_id, name, contact, address, city) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [idParam(req), b.name, b.contact, b.address, b.city],
    ),
  );
});

router.patch('/branches/:id', requireRole('Admin'), validate(patchOf(branchSchema)), async (req, res) => {
  const b = req.body;
  const row = await one(
    `UPDATE branches SET name = COALESCE($2,name), contact = COALESCE($3,contact),
       address = COALESCE($4,address), city = COALESCE($5,city) WHERE id = $1 RETURNING *`,
    [idParam(req), b.name, b.contact, b.address, b.city],
  );
  if (!row) throw notFound('Branch');
  res.json(row);
});

router.delete('/branches/:id', requireRole('Admin'), async (req, res) => {
  const row = await one('DELETE FROM branches WHERE id = $1 RETURNING id', [idParam(req)]);
  if (!row) throw notFound('Branch');
  res.status(204).end();
});

export default router;
