import { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams, Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { DarkModeRounded, LightModeRounded } from '@mui/icons-material';
import PasswordField from '../components/PasswordField';
import PasswordRules, { passwordOk } from '../components/PasswordRules';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { post } from '../lib/api';

function AuthShell({ title, subtitle, children }) {
  const { mode, toggleMode } = useUi();
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { md: '1.05fr 1fr' } }}>
      <Box sx={{
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: 6, color: '#fff',
        background: 'radial-gradient(900px 500px at 10% 10%, #3a3fb0 0%, transparent 60%), linear-gradient(160deg, #1b1f5e 0%, #0d1033 70%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <Stack spacing={0.75}>
          <img src="/assets/loons-lab-white.svg" alt="Loons Lab" style={{ height: 46, width: 'auto', alignSelf: 'flex-start' }} />
          <Typography variant="overline" sx={{ opacity: 0.65, letterSpacing: '.14em', pl: '64px', lineHeight: 1.2 }}>Office HR</Typography>
        </Stack>
        <Box sx={{ maxWidth: 460 }}>
          <Typography variant="h4" sx={{ mb: 2, fontSize: 38, lineHeight: 1.15 }}>People, leave and projects — in one place.</Typography>
          <Typography sx={{ opacity: 0.75, fontSize: 17 }}>Request leave, log your day, track tasks and keep your team in sync.</Typography>
        </Box>
        <Box sx={{ position: 'absolute', right: -80, bottom: -80, width: 320, height: 320, borderRadius: '50%', border: '40px solid rgba(237,31,36,.35)' }} />
        <Typography variant="caption" sx={{ opacity: 0.6 }}>© {new Date().getFullYear()} Loons Lab</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 }, position: 'relative' }}>
        <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
          <IconButton onClick={toggleMode} sx={{ position: 'absolute', top: 16, right: 16 }} aria-label="Toggle theme">
            {mode === 'dark' ? <LightModeRounded /> : <DarkModeRounded />}
          </IconButton>
        </Tooltip>
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          <Box sx={{ mb: 3, display: { md: 'none' } }}>
            <img src={mode === 'dark' ? '/assets/loons-lab-white.svg' : '/assets/loons-lab.svg'} alt="Loons Lab" style={{ height: 36, width: 'auto' }} />
          </Box>
          <Typography variant="h4" sx={{ fontSize: 30 }}>{title}</Typography>
          {subtitle && <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{subtitle}</Typography>}
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export function Login() {
  const { login, user } = useAuth();
  const { toast } = useUi();
  const nav = useNavigate();
  const loc = useLocation();
  const back = loc.state?.from?.pathname && loc.state.from.pathname !== '/login' ? loc.state.from.pathname + (loc.state.from.search || '') : '/';
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={back} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(f.email.trim(), f.password);
      toast(`Welcome back, ${u.full_name.split(' ')[0]}`, 'success');
      nav(back, { replace: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your work email.">
      <form onSubmit={submit}>
        <Stack spacing={2}>
          <TextField size="medium" label="Email" type="email" autoComplete="username" autoFocus required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <PasswordField label="Password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Link component={RouterLink} to="/forgot-password" underline="hover">Forgot password?</Link>
          </Stack>
          <Button type="submit" variant="contained" size="large" disabled={busy || !f.email || !f.password} sx={{ py: 1.3 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </form>
      {import.meta.env.DEV && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Demo accounts: <b>superadmin@</b>, <b>admin@</b>, <b>manager@</b> or <b>employee@example.com</b> — password <b>Password@123</b>
        </Alert>
      )}
    </AuthShell>
  );
}

export function ForgotPassword() {
  const { toast } = useUi();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await post('/auth/forgot-password', { email: email.trim() });
      setSent(r.message);
      toast('Check your email for the reset link', 'success');
    } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a link to choose a new one.">
      {sent ? <Alert severity="success">{sent}</Alert> : (
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <TextField size="medium" label="Work email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" variant="contained" size="large" disabled={!email}>Send reset link</Button>
          </Stack>
        </form>
      )}
      <Link component={RouterLink} to="/login" sx={{ display: 'inline-block', mt: 3 }}>Back to sign in</Link>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const welcome = params.get('welcome');
  const nav = useNavigate();
  const { toast } = useUi();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await post('/auth/reset-password', { token, password: pw });
      toast(r.message, 'success');
      nav('/login');
    } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <AuthShell title={welcome ? 'Set up your password' : 'Choose a new password'} subtitle="Choose a strong password that you do not use anywhere else.">
      {!token ? <Alert severity="error">This link is missing its token. Request a new one.</Alert> : (
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <PasswordField label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <PasswordField label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              error={Boolean(confirm) && confirm !== pw} helperText={confirm && confirm !== pw ? "Passwords don't match" : ''} />
            <PasswordRules password={pw} />
            <Button type="submit" variant="contained" size="large" disabled={!passwordOk(pw) || pw !== confirm}>Save password</Button>
          </Stack>
        </form>
      )}
      <Link component={RouterLink} to="/login" sx={{ display: 'inline-block', mt: 3 }}>Back to sign in</Link>
    </AuthShell>
  );
}
