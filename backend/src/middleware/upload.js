import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { config } from '../config.js';
import { badRequest, notFound } from '../lib/http.js';

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

/**
 * Where uploads live:
 *  - on Vercel (read-only filesystem) → Vercel Blob, private store (served only through our authenticated routes)
 *  - anywhere else → local disk under UPLOAD_DIR
 */
export const useBlob = Boolean(process.env.VERCEL) || process.env.STORAGE === 'blob';
const blob = useBlob ? await import('@vercel/blob') : null;

/** Single image upload kept in memory (max 2 MB, JPEG/PNG/WebP). Call saveUpload() after your checks pass. */
export function imageUpload(field = 'file') {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) =>
      IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(badRequest('Only JPEG, PNG or WebP images are allowed')),
  }).single(field);
}

/** Store the file; returns the key to keep in the database. Keys are generated here, never taken from the user. */
export async function saveUpload(file, folder) {
  const key = `${folder}/${crypto.randomUUID()}${IMAGE_TYPES[file.mimetype]}`;
  if (useBlob) {
    await blob.put(key, file.buffer, { access: 'private', contentType: file.mimetype, addRandomSuffix: false });
  } else {
    const full = path.resolve(config.uploadDir, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer);
  }
  return key;
}

/** Stream a stored file to the response. */
export async function sendStored(res, key, cacheControl = 'private, max-age=300') {
  if (!key) throw notFound('File');
  res.set('Cache-Control', cacheControl);
  if (!useBlob) return res.sendFile(path.resolve(config.uploadDir, key));
  const result = await blob.get(key, { access: 'private' });
  if (!result || result.statusCode !== 200) throw notFound('File');
  res.type(result.blob.contentType);
  Readable.fromWeb(result.stream).pipe(res);
}

/** Delete a stored file; never throws. */
export function removeStored(key) {
  if (!key) return;
  const p = useBlob ? blob.del(key) : fs.unlink(path.resolve(config.uploadDir, key));
  p.catch(() => {});
}
