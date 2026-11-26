// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json).
// Migrations run during the build (npm run vercel-build), not on each cold start.
import { createApp } from '../backend/src/app.js';

export default createApp();
