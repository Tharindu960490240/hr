# Issues found in the original project — and how the rewrite fixes them

The original was an Angular 9 + Argon template frontend with an Express + MongoDB (Mongoose) backend.
Below is what was wrong, grouped by severity. Each item says how the new React + MUI / Node + PostgreSQL version handles it.

## Critical — security

| # | Issue (original) | Where | Fix in rewrite |
|---|---|---|---|
| 1 | **Secrets committed to the repo**: a Firebase service-account private key (`private_key.json`) and the Gmail account password (`Lo0NsLaB@LaN111A`) in plain text. | `backend/private_key.json`, `routes/send_maill.js` | All secrets come from `.env` (never committed; `.env.example` provided). **Rotate both the Firebase key and the Gmail password now — they are compromised even if deleted.** |
| 2 | **Hard-coded JWT secret** `"jwtPrivateKey"`; the config value was ignored. Anyone can forge an admin token. | `middleware/auth.js`, `models/employee.js` | `JWT_SECRET` env var is required (server refuses to start without one ≥ 32 chars). Tokens expire (`JWT_EXPIRES_IN`, default 8h). |
| 3 | **98 of 115 API routes have no authentication** — e.g. create/delete employee, approve leave, delete company, list all employees with bank details. | all `routes/*.js` | Every route except login / forgot / reset password requires a valid token. |
| 4 | **No authorisation**: `admin` middleware checks `req.user.isAdmin`, which never exists in the token, and it calls `next()` even after sending 403. Any logged-in user could approve their own leave, edit other people's profiles or change their own role. | `middleware/admin.js`, `routes/employee.js` (`/update/:type/:id?`) | Role-based `requireRole()` (Super Admin / Admin / Manager / Employee). Employees can edit only their own personal fields — never role, email, employee ID or status. Nobody can approve their own request. |
| 5 | **Anyone can reset anyone's password** — `/frogot_password` takes an email and a new password with no token or verification. | `service/employeer_service.js` | Proper reset flow: emailed one-time token (hashed in DB, 30-min expiry), generic response so emails can't be enumerated. |
| 6 | **Change-password checks the wrong value**: compares the *new* password to the stored hash instead of the *old* one, so it only "works" when old == new. | `employeer_service.update_password` | Verifies current password, then sets the new one. |
| 7 | **Plain-text passwords emailed** to users (on create and on every password change). | `send_maill.js` | New users get a one-time "set your password" link; passwords are never emailed. |
| 8 | `GET /employee/all` returns everyone's bank account, NIC and address to any caller. | `dao/employee_dao.js` | List endpoint returns directory fields only; bank/ID/emergency data visible only to the person and admins. |
| 9 | **Stored XSS**: task descriptions rendered with `innerHTML`. | `all-task`, `view-task` templates | React escapes all text; no raw HTML rendering. |
| 10 | Wide-open CORS (`*`) set twice, plus a dead CORS middleware registered after the routes. | `index.js`, `middleware/cors.js` | Single `cors()` limited to `CORS_ORIGIN`. |
| 11 | No brute-force protection on login. | `routes/employee.js` | Rate limit on auth endpoints. |
| 12 | Uploads: file type trusted from the client, no size limit enforced before buffering, crashes if `pic` field missing, uploaded folder served publicly with `express.static("upload")` (NIC scans readable by anyone who guesses the id). | employee/company/project routes | `multer` with size + MIME limits; files served only through authenticated endpoints. |
| 13 | Destructive actions on `GET` (`GET /delete/:id`) — can be triggered by a link or a prefetch. | all routes | REST verbs: `DELETE`, `PATCH`, `POST`. |

## High — bugs that break features

| # | Issue | Fix |
|---|---|---|
| 14 | Server crashes on startup errors: global error handler calls `winston.error` (never imported) and `res.render('error')` (no view engine). Any thrown error inside an `async` route is an unhandled rejection (Express 4). | Central error handler returning JSON; Express 5 handles async errors. |
| 15 | Port and DB URL hard-coded (`3008`, `mongodb://localhost:27017/office`), config ignored. | `PORT`, `DATABASE_URL` from env. |
| 16 | `returnfind;` typo in attendance → `ReferenceError` when there are no employees. | Rewritten as a single SQL query. |
| 17 | Attendance and work-report "is this a leave day?" checks use `date > from && date < to`, so the **last day of a leave is counted as a work day**. | Inclusive `daterange` checks in SQL. |
| 18 | Leave balance counts **number of requests**, not number of days; a 5-day leave uses 1 day of balance. | Balance = working days (Mon–Fri minus company holidays) of approved leave in the current year, per leave type. |
| 19 | Leave/WFH lists drop next year's requests (`thisyear >= year` filter) and keep every past year. | Filter by date range in SQL. |
| 20 | Users can overlap requests, request leave ending before it starts, or edit/delete someone else's request (no ownership check). Cancelling an approved leave silently keeps it counted. | Validation (end ≥ start, no overlaps with pending/approved), ownership checks, status machine. |
| 21 | Mandatory-leave (holiday) creation only notifies **one** employee per branch (`findOne`). | Notifies every active employee in the selected branches. |
| 22 | `email.date` default `new Date()` is evaluated once at server start, so every email row gets the same timestamp. Same pattern elsewhere. | `DEFAULT now()` in PostgreSQL. |
| 23 | `LeaveLeave` references model `"User"` which doesn't exist; `Mandatory.user` references `Job` instead of `Employee`. | Real foreign keys with `ON DELETE` rules. |
| 24 | Employee delete leaves orphaned leave requests, work reports, team memberships, tasks. | FK constraints (cascade / set null as appropriate); employees are deactivated rather than hard-deleted by default. |
| 25 | Route regex `:type(approve||reject)` contains an empty alternative. | Explicit `/approve` and `/reject` routes. |
| 26 | Tasks and project tasks are copy-pasted three levels deep (`level_two`, `level_three`) in two separate models, with ~1 000 lines of near-duplicate service code. | One `tasks` table with `parent_id` (sub-tasks up to 3 levels), `project_id` nullable for standalone one-time / repeating tasks. |
| 27 | No input validation on most endpoints (Joi only on login). | `zod` schemas on every write endpoint. |
| 28 | `account_number` stored as `Number` — loses leading zeros and overflows long account numbers. | Stored as text. |
| 29 | Emails are sent `from:` the *employee's* address via the company Gmail — rejected/spoofed by SMTP. | Sent from `MAIL_FROM` with `replyTo` set to the employee. |

## Medium — maintenance / build

| # | Issue | Fix |
|---|---|---|
| 30 | Dependencies are 5–6 years old with known CVEs (Angular 9, Mongoose 5, jimp 0.9, bcrypt 4, `angular` 1.x *and* Angular 9 both installed, `@angular/http` 7, jQuery). Node engine pinned to 10.16.3 (EOL 2021). | React 19, MUI 9, Vite, Express 5, `pg`, Node ≥ 20. |
| 31 | Unneeded npm packages `fs`, `path`, `update` installed from npm (the first two are security-placeholder packages). | Removed. |
| 32 | Leftover template/demo pages and routes (icons, maps, tables, register), `debug.log` committed, Argon docs folder. | Removed. |
| 33 | Typos baked into APIs (`frogot_password`, `massage`, `emmergancy`, `resiver`, `reqested_date`, `asign`, `cancle`). | Consistent naming. |
| 34 | Token stored in `localStorage` and never expires; logout doesn't stop timers/polling. | Expiring JWT; 401 anywhere logs the user out cleanly. |
| 35 | Firebase push notifications depend on the leaked key. | Replaced by in-app notifications (bell + page). Push can be added later with a fresh key. |
