-- Office HR — initial schema (PostgreSQL 14+)

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- organisation ----------
CREATE TABLE companies (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  admin_email   citext,
  admin_contact text,
  logo_path     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id          serial PRIMARY KEY,
  company_id  int NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  contact     text NOT NULL DEFAULT '',
  address     text NOT NULL DEFAULT '',
  city        text NOT NULL DEFAULT '',
  UNIQUE (company_id, name)
);

CREATE TABLE departments (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE designations (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  department_id int NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  description   text NOT NULL DEFAULT '',
  UNIQUE (department_id, name)
);

-- "Employee type" in the old UI (permanent, contract, intern ...)
CREATE TABLE job_types (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT ''
);

-- leave entitlement per employee type, per calendar year
CREATE TABLE leave_types (
  id           serial PRIMARY KEY,
  job_type_id  int NOT NULL REFERENCES job_types(id) ON DELETE CASCADE,
  name         text NOT NULL,
  days         numeric(5,1) NOT NULL CHECK (days >= 0),
  UNIQUE (job_type_id, name)
);

-- ---------- people ----------
CREATE TABLE employees (
  id              serial PRIMARY KEY,
  emp_code        text NOT NULL UNIQUE,
  email           citext NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  role            text NOT NULL DEFAULT 'Employee'
                  CHECK (role IN ('Super Admin','Admin','Manager','Employee')),
  is_active       boolean NOT NULL DEFAULT true,
  full_name       text NOT NULL,
  reporter_id     int REFERENCES employees(id) ON DELETE SET NULL,
  branch_id       int REFERENCES branches(id) ON DELETE SET NULL,
  job_type_id     int REFERENCES job_types(id) ON DELETE SET NULL,
  department_id   int REFERENCES departments(id) ON DELETE SET NULL,
  designation_id  int REFERENCES designations(id) ON DELETE SET NULL,
  start_date      date,
  end_date        date,
  lieu_days       numeric(5,1) NOT NULL DEFAULT 0 CHECK (lieu_days >= 0),
  profile         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- dob, gender, phone, addresses, education ...
  bank            jsonb NOT NULL DEFAULT '{}'::jsonb,
  emergency       jsonb NOT NULL DEFAULT '{}'::jsonb,
  social          jsonb NOT NULL DEFAULT '{}'::jsonb,
  avatar_path     text,
  id_front_path   text,
  id_back_path    text,
  reset_token_hash    text,
  reset_token_expires timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX employees_branch_idx ON employees(branch_id);
CREATE INDEX employees_reporter_idx ON employees(reporter_id);

-- ---------- leave & work-from-home ----------
CREATE TABLE requests (
  id            serial PRIMARY KEY,
  employee_id   int NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('leave','wfh')),
  leave_type    text,                       -- name from leave_types, or 'Lieu leave'
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  reason        text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by    int REFERENCES employees(id) ON DELETE SET NULL,
  decided_at    timestamptz,
  decision_note text,
  cancel_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (kind = 'wfh' OR leave_type IS NOT NULL)
);
CREATE INDEX requests_employee_idx ON requests(employee_id, start_date);
CREATE INDEX requests_status_idx ON requests(status);

-- company holidays ("mandatory leave")
CREATE TABLE holidays (
  id          serial PRIMARY KEY,
  holiday_date date NOT NULL,
  reason      text NOT NULL,
  created_by  int REFERENCES employees(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE holiday_branches (
  holiday_id int NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
  branch_id  int NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (holiday_id, branch_id)
);

-- ---------- daily work reports ----------
CREATE TABLE work_reports (
  id           serial PRIMARY KEY,
  employee_id  int NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date    date NOT NULL,
  time_in      time NOT NULL,
  time_out     time NOT NULL,
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date),
  CHECK (time_out > time_in)
);
CREATE TABLE work_report_items (
  id          serial PRIMARY KEY,
  report_id   int NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  task_id     int,  -- FK added after tasks table
  description text NOT NULL,
  CHECK (end_time > start_time)
);

-- ---------- teams & projects ----------
CREATE TABLE teams (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  leader_id   int REFERENCES employees(id) ON DELETE SET NULL
);
CREATE TABLE team_members (
  team_id     int NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  employee_id int NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, employee_id)
);

CREATE TABLE project_categories (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE projects (
  id           serial PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  category_id  int REFERENCES project_categories(id) ON DELETE SET NULL,
  owner_id     int REFERENCES employees(id) ON DELETE SET NULL,
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status       text NOT NULL DEFAULT 'planned'
               CHECK (status IN ('planned','active','on_hold','completed','cancelled')),
  start_date   date,
  end_date     date,
  note         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE TABLE project_members (
  project_id  int NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id int NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member' CHECK (member_role IN ('member','reporter')),
  PRIMARY KEY (project_id, employee_id, member_role)
);
CREATE TABLE project_teams (
  project_id int NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id    int NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, team_id)
);
CREATE TABLE project_kpis (
  id         serial PRIMARY KEY,
  project_id int NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text NOT NULL
);

-- one table for project tasks, one-time tasks, repeating tasks and their sub-tasks
CREATE TABLE tasks (
  id              serial PRIMARY KEY,
  project_id      int REFERENCES projects(id) ON DELETE CASCADE,
  parent_id       int REFERENCES tasks(id) ON DELETE CASCADE,
  depth           smallint NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 3),
  kind            text NOT NULL DEFAULT 'one_time' CHECK (kind IN ('project','one_time','repeating')),
  title           text NOT NULL,
  description     text NOT NULL DEFAULT '',
  priority        text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status          text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  due_date        date,
  assignee_id     int REFERENCES employees(id) ON DELETE SET NULL,
  reporter_id     int REFERENCES employees(id) ON DELETE SET NULL,
  estimate_hours  numeric(6,2) CHECK (estimate_hours IS NULL OR estimate_hours >= 0),
  started_at      timestamptz,
  completed_at    timestamptz,
  completion_note text,
  approval        text CHECK (approval IN ('pending','approved','rejected')),
  approval_note   text,
  repeat_rule     jsonb,   -- {every: 1, unit: 'week', days: [1,3], until: '2026-12-31'}
  created_by      int REFERENCES employees(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'project' OR project_id IS NOT NULL),
  CHECK (kind <> 'repeating' OR repeat_rule IS NOT NULL)
);
CREATE INDEX tasks_assignee_idx ON tasks(assignee_id, status);
CREATE INDEX tasks_reporter_idx ON tasks(reporter_id);
CREATE INDEX tasks_project_idx ON tasks(project_id);
CREATE INDEX tasks_parent_idx ON tasks(parent_id);

ALTER TABLE work_report_items
  ADD CONSTRAINT work_report_items_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

CREATE TABLE task_comments (
  id         serial PRIMARY KEY,
  task_id    int NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  int REFERENCES employees(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_activity (
  id         serial PRIMARY KEY,
  task_id    int NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id   int REFERENCES employees(id) ON DELETE SET NULL,
  action     text NOT NULL,
  changes    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- notifications & email log ----------
CREATE TABLE notifications (
  id          serial PRIMARY KEY,
  employee_id int NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  link        text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_employee_idx ON notifications(employee_id, read_at);

CREATE TABLE email_log (
  id         serial PRIMARY KEY,
  sender     text NOT NULL,
  recipient  text NOT NULL,
  subject    text NOT NULL,
  delivered  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- working days (Mon–Fri, minus holidays for the employee's branch) between two dates, inclusive
CREATE OR REPLACE FUNCTION working_days(p_from date, p_to date, p_branch int)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int
  FROM generate_series(p_from, p_to, interval '1 day') AS d(day)
  WHERE extract(isodow FROM d.day) < 6
    AND NOT EXISTS (
      SELECT 1 FROM holidays h
      LEFT JOIN holiday_branches hb ON hb.holiday_id = h.id
      WHERE h.holiday_date = d.day::date
        AND (hb.branch_id IS NULL OR hb.branch_id = p_branch)
    );
$$;
