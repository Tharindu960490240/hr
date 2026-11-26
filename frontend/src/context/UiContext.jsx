import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CustomSnackbar from '../components/CustomSnackbar';
import LoadingSpinner from '../components/LoadingSpinner';
import { makeTheme } from '../theme';

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [mode, setMode] = useState(() => document.documentElement.dataset.theme || 'light');
  const [toastState, setToast] = useState({ open: false, message: '', severity: 'info', key: 0 });
  const [loadingCount, setLoadingCount] = useState(0);
  const keyRef = useRef(0);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toast = useCallback((message, severity = 'success') => {
    keyRef.current += 1;
    setToast({ open: true, message, severity, key: keyRef.current });
  }, []);
  const toastError = useCallback((err) => toast(err?.message || String(err), 'error'), [toast]);

  /** Show the full-screen loader while a promise runs (for saves, not for page loads). */
  const withLoading = useCallback(async (promiseOrFn) => {
    setLoadingCount((n) => n + 1);
    try {
      return await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn);
    } finally {
      setLoadingCount((n) => n - 1);
    }
  }, []);

  /** Run an action with loader + success/error toast. Returns result or undefined on error. */
  const run = useCallback(async (fn, successMsg) => {
    try {
      const r = await withLoading(fn);
      if (successMsg) toast(typeof successMsg === 'function' ? successMsg(r) : successMsg, 'success');
      return r ?? true;
    } catch (e) {
      toastError(e);
      return undefined;
    }
  }, [withLoading, toast, toastError]);

  const theme = useMemo(() => makeTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggleMode, toast, toastError, withLoading, run }), [mode, toggleMode, toast, toastError, withLoading, run]);

  return (
    <UiContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
        <CustomSnackbar
          key={toastState.key}
          open={toastState.open}
          severity={toastState.severity}
          message={toastState.message}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
        />
        <LoadingSpinner open={loadingCount > 0} />
      </ThemeProvider>
    </UiContext.Provider>
  );
}

export const useUi = () => useContext(UiContext);
