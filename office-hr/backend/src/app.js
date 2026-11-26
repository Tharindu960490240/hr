import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { pool } from './db/pool.js';
import auth from './routes/auth.js';
import employees from './routes/employees.js';
import companies from './routes/companies.js';
import { departments, designations, jobTypes, categories } from './routes/lookups.js';
import { leaveTypes, holidays } from './routes/leave.js';
import requests from './routes/requests.js';
import { workReports, attendance } from './routes/work.js';
import teams from './routes/teams.js';
import projects from './routes/projects.js';
import tasks from './routes/tasks.js';
import notifications from './routes/notifications.js';
import dashboard from './routes/dashboard.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: config.corsOrigin, credentials: false }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  if (config.env !== 'test') app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });

  app.use('/api/auth', auth);

  // everything below needs a signed-in, active user
  const api = express.Router();
  api.use(requireAuth);
  api.use('/employees', employees);
  api.use('/companies', companies);
  api.use('/departments', departments);
  api.use('/designations', designations);
  api.use('/job-types', jobTypes);
  api.use('/categories', categories);
  api.use('/leave-types', leaveTypes);
  api.use('/holidays', holidays);
  api.use('/requests', requests);
  api.use('/work-reports', workReports);
  api.use('/attendance', attendance);
  api.use('/teams', teams);
  api.use('/projects', projects);
  api.use('/tasks', tasks);
  api.use('/notifications', notifications);
  api.use('/dashboard', dashboard);
  app.use('/api', api);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
