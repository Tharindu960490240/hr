import { many } from '../db/pool.js';
import { thisYear } from './dates.js';

export const LIEU = 'Lieu leave';

/**
 * Leave balance for an employee for a calendar year.
 * Days are WORKING days (Mon–Fri minus company holidays for their branch),
 * clipped to the year — the old code counted one "day" per request.
 */
export async function leaveBalance(employeeId, year = thisYear(), client) {
  const run = client ? (q, p) => client.query(q, p).then((r) => r.rows) : many;
  return run(
    `WITH yr AS (SELECT make_date($2,1,1) AS s, make_date($2,12,31) AS e),
     emp AS (SELECT id, job_type_id, branch_id, lieu_days FROM employees WHERE id = $1),
     entitled AS (
       SELECT lt.name, lt.days FROM leave_types lt JOIN emp ON lt.job_type_id = emp.job_type_id
       UNION ALL SELECT '${LIEU}', lieu_days FROM emp
     ),
     taken AS (
       SELECT r.leave_type, r.status,
              working_days(greatest(r.start_date, yr.s), least(r.end_date, yr.e), emp.branch_id) AS days
       FROM requests r, yr, emp
       WHERE r.employee_id = emp.id AND r.kind = 'leave' AND r.status IN ('approved','pending')
         AND r.start_date <= yr.e AND r.end_date >= yr.s
     )
     SELECT en.name, en.days::float AS entitled,
            COALESCE(sum(t.days) FILTER (WHERE t.status = 'approved'), 0)::int AS used,
            COALESCE(sum(t.days) FILTER (WHERE t.status = 'pending'), 0)::int AS pending,
            (en.days - COALESCE(sum(t.days) FILTER (WHERE t.status = 'approved'), 0))::float AS remaining
     FROM entitled en LEFT JOIN taken t ON t.leave_type = en.name
     GROUP BY en.name, en.days
     ORDER BY en.name = '${LIEU}', en.name`,
    [employeeId, year],
  );
}
