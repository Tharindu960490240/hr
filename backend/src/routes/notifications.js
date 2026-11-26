import { Router } from 'express';
import { many, one, query } from '../db/pool.js';
import { idParam, notFound } from '../lib/http.js';

const router = Router();

router.get('/', async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const [items, count] = await Promise.all([
    many(
      `SELECT id, title, body, link, read_at, created_at FROM notifications
       WHERE employee_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''} ORDER BY created_at DESC LIMIT 100`,
      [req.user.id],
    ),
    one('SELECT count(*)::int AS n FROM notifications WHERE employee_id = $1 AND read_at IS NULL', [req.user.id]),
  ]);
  res.json({ unread: count.n, items });
});

router.post('/read-all', async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE employee_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ message: 'All caught up' });
});

router.post('/:id/read', async (req, res) => {
  const row = await one(
    'UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND employee_id = $2 RETURNING id',
    [idParam(req), req.user.id],
  );
  if (!row) throw notFound('Notification');
  res.json({ message: 'Marked as read' });
});

router.delete('/:id', async (req, res) => {
  const row = await one('DELETE FROM notifications WHERE id = $1 AND employee_id = $2 RETURNING id', [idParam(req), req.user.id]);
  if (!row) throw notFound('Notification');
  res.status(204).end();
});

export default router;
