/**
 * Create (or reset) a Super Admin account — use this for a real deployment without demo data.
 *   npm run create-admin -- you@company.com "Your Name"
 * Prints a one-time password; change it after signing in.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool } from './pool.js';
import { migrate } from './migrate.js';

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();
if (!email || !/^\S+@\S+\.\S+$/.test(email) || !name) {
  console.error('Usage: npm run create-admin -- you@company.com "Your Name"');
  process.exit(1);
}

// meets the password rules: upper, lower, number, symbol, 8+
const password = `${crypto.randomBytes(9).toString('base64url')}Aa1!`;

try {
  await migrate();
  const code = `ADM-${crypto.randomInt(1000, 9999)}`;
  const row = (await pool.query(
    `INSERT INTO employees(emp_code, email, password_hash, role, full_name)
     VALUES ($1, lower($2), $3, 'Super Admin', $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'Super Admin',
       is_active = true, password_changed_at = now()
     RETURNING id, (xmax = 0) AS created`,
    [code, email, await bcrypt.hash(password, 12), name],
  )).rows[0];
  console.log(`${row.created ? 'Created' : 'Reset'} Super Admin ${email}\nOne-time password: ${password}\nSign in and change it from the account menu.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
