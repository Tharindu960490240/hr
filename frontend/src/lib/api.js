// Small fetch wrapper: adds the token, turns errors into Error(message), logs out on 401.
const TOKEN_KEY = 'token';
let onUnauthorized = () => {};

export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

export async function api(path, { method = 'GET', body, form, raw } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized();
  if (raw && res.ok) return res;
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // no JSON body = the request never reached our API (e.g. the serverless function isn't deployed)
    const fallback = res.status === 404 || res.status >= 502
      ? `The server isn't responding (${res.status}). The API part of the deployment is missing or still starting.`
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, data?.error || fallback, data?.details);
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: body ?? {} });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });
export const upload = (p, file, field = 'file') => {
  const form = new FormData();
  form.append(field, file);
  return api(p, { method: 'POST', form });
};

/** Download a protected file (CSV etc.) */
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
