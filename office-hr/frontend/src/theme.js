import { createTheme } from '@mui/material/styles';

export const NAVY = '#282c7d';
export const RED = '#ed1f24';

export function makeTheme(mode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#8f96ff' : NAVY, contrastText: '#fff' },
      secondary: { main: RED },
      error: { main: dark ? '#ff6b6e' : '#d61a1f' },
      success: { main: '#16a34a' },
      warning: { main: '#d97706' },
      background: { default: dark ? '#0a0e1a' : '#f4f6fb', paper: dark ? '#131826' : '#ffffff' },
      text: dark ? { primary: '#e6e8f0', secondary: '#9aa3b5' } : { primary: '#1a202c', secondary: '#64748b' },
      divider: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { border: '1px solid var(--border-color)', borderRadius: 14 } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingInline: 16,
            variants: [
              {
                props: { variant: 'contained', color: 'primary' },
                style: {
                  color: '#fff',
                  background: dark ? 'linear-gradient(135deg, #2f3592 0%, #4b51c9 100%)' : `linear-gradient(135deg, ${NAVY} 0%, #3c42b5 100%)`,
                  boxShadow: dark ? '0 6px 18px rgba(60, 66, 181, 0.35)' : 'none',
                  '&:hover': { background: dark ? 'linear-gradient(135deg, #363ca6 0%, #5a60db 100%)' : 'linear-gradient(135deg, #1f2366 0%, #3238a3 100%)' },
                  '&.Mui-disabled': { background: 'none', boxShadow: 'none' },
                },
              },
            ],
          },
        },
      },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: dark ? '#9aa3b5' : '#64748b' },
        },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
      MuiTooltip: { defaultProps: { arrow: true } },
    },
  });
}
