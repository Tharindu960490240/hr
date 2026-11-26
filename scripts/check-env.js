// Runs first in the Vercel build: fail early with a clear message instead of deploying a function that crashes.
const env = process.env.VERCEL_ENV || 'local';
const missing = ['JWT_SECRET', 'DATABASE_URL'].filter((k) => !process.env[k]);
const tooShort = process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length < 32;

console.log(`[check-env] Vercel environment: ${env}`);
if (missing.length || tooShort) {
  console.error('\n[check-env] ✖ Setup incomplete for this deployment:');
  for (const k of missing) console.error(`   - ${k} is not set for the "${env}" environment`);
  if (tooShort) console.error('   - JWT_SECRET must be at least 32 characters');
  console.error('\n   Fix: Project → Settings → Environment Variables → add it, tick Production AND Preview,');
  console.error('   then Deployments → ⋯ → Redeploy. (DATABASE_URL comes from connecting Neon in the Storage tab.)\n');
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
  console.warn('[check-env] ⚠ No Vercel Blob store connected — photo/logo uploads will fail. Storage tab → Blob (Private) → Connect.');
}
console.log('[check-env] ✓ required variables present');
