// Integration tests against a seeded database:  npm run seed && npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

let server, base;
const tokens = {};

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const who of ['superadmin', 'admin', 'manager', 'employee']) {
    const r = await api('POST', '/auth/login', { body: { email: `${who}@example.com`, password: 'Password@123' } });
    assert.equal(r.status, 200, `login ${who}`);
    tokens[who] = r.body.token;
  }
});
after(async () => { server.close(); await pool.end(); });

test('rejects unauthenticated and forged tokens', async () => {
  assert.equal((await api('GET', '/employees')).status, 401);
  assert.equal((await api('GET', '/employees', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.x' })).status, 401);
});

test('wrong password gives one generic message', async () => {
  const a = await api('POST', '/auth/login', { body: { email: 'employee@example.com', password: 'nope' } });
  const b = await api('POST', '/auth/login', { body: { email: 'nobody@example.com', password: 'nope' } });
  assert.equal(a.status, 401);
  assert.equal(a.body.error, b.body.error);
});

test('employee cannot create staff, change own role, or see bank details of others', async () => {
  assert.equal((await api('POST', '/employees', { token: tokens.employee, body: { emp_code: 'X1', email: 'x@x.com', full_name: 'X' } })).status, 403);
  const me = (await api('GET', '/auth/me', { token: tokens.employee })).body;
  const r = await api('PATCH', `/employees/${me.id}`, { token: tokens.employee, body: { role: 'Super Admin' } });
  assert.equal(r.status, 400); // unknown key rejected by strict schema
  const other = (await api('GET', '/employees/1', { token: tokens.employee })).body;
  assert.equal(other.bank, undefined);
  const mine = (await api('GET', `/employees/${me.id}`, { token: tokens.employee })).body;
  assert.ok(mine.bank);
});

test('admin cannot create a super admin; super admin can', async () => {
  const body = { emp_code: `T-${Date.now()}`, email: `t${Date.now()}@example.com`, full_name: 'Test Person', role: 'Super Admin' };
  assert.equal((await api('POST', '/employees', { token: tokens.admin, body })).status, 403);
  const ok = await api('POST', '/employees', { token: tokens.superadmin, body: { ...body, role: 'Employee' } });
  assert.equal(ok.status, 201);
  assert.ok(ok.body.invite_link.includes('reset-password?token='));
  // invite link works with a strong password, rejects a weak one
  const token = new URL(ok.body.invite_link).searchParams.get('token');
  assert.equal((await api('POST', '/auth/reset-password', { body: { token, password: 'weakpass' } })).status, 400);
  assert.equal((await api('POST', '/auth/reset-password', { body: { token, password: 'Str0ng!Pass' } })).status, 200);
  assert.equal((await api('POST', '/auth/login', { body: { email: body.email, password: 'Str0ng!Pass' } })).status, 200);
});

test('change password checks the CURRENT password and invalidates old tokens', async () => {
  const login = await api('POST', '/auth/login', { body: { email: 'admin2@example.com', password: 'Password@123' } });
  const old = login.body.token;
  assert.equal((await api('POST', '/auth/change-password', { token: old, body: { current: 'Wrong@123', next: 'N3w!Password' } })).status, 400);
  await new Promise((r) => setTimeout(r, 1100));
  const ok = await api('POST', '/auth/change-password', { token: old, body: { current: 'Password@123', next: 'N3w!Password' } });
  assert.equal(ok.status, 200);
  assert.equal((await api('GET', '/auth/me', { token: old })).status, 401);
  assert.equal((await api('GET', '/auth/me', { token: ok.body.token })).status, 200);
  await api('POST', '/auth/change-password', { token: ok.body.token, body: { current: 'N3w!Password', next: 'Password@123' } });
});

test('leave request: validation, overlap, approval rules', async () => {
  const bal = (await api('GET', '/dashboard', { token: tokens.employee })).body.leave_balance;
  const type = bal.find((b) => b.name === 'Annual leave');
  assert.ok(type);
  const year = new Date().getFullYear();
  const bad = await api('POST', '/requests', { token: tokens.employee, body: { kind: 'leave', leave_type: 'Annual leave', start_date: `${year}-12-10`, end_date: `${year}-12-09`, reason: 'Testing' } });
  assert.equal(bad.status, 400);
  // pick a free weekday window in December
  const r = await api('POST', '/requests', { token: tokens.employee, body: { kind: 'wfh', start_date: `${year}-12-16`, end_date: `${year}-12-16`, reason: 'Test request' } });
  if (r.status === 409) return; // seeded data already uses that day
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const dup = await api('POST', '/requests', { token: tokens.employee, body: { kind: 'wfh', start_date: `${year}-12-16`, end_date: `${year}-12-17`, reason: 'Overlap' } });
  assert.equal(dup.status, 409);
  // employee cannot approve own; manager (their reporter) can; second decision conflicts
  assert.equal((await api('POST', `/requests/${r.body.id}/approve`, { token: tokens.employee, body: {} })).status, 403);
  assert.equal((await api('POST', `/requests/${r.body.id}/approve`, { token: tokens.manager, body: {} })).status, 200);
  assert.equal((await api('POST', `/requests/${r.body.id}/reject`, { token: tokens.admin, body: { note: 'too late' } })).status, 409);
  await pool.query('DELETE FROM requests WHERE id = $1', [r.body.id]);
});

test('tasks: create, sub-task depth, status → review → approve', async () => {
  const me = (await api('GET', '/auth/me', { token: tokens.employee })).body;
  const t = await api('POST', '/tasks', { token: tokens.manager, body: { title: 'Test task', assignee_id: me.id } });
  assert.equal(t.status, 201);
  const s1 = await api('POST', '/tasks', { token: tokens.employee, body: { title: 'Sub 1', parent_id: t.body.id } });
  const s2 = await api('POST', '/tasks', { token: tokens.employee, body: { title: 'Sub 2', parent_id: s1.body.id } });
  const s3 = await api('POST', '/tasks', { token: tokens.employee, body: { title: 'Sub 3', parent_id: s2.body.id } });
  assert.equal(s3.status, 400); // max 3 levels
  // reporter defaults: set manager as reviewer
  const mgr = (await api('GET', '/auth/me', { token: tokens.manager })).body;
  await api('PATCH', `/tasks/${t.body.id}`, { token: tokens.manager, body: { reporter_id: mgr.id } });
  assert.equal((await api('POST', `/tasks/${t.body.id}/status`, { token: tokens.employee, body: { status: 'done' } })).status, 400); // open subtasks
  await api('POST', `/tasks/${s2.body.id}/status`, { token: tokens.employee, body: { status: 'done' } });
  await api('POST', `/tasks/${s1.body.id}/status`, { token: tokens.employee, body: { status: 'done' } });
  const done = await api('POST', `/tasks/${t.body.id}/status`, { token: tokens.employee, body: { status: 'done' } });
  assert.match(done.body.message, /review/);
  assert.equal((await api('POST', `/tasks/${t.body.id}/review`, { token: tokens.employee, body: { decision: 'approved' } })).status, 403);
  assert.equal((await api('POST', `/tasks/${t.body.id}/review`, { token: tokens.manager, body: { decision: 'approved' } })).status, 200);
  const full = (await api('GET', `/tasks/${t.body.id}`, { token: tokens.employee })).body;
  assert.equal(full.approval, 'approved');
  assert.equal(full.subtasks.length, 2);
  await api('DELETE', `/tasks/${t.body.id}`, { token: tokens.manager });
});

test('repeating task schedules the next occurrence', async () => {
  const t = await api('POST', '/tasks', { token: tokens.manager, body: { title: 'Weekly thing', kind: 'repeating', due_date: '2026-12-01', repeat_rule: { every: 1, unit: 'week' } } });
  const r = await api('POST', `/tasks/${t.body.id}/status`, { token: tokens.manager, body: { status: 'done' } });
  assert.ok(r.body.next_task_id);
  const next = (await api('GET', `/tasks/${r.body.next_task_id}`, { token: tokens.manager })).body;
  assert.equal(next.due_date, '2026-12-08');
  await pool.query('DELETE FROM tasks WHERE id = ANY($1)', [[t.body.id, r.body.next_task_id]]);
});

test('managers get attendance and dashboard; employees do not get attendance', async () => {
  assert.equal((await api('GET', '/attendance', { token: tokens.employee })).status, 403);
  const a = await api('GET', '/attendance', { token: tokens.manager });
  assert.equal(a.status, 200);
  assert.ok(a.body.rows.length > 50);
  const d = await api('GET', '/dashboard', { token: tokens.admin });
  assert.ok(d.body.manager.weekly.length >= 9);
});

test('lookups and other read endpoints respond', async () => {
  for (const p of ['/departments', '/designations', '/job-types', '/categories', '/companies', '/companies/branches', '/leave-types', '/holidays', '/teams', '/teams/mine', '/projects', '/tasks?scope=all', '/work-reports', '/work-reports?all=true', '/notifications', '/requests?scope=approvals']) {
    const r = await api('GET', p, { token: tokens.superadmin });
    assert.equal(r.status, 200, p);
  }
  const projects = (await api('GET', '/projects', { token: tokens.employee })).body;
  const all = (await api('GET', '/projects', { token: tokens.manager })).body;
  assert.ok(projects.length < all.length, 'employees only see their projects');
});
