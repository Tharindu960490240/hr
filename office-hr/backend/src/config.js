import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// backend/.env for local dev, or the repo-root .env written by `vercel env pull .env`
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: [path.join(backendDir, '.env'), path.join(backendDir, '..', '.env')], quiet: true });

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  return v;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

// on Vercel, default links/CORS to the project's production domain
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null;

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: (process.env.CORS_ORIGIN || vercelUrl || 'http://localhost:5173').split(',').map((s) => s.trim()),
  // the office's timezone: decides what "today" is for reports, leave and attendance
  timezone: process.env.APP_TIMEZONE || 'Australia/Sydney',
  appUrl: process.env.APP_URL || vercelUrl || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Office HR <no-reply@example.com>',
    hrInbox: process.env.HR_INBOX, // where new leave/WFH requests are copied
  },
};
