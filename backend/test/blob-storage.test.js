// Exercises the Vercel Blob code path with an in-memory stand-in for @vercel/blob.
// Run: node --experimental-test-module-mocks --test test/blob-storage.test.js   (needs a seeded DB)
import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
mock.module('@vercel/blob', {
  namedExports: {
    put: async (key, body, opts) => {
      assert.equal(opts.access, 'private');
      store.set(key, { body: Buffer.from(body), type: opts.contentType });
      return { pathname: key };
    },
    get: async (key, opts) => {
      assert.equal(opts.access, 'private');
      const f = store.get(key);
      if (!f) return null;
      return { statusCode: 200, stream: new Blob([f.body]).stream(), blob: { contentType: f.type, size: f.body.length } };
    },
    del: async (key) => { store.delete(key); },
  },
});
process.env.STORAGE = 'blob';
process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;
after(async () => {
  // leave the shared demo database as we found it (no photo pointing at the in-memory store)
  await pool.query(`UPDATE employees SET avatar_path = NULL WHERE email = 'employee@example.com'`);
  server.close();
  await pool.end();
});

test('avatar upload/read/replace goes through private Blob storage', async () => {
  const login = await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'employee@example.com', password: 'Password@123' }) })).json();
  const auth = { authorization: `Bearer ${login.token}` };
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const send = async () => {
    const fd = new FormData();
    fd.append('file', new Blob([png], { type: 'image/png' }), 'me.png');
    return fetch(`${base}/employees/${login.user.id}/avatar`, { method: 'POST', headers: auth, body: fd });
  };
  assert.equal((await send()).status, 200);
  assert.equal(store.size, 1);
  const firstKey = [...store.keys()][0];
  assert.match(firstKey, /^avatars\/[0-9a-f-]{36}\.png$/);

  const img = await fetch(`${base}/employees/${login.user.id}/avatar`, { headers: auth });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), png);

  assert.equal((await send()).status, 200);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(store.size, 1, 'old photo deleted');
  assert.notEqual([...store.keys()][0], firstKey);

  // wrong type rejected, nothing stored
  const fd = new FormData();
  fd.append('file', new Blob(['hi'], { type: 'text/plain' }), 'x.txt');
  assert.equal((await fetch(`${base}/employees/${login.user.id}/avatar`, { method: 'POST', headers: auth, body: fd })).status, 400);
  // someone else's photo: forbidden
  const other = await fetch(`${base}/employees/1/avatar`, { method: 'POST', headers: auth, body: (() => { const f = new FormData(); f.append('file', new Blob([png], { type: 'image/png' }), 'a.png'); return f; })() });
  assert.equal(other.status, 403);
  assert.equal(store.size, 1);
});
