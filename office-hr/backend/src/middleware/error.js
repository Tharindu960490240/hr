import multer from 'multer';
import { HttpError } from '../lib/http.js';
import { config } from '../config.js';

const PG_MESSAGES = {
  '23505': 'That value is already in use',
  '23503': 'A related record does not exist or is still in use',
  '23514': 'Some values are not allowed',
  '22007': 'Invalid date or time',
  '22P02': 'Invalid value',
};

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err?.code && PG_MESSAGES[err.code]) {
    const detail = err.code === '23505' && err.detail ? ` (${err.detail.replace(/^Key /, '')})` : '';
    return res.status(err.code === '23505' ? 409 : 400).json({ error: PG_MESSAGES[err.code] + detail });
  }
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({
    error: 'Something went wrong on the server',
    ...(config.env === 'development' ? { details: err.message } : {}),
  });
}
