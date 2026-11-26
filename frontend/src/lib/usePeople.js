import { useEffect, useState } from 'react';
import { get } from './api';

// one shared, lazily loaded copy of the staff directory
let cache = null;
let inflight = null;
const subs = new Set();

export function refreshPeople() {
  inflight = get('/employees').then((d) => { cache = d; inflight = null; subs.forEach((f) => f(d)); return d; }).catch(() => { inflight = null; return cache || []; });
  return inflight;
}

export function usePeople() {
  const [list, setList] = useState(cache || []);
  useEffect(() => {
    subs.add(setList);
    if (!cache && !inflight) refreshPeople();
    return () => subs.delete(setList);
  }, []);
  return list;
}
