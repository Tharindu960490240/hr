import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField';
import PasswordRules, { passwordOk } from '../components/PasswordRules';
import { post, setToken } from '../lib/api';
import { useUi } from '../context/UiContext';

export default function ChangePassword() {
  const { run } = useUi();
  const nav = useNavigate();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const mismatch = f.confirm && f.next !== f.confirm;
  const same = f.next && f.next === f.current;
  const valid = f.current && passwordOk(f.next) && f.next === f.confirm && !same;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const r = await run(() => post('/auth/change-password', { current: f.current, next: f.next }), 'Your password has been changed');
    if (r) {
      setToken(r.token); // keep this device signed in
      nav('/');
    }
  };

  return (
    <div className="pw-page">
      <h1 className="pw-title">Change password</h1>
      <p className="pw-sub">Choose a strong password that you do not use anywhere else.</p>
      <form className="pw-card" onSubmit={submit} noValidate>
        <Stack spacing={2}>
          <PasswordField placeholder="Current password" aria-label="Current password" autoComplete="current-password" value={f.current} onChange={set('current')}
            error={touched && !f.current} helperText={touched && !f.current ? 'Enter your current password' : ''} />
          <PasswordField placeholder="New password" aria-label="New password" autoComplete="new-password" value={f.next} onChange={set('next')}
            error={Boolean(same)} helperText={same ? 'Use a password different from your current one' : ''} />
          <PasswordField placeholder="Confirm new password" aria-label="Confirm new password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')}
            error={Boolean(mismatch) || (touched && !f.confirm)} helperText={mismatch ? "Passwords don't match" : ''} />
          <PasswordRules password={f.next} />
        </Stack>
        <p className="pw-note">You will stay signed in on this device. Any other device will be signed out.</p>
        <Stack sx={{ alignItems: 'center', mt: 3 }}>
          <Button type="submit" variant="contained" size="large" sx={{ px: 3.5, py: 1.4, fontSize: 16, fontWeight: 700 }} disabled={touched && !valid}>
            Change password
          </Button>
        </Stack>
      </form>
    </div>
  );
}
