# Office HR — React + MUI / Node.js + PostgreSQL

A rewrite of the original Angular + MongoDB office HR / task manager.
**See [ISSUES.md](ISSUES.md)** for the 35 problems found in the original project and how each is fixed.

| | |
|---|---|
| **Frontend** | React 19, Material UI 9, React Router 7, Vite — `frontend/` |
| **Backend** | Node.js ≥ 20, Express 5, PostgreSQL 14+ (`pg`), zod validation, JWT — `backend/` |

## Quick start (local)

```bash
docker compose up -d                    # PostgreSQL (or use your own)
npm install                             # installs backend + frontend (npm workspaces)
cp backend/.env.example backend/.env    # set JWT_SECRET to a long random string
npm run db:seed                         # creates tables + loads demo data
npm run dev:api                         # API  → http://localhost:4000
npm run dev:web                         # web  → http://localhost:5173 (new terminal)
```

### Demo accounts — password `Password@123`

| Role | Email |
|---|---|
| Super Admin | superadmin@example.com |
| Admin | admin@example.com |
| Manager | manager@example.com |
| Employee | employee@example.com |

`npm run seed` wipes and reloads: 64 employees across 4 branches and 8 departments, 4 employee types with leave
entitlements, 14 projects with nested tasks (3 levels), ~70 one-time and 9 repeating tasks, ~200 leave / WFH requests,
~1,300 daily work reports (last 5 weeks incl. today), this and next year's public holidays, teams and notifications.

### Tests
```bash
npm run db:seed && npm test     # 11 API integration tests (auth, permissions, leave, tasks, Blob uploads…)
```

## What's in it

- **Navigation** — dark grouped sidebar (Dashboard · My work · Projects · People and records · Organisation) with
  collapsible sections, red active marker, counters, and a *Collapse* mode (icons + tooltips). Menu items are filtered by role.
- **Dashboard** — my tasks, deadlines, leave balance, holidays; managers also get approvals, headcount, who's out today and a 2-week chart.
- **Leave & work from home** — balance per leave type (working days, holidays excluded), overlap & balance checks, edit/cancel; managers approve/reject with notes.
- **Daily work report** — time in/out, activities linked to tasks, rating. **Attendance** view per day built from reports + approved requests.
- **Projects & tasks** — members, reporters, teams, KPIs; tasks with up to 3 levels of sub-tasks, review/approval, comments, history; repeating tasks auto-create the next one.
- **People** — directory, add (email invite — passwords are never emailed), edit, deactivate, photo upload, CSV export; each person maintains their own personal / bank / emergency details.
- **Organisation** — company & branches (logo), departments, designations, employee types, leave entitlements, company holidays.
- **Change password** — the "Your password needs" checklist with strength bar; same rules enforced by the API.
- **Your components** — `CustomSnackbar` (toast) and `LoadingSpinner` are used app-wide via `useUi().toast()` / `run()`.
- Light / dark theme (`data-theme` on `<html>`, CSS variables shared with your toast & loader CSS), mobile drawer.

## Roles

| | Employee | Manager | Admin | Super Admin |
|---|:-:|:-:|:-:|:-:|
| Own tasks, reports, leave, profile | ✓ | ✓ | ✓ | ✓ |
| Approve leave | | direct reports | everyone | everyone |
| Attendance, all work reports, teams, projects | | ✓ | ✓ | ✓ |
| Add / edit staff, organisation settings | | | ✓ | ✓ |
| Grant Admin, delete staff / companies | | | | ✓ |

Nobody can approve their own leave or review their own task.

## Configuration (`backend/.env`)

| Variable | |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | **required**, ≥ 32 chars. Server won't start without it |
| `APP_TIMEZONE` | office timezone (default `Australia/Sydney`) — decides what "today" is |
| `CORS_ORIGIN`, `APP_URL` | where the web app runs (CORS + links in emails) |
| `SMTP_*`, `MAIL_FROM`, `HR_INBOX` | email. Leave `SMTP_HOST` empty in dev — emails print to the console |

## Deploy to Vercel

One Vercel project serves both: the React app as static files and the Express API as a serverless function at `/api`
(same domain, so no CORS setup). `vercel.json` already contains the build, output and rewrite settings.

| What | On Vercel |
|---|---|
| Database | **Neon Postgres** from the Vercel Marketplace (sets `DATABASE_URL` + `DATABASE_URL_UNPOOLED`) |
| Photos / logos | **Vercel Blob, private store** — files are only served through the logged-in API routes |
| Migrations | run automatically on every deploy (`npm run vercel-build`), using the direct connection |
| Demo data | loaded on deploy only if `SEED_DEMO_DATA=true` **and** the database is empty — a redeploy never wipes data |

**Steps**

1. Push to GitHub so that `vercel.json`, `package.json`, `api/`, `backend/` and `frontend/` are at the **top level of the repo** (not inside another folder).
2. In Vercel: **Add New → Project →** import the repo. *Root Directory*: leave empty. *Framework Preset*: **Other** (not Express, not Vite). No build/output overrides.
   The first build may fail — that's expected until the database and secret exist.
3. Project → **Storage**:
   - **Create Database → Neon** (Marketplace) → connect it to the project for all environments.
   - **Create → Blob → Private** store → connect it to the project.
4. Project → **Settings → Environment Variables**:
   - `JWT_SECRET` = a long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
   - `SEED_DEMO_DATA` = `true` *(optional — only if you want the demo data)*
   - optional: `APP_TIMEZONE` (default `Australia/Sydney`), `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` / `HR_INBOX`
5. **Deployments → ⋯ → Redeploy.** Open the URL and sign in.

> ⚠️ **If you load demo data on a public URL**, anyone who reads this README can sign in as Super Admin with
> `Password@123`. For a real deployment, leave `SEED_DEMO_DATA` unset, or change every demo password straight away
> (and remove `SEED_DEMO_DATA` afterwards). The demo-login hint is hidden on the login page in production builds.

**Creating your first real admin (no demo data):** from your computer, pull the project's env vars and run

```bash
npx vercel link && npx vercel env pull .env
npm run create-admin -- you@company.com "Your Name"    # prints a one-time password
```
Sign in, change the password, then add everyone else from **Employees → Add employee**.

**Without SMTP**, invitation emails can't be sent, so after *Add employee* the app shows the set-password link for the
admin to pass on. Add the `SMTP_*` variables to send them automatically.

## Other hosting
- `npm run build` → static files in `frontend/dist`; serve them and proxy `/api` to `npm start -w backend` (Node ≥ 20).
- Uploads go to `UPLOAD_DIR` on disk (default `backend/uploads`) unless running on Vercel or `STORAGE=blob`.

## Notes
- **Rotate the old Firebase service-account key and Gmail password** that were committed to the original repo.
- Branding: the Loons Lab logo is in `frontend/public/assets/` as SVG — `loons-lab.svg` / `loons-lab-white.svg` (bird + wordmark), `loons-lab-stacked.svg` (original stacked layout), and `afc-icon.svg` / `afc-icon-white.svg` (the loon head: collapsed sidebar and loader). `frontend/public/favicon.svg` is the browser-tab icon (switches to white in dark mode).
