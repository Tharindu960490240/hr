import { query } from '../db/pool.js';

/** Create in-app notifications for one or many employees. Never throws. */
export async function notify(employeeIds, { title, body = '', link = null }) {
  const ids = [...new Set([].concat(employeeIds).filter(Boolean))];
  if (!ids.length) return;
  try {
    await query(
      `INSERT INTO notifications(employee_id, title, body, link)
       SELECT unnest($1::int[]), $2, $3, $4`,
      [ids, title, body, link],
    );
  } catch (e) {
    console.error('[notify] failed:', e.message);
  }
}

/** All active admins / super admins. */
export async function adminIds() {
  const { rows } = await query(`SELECT id FROM employees WHERE is_active AND role IN ('Admin','Super Admin')`);
  return rows.map((r) => r.id);
}
