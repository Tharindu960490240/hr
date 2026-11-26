import { badRequest } from '../lib/http.js';

/** Validate req.body (or req.query) with a zod schema; replaces it with the parsed value. */
/** Parse or throw a 400 with a readable message. */
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  const first = issues[0];
  throw badRequest(first.path ? `${first.path}: ${first.message}` : first.message, issues);
}

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = issues[0];
    return next(badRequest(first.path ? `${first.path}: ${first.message}` : first.message, issues));
  }
  if (source === 'query') req.validQuery = result.data;
  else req[source] = result.data;
  next();
};

/**
 * For PATCH: every field optional and WITHOUT defaults
 * (zod 4 applies .default() inside .partial(), which would overwrite omitted fields).
 */
export function patchOf(objectSchema) {
  const shape = {};
  for (const [k, v] of Object.entries(objectSchema.shape)) {
    let s = v;
    while (s?.def?.type === 'default' || s?.def?.type === 'optional') s = s.def.innerType;
    shape[k] = s.optional();
  }
  return objectSchema.extend(shape);
}
