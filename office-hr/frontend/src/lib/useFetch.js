import { useCallback, useEffect, useState } from 'react';
import { get } from './api';

/** const { data, loading, error, reload } = useFetch('/path') — path null = skip */
export function useFetch(path, initial = null) {
  const [state, setState] = useState({ data: initial, loading: Boolean(path), error: null });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await get(path);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}
