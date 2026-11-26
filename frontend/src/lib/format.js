import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

export const fmtDate = (d) => (d ? dayjs(d).format('D MMM YYYY') : '—');
export const fmtShort = (d) => (d ? dayjs(d).format('D MMM') : '—');
export const fmtDateTime = (d) => (d ? dayjs(d).format('D MMM YYYY, h:mm a') : '—');
export const fromNow = (d) => (d ? dayjs(d).fromNow() : '');
export const fmtTime = (t) => (t ? dayjs(`2000-01-01T${t}`).format('h:mm a') : '—');
export const today = () => dayjs().format('YYYY-MM-DD');
export const range = (a, b) => (a === b ? fmtDate(a) : `${fmtShort(a)} – ${fmtDate(b)}`);
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const labelize = (s = '') => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export { dayjs };
