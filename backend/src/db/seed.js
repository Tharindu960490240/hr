/**
 * Fills the database with realistic demo data.
 *   npm run seed            -> wipes ALL data and re-seeds
 * Every demo account uses the password in DEMO_PASSWORD.
 */
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { migrate } from './migrate.js';
import { todayISO } from '../lib/dates.js';

export const DEMO_PASSWORD = 'Password@123';

// ---------- deterministic random so every seed looks the same ----------
let s = 20261126;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p) => rnd() < p;
const sample = (a, n) => [...a].sort(() => rnd() - 0.5).slice(0, n);

const TODAY = new Date(`${todayISO()}T00:00:00Z`); // office-local "today", as a UTC-midnight date
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const isWeekend = (d) => [0, 6].includes(d.getUTCDay());
const nextWeekday = (d) => { let x = new Date(d); while (isWeekend(x)) x = addDays(x, 1); return x; };
const YEAR = TODAY.getUTCFullYear();

// ---------- reference data ----------
const BRANCHES = [
  { name: 'Sydney HQ', city: 'Sydney', address: 'Level 12, 200 George St, Sydney NSW 2000', contact: '+61 2 9000 1000' },
  { name: 'Melbourne', city: 'Melbourne', address: '45 Collins St, Melbourne VIC 3000', contact: '+61 3 9000 2000' },
  { name: 'Brisbane', city: 'Brisbane', address: '120 Eagle St, Brisbane QLD 4000', contact: '+61 7 3000 3000' },
  { name: 'Perth', city: 'Perth', address: '8 St Georges Tce, Perth WA 6000', contact: '+61 8 9000 4000' },
];

const DEPARTMENTS = {
  'Engineering': ['Software Engineer', 'Senior Software Engineer', 'Engineering Manager', 'QA Engineer', 'DevOps Engineer'],
  'Product & Design': ['Product Manager', 'UX Designer', 'UI Designer', 'Product Owner'],
  'Human Resources': ['HR Officer', 'HR Business Partner', 'Recruiter', 'Head of People'],
  'Finance': ['Accountant', 'Payroll Officer', 'Finance Manager'],
  'Sales & Marketing': ['Account Executive', 'Marketing Coordinator', 'Content Writer', 'Sales Manager'],
  'Customer Support': ['Support Specialist', 'Support Team Lead'],
  'Operations': ['Office Manager', 'Operations Coordinator', 'IT Support Officer'],
  'Student Services': ['Student Advisor', 'Admissions Officer', 'Compliance Officer'],
};

const JOB_TYPES = {
  'Full-time': { desc: 'Permanent full-time staff', leave: { 'Annual leave': 20, "Personal/carer's leave": 10, 'Compassionate leave': 2, 'Study leave': 5 } },
  'Part-time': { desc: 'Permanent part-time (pro-rata entitlements)', leave: { 'Annual leave': 12, "Personal/carer's leave": 6, 'Compassionate leave': 2 } },
  'Contract': { desc: 'Fixed-term contractors', leave: { 'Annual leave': 10, "Personal/carer's leave": 5 } },
  'Intern': { desc: 'Interns and graduates on placement', leave: { "Personal/carer's leave": 3, 'Study leave': 3 } },
};

const CATEGORIES = [
  ['Client project', 'Billable work delivered for customers'],
  ['Internal tooling', 'Systems that make our own work easier'],
  ['Marketing campaign', 'Campaigns, launches and events'],
  ['Compliance', 'Audits, policy and regulatory work'],
  ['Infrastructure', 'Hosting, security and networks'],
  ['Research', 'Discovery work and prototypes'],
];

const FIRST = ['Olivia', 'Liam', 'Amelia', 'Noah', 'Isla', 'Jack', 'Mia', 'William', 'Ava', 'Oliver', 'Charlotte', 'Thomas', 'Grace', 'James', 'Chloe', 'Lucas', 'Zara', 'Ethan', 'Priya', 'Arjun', 'Mei', 'Hiroshi', 'Fatima', 'Omar', 'Sofia', 'Mateo', 'Aisha', 'Kwame', 'Ngoc', 'Minh', 'Ananya', 'Rohan', 'Leila', 'Daniel', 'Hannah', 'Samuel', 'Ruby', 'Harper', 'Kai', 'Tane', 'Aroha', 'Elena', 'Luca', 'Yusuf', 'Nadia', 'Ben', 'Jasmine', 'Ravi', 'Sakura', 'Connor', 'Emily', 'Chen', 'Ivy', 'Felix', 'Layla', 'Marcus', 'Tara', 'Dev', 'Hugo', 'Maya'];
const LAST = ['Smith', 'Nguyen', 'Patel', 'Williams', 'Chen', 'Brown', 'Singh', 'Taylor', 'Wilson', 'Kim', 'Martin', 'Anderson', 'Rossi', 'Haddad', 'Okafor', 'Tanaka', 'Garcia', 'Murphy', "O'Brien", 'Kowalski', 'Ahmed', 'Walker', 'Hughes', 'Fernando', 'Silva', 'Lee', 'Thompson', 'Jones', 'Wright', 'Kaur'];

const PROJECTS = [
  ['Student portal redesign', 'Client project', 'Rebuild the student self-service portal with the new design system and accessibility fixes.'],
  ['Agent onboarding automation', 'Internal tooling', 'Automate agent registration, agreement signing and induction tracking.'],
  ['CRICOS compliance audit 2026', 'Compliance', 'Prepare evidence packs and close findings from the annual compliance review.'],
  ['Spring intake campaign', 'Marketing campaign', 'Multi-channel campaign for the next student intake across AU and SEA markets.'],
  ['Cloud migration — phase 2', 'Infrastructure', 'Move the remaining on-prem services to managed cloud with zero downtime.'],
  ['Mobile attendance app', 'Client project', 'Native app for check-in, timetable and push reminders.'],
  ['Payroll integration', 'Internal tooling', 'Sync approved leave and timesheets straight into payroll.'],
  ['Website performance sprint', 'Infrastructure', 'Bring Core Web Vitals into the green on all marketing pages.'],
  ['AI tutoring pilot', 'Research', 'Prototype an AI study assistant with two pilot classes.'],
  ['Partner agent summit', 'Marketing campaign', 'Two-day summit for education agents in Melbourne.'],
  ['Records retention policy', 'Compliance', 'Define and implement document retention schedules.'],
  ['Help-desk knowledge base', 'Internal tooling', 'Self-service articles for the top 50 support questions.'],
  ['Course catalogue API', 'Client project', 'Public API for partner sites to list courses and intakes.'],
  ['Security hardening Q4', 'Infrastructure', 'MFA everywhere, secrets rotation, dependency patching.'],
];

const TASK_VERBS = ['Draft', 'Review', 'Build', 'Test', 'Design', 'Document', 'Plan', 'Deploy', 'Analyse', 'Prepare', 'Update', 'Migrate', 'Refactor', 'Present'];
const TASK_THINGS = ['login flow', 'requirements doc', 'API endpoints', 'database schema', 'landing page', 'email templates', 'user interviews', 'test cases', 'release notes', 'dashboard widgets', 'access controls', 'budget forecast', 'vendor shortlist', 'training slides', 'data export', 'monitoring alerts', 'onboarding checklist', 'style guide', 'search filters', 'audit evidence', 'backup scripts', 'payment form', 'survey results', 'sitemap'];
const REASONS_LEAVE = ['Family holiday', 'Medical appointment', 'Feeling unwell', "Child's school event", 'Moving house', 'Wedding in the family', 'Exam preparation', 'Personal matters', 'Dentist appointment', 'Travelling interstate'];
const REASONS_WFH = ['Waiting for a delivery', 'Tradesperson at home', 'Focus time for a deadline', 'Public transport disruption', 'Minor cold, not contagious', 'Caring for a family member'];
const COMMENTS = ['Looks good, a couple of small changes needed.', 'I pushed an update — can you take another look?', 'Blocked until we get access from IT.', 'Moved the deadline after talking with the client.', 'Great work on this!', 'Can we split this into two smaller tasks?', 'Added the screenshots to the shared drive.', 'Waiting on feedback from finance.', 'Done on my side, ready for review.', 'Let me know if you need a hand.'];
const ACTIVITIES = ['Stand-up and planning', 'Code review', 'Client call', 'Writing documentation', 'Bug fixing', 'Team meeting', 'Emails and admin', 'Feature development', 'Testing', 'Research', 'Training session', 'Interviewing candidates', 'Preparing report'];

function holidaysFor(year) {
  return [
    [`${year}-01-01`, "New Year's Day", []], [`${year}-01-26`, 'Australia Day', []],
    [`${year}-04-03`, 'Good Friday', []], [`${year}-04-06`, 'Easter Monday', []],
    [`${year}-04-27`, 'Anzac Day (observed)', []], [`${year}-06-08`, "King's Birthday", ['Sydney HQ', 'Melbourne']],
    [`${year}-03-09`, 'Labour Day (VIC)', ['Melbourne']], [`${year}-06-01`, 'Western Australia Day', ['Perth']],
    [`${year}-08-12`, 'Ekka People’s Day', ['Brisbane']], [`${year}-11-03`, 'Melbourne Cup Day', ['Melbourne']],
    [`${year}-12-24`, 'Christmas Eve (office closed)', []], [`${year}-12-25`, 'Christmas Day', []],
    [`${year}-12-28`, 'Boxing Day (observed)', []], [`${year}-12-31`, "New Year's Eve (office closed)", []],
  ];
}

async function seed() {
  await migrate();
  // --if-empty: used by the Vercel build. Only seeds when SEED_DEMO_DATA=true and there is no data yet,
  // so a redeploy never wipes real data.
  if (process.argv.includes('--if-empty')) {
    if (process.env.SEED_DEMO_DATA !== 'true') return console.log('SEED_DEMO_DATA is not "true" — skipping demo data');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM employees');
    if (rows[0].n > 0) return console.log(`database already has ${rows[0].n} employees — skipping demo data`);
  }
  const c = await pool.connect();
  const q = (text, params) => c.query(text, params).then((r) => r.rows);
  const ins = async (text, params) => (await q(text, params))[0];
  try {
    await c.query('BEGIN');
    const tables = (await q(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`)).map((r) => r.tablename);
    await c.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);

    // company + branches
    const company = await ins(
      `INSERT INTO companies(name, description, admin_email, admin_contact) VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Federation Education Group', 'Vocational and higher-education provider with campuses across Australia.', 'hr@example.com', '+61 2 9000 1000'],
    );
    const branchIds = {};
    for (const b of BRANCHES) {
      branchIds[b.name] = (await ins(`INSERT INTO branches(company_id, name, contact, address, city) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [company.id, b.name, b.contact, b.address, b.city])).id;
    }
    const branchList = Object.values(branchIds);

    // departments + designations
    const deptIds = {};
    const desigByDept = {};
    for (const [d, titles] of Object.entries(DEPARTMENTS)) {
      deptIds[d] = (await ins(`INSERT INTO departments(name, description) VALUES ($1,$2) RETURNING id`, [d, `${d} team`])).id;
      desigByDept[d] = [];
      for (const t of titles) {
        desigByDept[d].push((await ins(`INSERT INTO designations(name, department_id, description) VALUES ($1,$2,$3) RETURNING id, name`,
          [t, deptIds[d], `${t} in ${d}`])));
      }
    }

    // employee types + leave entitlements
    const jobIds = {};
    for (const [name, jt] of Object.entries(JOB_TYPES)) {
      jobIds[name] = (await ins(`INSERT INTO job_types(name, description) VALUES ($1,$2) RETURNING id`, [name, jt.desc])).id;
      for (const [lt, days] of Object.entries(jt.leave)) {
        await q(`INSERT INTO leave_types(job_type_id, name, days) VALUES ($1,$2,$3)`, [jobIds[name], lt, days]);
      }
    }
    for (const [n, d] of CATEGORIES) await q(`INSERT INTO project_categories(name, description) VALUES ($1,$2)`, [n, d]);
    const catIds = Object.fromEntries((await q('SELECT id, name FROM project_categories')).map((r) => [r.name, r.id]));

    // holidays (this year + next)
    for (const y of [YEAR, YEAR + 1]) {
      for (const [date, reason, branches] of holidaysFor(y)) {
        const h = await ins(`INSERT INTO holidays(holiday_date, reason) VALUES ($1,$2) RETURNING id`, [date, reason]);
        for (const b of branches) await q(`INSERT INTO holiday_branches(holiday_id, branch_id) VALUES ($1,$2)`, [h.id, branchIds[b]]);
      }
    }

    // ---------- employees ----------
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const emps = [];
    const usedNames = new Set();
    const makeName = () => {
      let n;
      do n = `${pick(FIRST)} ${pick(LAST)}`; while (usedNames.has(n));
      usedNames.add(n);
      return n;
    };
    const fixed = [
      { name: 'Sarah Mitchell', email: 'superadmin@example.com', role: 'Super Admin', dept: 'Human Resources', title: 'Head of People' },
      { name: 'David Park', email: 'admin@example.com', role: 'Admin', dept: 'Human Resources', title: 'HR Business Partner' },
      { name: 'Lauren Hughes', email: 'admin2@example.com', role: 'Admin', dept: 'Operations', title: 'Office Manager' },
      { name: 'Michael Torres', email: 'manager@example.com', role: 'Manager', dept: 'Engineering', title: 'Engineering Manager' },
      { name: 'Emma Clarke', email: 'employee@example.com', role: 'Employee', dept: 'Engineering', title: 'Software Engineer' },
    ];
    const managersPerDept = {};
    let code = 1001;
    const addEmp = async ({ name, email, role, dept, title, reporter, job }) => {
      usedNames.add(name);
      const desig = desigByDept[dept].find((d) => d.name === title) || pick(desigByDept[dept]);
      const branch = role === 'Super Admin' || chance(0.45) ? branchIds['Sydney HQ'] : pick(branchList);
      const start = addDays(TODAY, -int(60, 2600));
      const [first, last] = name.split(' ');
      const slug = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
      const row = await ins(
        `INSERT INTO employees(emp_code, email, password_hash, role, full_name, reporter_id, branch_id, job_type_id, department_id,
           designation_id, start_date, lieu_days, profile, bank, emergency, social)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [
          `EMP-${code++}`, email || `${slug}@example.com`, hash, role, name, reporter ?? null, branch,
          jobIds[job || (chance(0.75) ? 'Full-time' : pick(['Part-time', 'Contract', 'Intern']))],
          deptIds[dept], desig.id, iso(start), pick([0, 0, 0, 1, 2, 3]),
          {
            dob: iso(addDays(TODAY, -int(22 * 365, 58 * 365))), gender: pick(['Female', 'Male', 'Non-binary', 'Prefer not to say']),
            mobile: `04${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`, personal_email: `${slug}@mail.example`,
            current_address: `${int(1, 250)} ${pick(['High', 'Church', 'Park', 'Station', 'King', 'Queen'])} St`,
            marital_status: pick(['Single', 'Married', 'Partnered']), education: pick(['Bachelor of IT', 'Bachelor of Business', 'Master of Education', 'Diploma of Marketing', 'Bachelor of Design', 'MBA']),
          },
          { bank_name: pick(['Commonwealth Bank', 'Westpac', 'ANZ', 'NAB', 'ING']), account_name: name, branch: 'Main', account_number: `${int(100000, 999999)}${int(100, 999)}` },
          { name: `${pick(FIRST)} ${last}`, relationship: pick(['Partner', 'Parent', 'Sibling', 'Friend']), mobile: `04${int(10, 99)} ${int(100, 999)} ${int(100, 999)}` },
          { linkedin: `https://linkedin.com/in/${slug.replace('.', '-')}` },
        ],
      );
      const e = { id: row.id, name, role, dept, branch };
      emps.push(e);
      return e;
    };

    const sarah = await addEmp(fixed[0]);
    const david = await addEmp({ ...fixed[1], reporter: sarah.id });
    await addEmp({ ...fixed[2], reporter: sarah.id });
    const michael = await addEmp({ ...fixed[3], reporter: sarah.id, job: 'Full-time' });
    managersPerDept.Engineering = michael;
    for (const dept of Object.keys(DEPARTMENTS)) {
      if (managersPerDept[dept]) continue;
      const title = { 'Product & Design': 'Product Manager', 'Human Resources': 'Head of People', Finance: 'Finance Manager', 'Sales & Marketing': 'Sales Manager', 'Customer Support': 'Support Team Lead', Operations: 'Office Manager', 'Student Services': 'Compliance Officer' }[dept];
      managersPerDept[dept] = await addEmp({ name: makeName(), role: 'Manager', dept, title, reporter: sarah.id, job: 'Full-time' });
    }
    await addEmp({ ...fixed[4], reporter: michael.id, job: 'Full-time' });
    const deptWeights = ['Engineering', 'Engineering', 'Engineering', 'Engineering', 'Product & Design', 'Product & Design', 'Sales & Marketing', 'Sales & Marketing', 'Customer Support', 'Customer Support', 'Student Services', 'Student Services', 'Finance', 'Human Resources', 'Operations'];
    while (emps.length < 64) {
      const dept = pick(deptWeights);
      await addEmp({ name: makeName(), role: 'Employee', dept, title: pick(DEPARTMENTS[dept].filter((t) => !/Manager|Head|Lead/.test(t))), reporter: managersPerDept[dept].id });
    }
    // two former staff
    const inactive = sample(emps.filter((e) => e.role === 'Employee' && e.id > 10), 2);
    for (const e of inactive) {
      await q(`UPDATE employees SET is_active = false, end_date = $2 WHERE id = $1`, [e.id, iso(addDays(TODAY, -int(20, 120)))]);
      e.inactive = true;
    }
    const active = emps.filter((e) => !e.inactive);
    const byDept = (d) => active.filter((e) => e.dept === d);

    // ---------- teams ----------
    const TEAMS = [
      ['Platform', 'Engineering', 'Core platform & APIs'], ['Web Experience', 'Engineering', 'Portals and marketing sites'],
      ['Mobile', 'Engineering', 'iOS and Android apps'], ['Design Guild', 'Product & Design', 'Design system and research'],
      ['Growth', 'Sales & Marketing', 'Acquisition and campaigns'], ['Student Success', 'Student Services', 'Admissions and student care'],
      ['Support Squad', 'Customer Support', 'Front-line help desk'], ['People Ops', 'Human Resources', 'Hiring, onboarding and culture'],
    ];
    const teamIds = [];
    for (const [name, dept, desc] of TEAMS) {
      const pool_ = byDept(dept);
      const members = sample(pool_.filter((e) => e.role === 'Employee'), Math.min(pool_.length, int(3, 7)));
      if (dept === 'Engineering' && name !== 'Mobile' && !members.some((m) => m.name === 'Emma Clarke')) members.push(active.find((e) => e.name === 'Emma Clarke'));
      const t = await ins(`INSERT INTO teams(name, description, leader_id) VALUES ($1,$2,$3) RETURNING id`, [name, desc, managersPerDept[dept].id]);
      for (const m of members) await q(`INSERT INTO team_members(team_id, employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [t.id, m.id]);
      teamIds.push({ id: t.id, dept, members });
    }

    // ---------- projects + tasks ----------
    const managers = active.filter((e) => ['Manager', 'Admin', 'Super Admin'].includes(e.role));
    let taskCount = 0;
    const addTask = async (t) => {
      const due = t.due ? iso(nextWeekday(t.due)) : null;
      const status = t.status;
      const done = status === 'done';
      const approval = done && t.reporter ? pick(['approved', 'approved', 'approved', 'pending']) : null;
      const row = await ins(
        `INSERT INTO tasks(project_id, parent_id, depth, kind, title, description, priority, status, due_date, assignee_id, reporter_id,
           estimate_hours, started_at, completed_at, completion_note, approval, repeat_rule, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
        [t.project ?? null, t.parent ?? null, t.depth || 1, t.kind, t.title, t.description || `${t.title}. Keep notes in the comments and link any files.`,
          t.priority || pick(['low', 'medium', 'medium', 'high']), status, due, t.assignee, t.reporter ?? null, pick([null, 2, 4, 6, 8, 16]),
          status !== 'todo' ? addDays(TODAY, -int(3, 30)) : null, done ? addDays(TODAY, -int(0, 20)) : null,
          done ? pick(['Completed as planned.', 'Done — see comments for details.', null]) : null, approval, t.repeat ?? null, t.creator,
          addDays(TODAY, -int(30, 90))],
      );
      taskCount++;
      await q(`INSERT INTO task_activity(task_id, actor_id, action, created_at) VALUES ($1,$2,'created',$3)`, [row.id, t.creator, addDays(TODAY, -int(30, 90))]);
      if (status !== 'todo') await q(`INSERT INTO task_activity(task_id, actor_id, action, changes, created_at) VALUES ($1,$2,'status',$3,$4)`,
        [row.id, t.assignee, { status: { from: 'todo', to: status } }, addDays(TODAY, -int(0, 20))]);
      for (let i = 0, n = chance(0.5) ? int(1, 4) : 0; i < n; i++) {
        await q(`INSERT INTO task_comments(task_id, author_id, body, created_at) VALUES ($1,$2,$3,$4)`,
          [row.id, pick([t.assignee, t.reporter || t.creator, t.creator]), pick(COMMENTS), addDays(TODAY, -int(0, 25))]);
      }
      return row.id;
    };
    const taskTitle = () => `${pick(TASK_VERBS)} ${pick(TASK_THINGS)}`;

    for (const [i, [name, cat, desc]] of PROJECTS.entries()) {
      const owner = i < 3 ? michael : pick(managers);
      const status = i < 7 ? 'active' : pick(['planned', 'active', 'on_hold', 'completed', 'completed']);
      const start = addDays(TODAY, status === 'planned' ? int(5, 40) : -int(20, 200));
      const end = addDays(start, int(45, 240));
      const p = await ins(
        `INSERT INTO projects(name, description, category_id, owner_id, priority, status, start_date, end_date, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [name, desc, catIds[cat], owner.id, pick(['low', 'medium', 'high', 'high']), status, iso(start), iso(end), chance(0.5) ? 'Weekly check-in on Mondays at 10am.' : ''],
      );
      const team = pick(teamIds);
      const members = [...new Set([...sample(active.filter((e) => e.role === 'Employee'), int(3, 6)), ...(i < 4 ? [active.find((e) => e.name === 'Emma Clarke')] : [])])];
      const reporters = sample(managers.filter((m) => m.id !== owner.id), 1);
      for (const m of members) await q(`INSERT INTO project_members VALUES ($1,$2,'member') ON CONFLICT DO NOTHING`, [p.id, m.id]);
      for (const r of reporters) await q(`INSERT INTO project_members VALUES ($1,$2,'reporter') ON CONFLICT DO NOTHING`, [p.id, r.id]);
      await q(`INSERT INTO project_teams VALUES ($1,$2)`, [p.id, team.id]);
      for (const k of sample(['On-time delivery', 'Budget within 5%', 'NPS above 40', 'Zero critical bugs at launch', 'All staff trained', 'Audit findings closed', '95% uptime'], 3)) {
        await q(`INSERT INTO project_kpis(project_id, name) VALUES ($1,$2)`, [p.id, k]);
      }
      for (let k = 0, n = int(5, 10); k < n; k++) {
        const st = status === 'completed' ? 'done' : status === 'planned' ? 'todo' : pick(['todo', 'in_progress', 'done', 'done']);
        const assignee = pick(members).id;
        const tid = await addTask({ project: p.id, kind: 'project', title: taskTitle(), status: st, due: addDays(TODAY, int(-25, 60)), assignee, reporter: owner.id, creator: owner.id });
        if (chance(0.45)) {
          for (let j = 0, m = int(1, 3); j < m; j++) {
            const sid = await addTask({ project: p.id, parent: tid, depth: 2, kind: 'project', title: taskTitle(), status: st === 'done' ? 'done' : pick(['todo', 'in_progress', 'done']), due: addDays(TODAY, int(-10, 40)), assignee: pick(members).id, creator: assignee });
            if (chance(0.3)) await addTask({ project: p.id, parent: sid, depth: 3, kind: 'project', title: taskTitle(), status: st === 'done' ? 'done' : 'todo', due: addDays(TODAY, int(0, 30)), assignee, creator: assignee });
          }
        }
      }
    }
    // stand-alone one-time tasks
    for (let k = 0; k < 70; k++) {
      const mgr = pick(managers);
      const assignee = k < 8 ? active.find((e) => e.name === 'Emma Clarke') : pick(active.filter((e) => e.id !== mgr.id));
      await addTask({ kind: 'one_time', title: taskTitle(), status: pick(['todo', 'todo', 'in_progress', 'done']), due: addDays(TODAY, int(-15, 45)), assignee: assignee.id, reporter: chance(0.6) ? mgr.id : null, creator: mgr.id });
    }
    // repeating tasks
    const REPEATING = [
      ['Submit weekly status report', 'week'], ['Check backup logs', 'day'], ['Monthly payroll reconciliation', 'month'],
      ['Review open support tickets', 'week'], ['Update student enrolment numbers', 'week'], ['Team 1:1 notes', 'week'],
      ['Monthly compliance checklist', 'month'], ['Rotate on-call roster', 'month'], ['Clear shared inbox', 'day'],
    ];
    for (const [title, unit] of REPEATING) {
      const mgr = pick(managers);
      const assignee = title.includes('weekly status') ? active.find((e) => e.name === 'Emma Clarke') : pick(active);
      await addTask({ kind: 'repeating', title, status: 'todo', due: addDays(TODAY, int(0, 6)), assignee: assignee.id, reporter: assignee.id === mgr.id ? null : mgr.id, creator: mgr.id, repeat: { every: 1, unit, until: null } });
    }

    // ---------- leave & WFH requests ----------
    const ltByJob = {};
    for (const r of await q(`SELECT j.id, l.name FROM job_types j JOIN leave_types l ON l.job_type_id = j.id`)) (ltByJob[r.id] ||= []).push(r.name);
    const empJob = Object.fromEntries((await q('SELECT id, job_type_id, reporter_id FROM employees')).map((r) => [r.id, r]));
    let reqCount = 0;
    for (const e of active) {
      const taken = [];
      const n = e.name === 'Emma Clarke' ? 7 : int(1, 5);
      for (let k = 0; k < n; k++) {
        const kind = chance(0.65) ? 'leave' : 'wfh';
        const start = nextWeekday(addDays(TODAY, int(-300, 60)));
        if (start.getUTCFullYear() !== YEAR) continue;
        const end = nextWeekday(addDays(start, kind === 'leave' ? pick([0, 0, 1, 2, 4]) : pick([0, 0, 1])));
        if (end.getUTCFullYear() !== YEAR || taken.some(([a, b]) => start <= b && end >= a)) continue;
        taken.push([start, end]);
        const types = ltByJob[empJob[e.id].job_type_id] || [];
        if (kind === 'leave' && !types.length) continue;
        const future = start > TODAY;
        const status = future ? pick(['pending', 'pending', 'approved', 'cancelled']) : pick(['approved', 'approved', 'approved', 'approved', 'rejected', 'cancelled']);
        const decider = empJob[e.id].reporter_id || sarah.id;
        await q(
          `INSERT INTO requests(employee_id, kind, leave_type, start_date, end_date, reason, status, decided_by, decided_at, decision_note, cancel_reason, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [e.id, kind, kind === 'leave' ? pick(types.slice(0, 2).concat(types)) : null, iso(start), iso(end),
            pick(kind === 'leave' ? REASONS_LEAVE : REASONS_WFH), status,
            ['approved', 'rejected'].includes(status) ? decider : null, ['approved', 'rejected'].includes(status) ? addDays(start, -int(2, 10)) : null,
            status === 'rejected' ? pick(['Team is short-staffed that week', 'Clashes with the client launch', 'Please give more notice']) : null,
            status === 'cancelled' ? pick(['Plans changed', 'No longer needed']) : null, addDays(start, -int(3, 20))],
        );
        reqCount++;
      }
    }
    // a few people on leave / WFH today so the dashboard has something to show
    for (const e of sample(active.filter((x) => x.role === 'Employee' && x.name !== 'Emma Clarke'), 5)) {
      const clash = await q(`SELECT 1 FROM requests WHERE employee_id = $1 AND status IN ('pending','approved') AND $2::date BETWEEN start_date - 3 AND end_date + 3`, [e.id, iso(TODAY)]);
      if (clash.length) continue;
      const kind = chance(0.6) ? 'leave' : 'wfh';
      const types = ltByJob[empJob[e.id].job_type_id] || [];
      if (kind === 'leave' && !types.length) continue;
      await q(`INSERT INTO requests(employee_id, kind, leave_type, start_date, end_date, reason, status, decided_by, decided_at) VALUES ($1,$2,$3,$4,$5,$6,'approved',$7, now() - interval '5 days')`,
        [e.id, kind, kind === 'leave' ? types[0] : null, iso(addDays(TODAY, -1)), iso(addDays(TODAY, 1)), pick(kind === 'leave' ? REASONS_LEAVE : REASONS_WFH), empJob[e.id].reporter_id || sarah.id]);
      reqCount++;
    }

    // ---------- daily work reports (last 25 working days) ----------
    const holidaySet = new Set((await q('SELECT holiday_date FROM holidays')).map((r) => r.holiday_date));
    const leaveDays = await q(`SELECT employee_id, start_date, end_date FROM requests WHERE kind = 'leave' AND status = 'approved'`);
    const someTasks = await q(`SELECT id, assignee_id FROM tasks WHERE status <> 'todo'`);
    let reports = 0;
    for (let d = 0; d <= 36; d++) {
      const day = addDays(TODAY, -d);
      const dayIso = iso(day);
      if (isWeekend(day) || holidaySet.has(dayIso)) continue;
      for (const e of active) {
        if (!chance(d === 0 ? 0.7 : 0.86)) continue;
        if (d === 0 && ['Sarah Mitchell', 'Emma Clarke', 'Michael Torres'].includes(e.name)) continue; // leave the 'add report' flow to try
        if (leaveDays.some((l) => l.employee_id === e.id && dayIso >= l.start_date && dayIso <= l.end_date)) continue;
        const inH = pick([8, 8, 8, 9, 9, 7]);
        const inM = pick(['00', '15', '30', '45']);
        const outH = inH + pick([8, 8, 9, 9, 10]);
        const r = await ins(`INSERT INTO work_reports(employee_id, work_date, time_in, time_out, rating, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [e.id, dayIso, `${String(inH).padStart(2, '0')}:${inM}`, `${outH}:${pick(['00', '15', '30'])}`, pick([3, 4, 4, 4, 5, 5, 2]), chance(0.25) ? pick(['Productive day.', 'Lots of meetings.', 'Blocked for part of the afternoon.', 'Wrapped up the sprint goals.']) : '']);
        let h = inH;
        const mine = someTasks.filter((t) => t.assignee_id === e.id);
        for (let k = 0, n = int(2, 4); k < n && h < outH - 1; k++) {
          const len = int(1, 3);
          await q(`INSERT INTO work_report_items(report_id, start_time, end_time, task_id, description) VALUES ($1,$2,$3,$4,$5)`,
            [r.id, `${String(h).padStart(2, '0')}:00`, `${String(Math.min(h + len, outH)).padStart(2, '0')}:00`, mine.length && chance(0.5) ? pick(mine).id : null, pick(ACTIVITIES)]);
          h += len;
        }
        reports++;
      }
    }

    // ---------- notifications ----------
    const NOTES = [
      ['New task assigned to you', 'Review API endpoints', '/tasks'], ['Your leave request was approved', 'Annual leave approved by your manager', '/requests'],
      ['Task ready for review', 'Test login flow', '/tasks?scope=review'], ['Company holiday', 'Christmas Day — office closed', '/holidays'],
      ['You were added to a project', 'Student portal redesign', '/projects'], ['New comment', 'Michael Torres commented on "Build dashboard widgets"', '/tasks'],
      ['Reminder', "Don't forget to submit today's work report", '/work-reports'],
    ];
    for (const e of active) {
      for (const [k, [title, body, link]] of sample(NOTES, int(2, 6)).entries()) {
        await q(`INSERT INTO notifications(employee_id, title, body, link, read_at, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
          [e.id, title, body, link, k > 1 && chance(0.7) ? addDays(TODAY, -1) : null, new Date(Date.now() - int(1, 600) * 3600 * 1000)]);
      }
    }

    await c.query('COMMIT');
    console.log(`Seeded: ${emps.length} employees, ${PROJECTS.length} projects, ${taskCount} tasks, ${reqCount} leave/WFH requests, ${reports} work reports.`);
    console.log(`\nDemo logins (password: ${DEMO_PASSWORD})`);
    for (const f of fixed) console.log(`  ${f.role.padEnd(12)} ${f.email}`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}
