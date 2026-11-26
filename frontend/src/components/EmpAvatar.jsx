import { useEffect, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import { api } from '../lib/api';
import { initials } from '../lib/format';

// photos need the auth header, so fetch as blob and cache the object URL
const cache = new Map();
export const bustAvatar = (id) => cache.delete(id);

const COLORS = ['#282c7d', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#1d4ed8', '#4d7c0f', '#9333ea'];

export default function EmpAvatar({ id, name, hasAvatar, size = 36, sx }) {
  const [src, setSrc] = useState(() => (hasAvatar ? cache.get(id) : null));
  useEffect(() => {
    if (!hasAvatar || !id) { setSrc(null); return; }
    if (cache.has(id)) { cache.get(id).then?.(setSrc) ?? setSrc(cache.get(id)); return; }
    const p = api(`/employees/${id}/avatar`, { raw: true })
      .then((r) => r.blob())
      .then((b) => { const u = URL.createObjectURL(b); cache.set(id, u); return u; })
      .catch(() => { cache.delete(id); return null; });
    cache.set(id, p);
    p.then(setSrc);
  }, [id, hasAvatar]);
  const bg = COLORS[(id || name?.length || 0) % COLORS.length];
  return (
    <Avatar src={typeof src === 'string' ? src : undefined} alt={name} sx={{ width: size, height: size, fontSize: size * 0.38, fontWeight: 700, bgcolor: bg, ...sx }}>
      {initials(name)}
    </Avatar>
  );
}
