// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json).
// Migrations run during the build (npm run vercel-build), not on each cold start.
let app;
let setupError;
try {
  ({ createApp: app } = await import('../backend/src/app.js'));
  app = app();
} catch (e) {
  setupError = e;
  console.error('[api] failed to start:', e.message);
}

export default function handler(req, res) {
  if (app) return app(req, res);
  // show a readable reason instead of a crashed function
  res.statusCode = 500;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: `Server setup incomplete: ${setupError.message}` }));
}
