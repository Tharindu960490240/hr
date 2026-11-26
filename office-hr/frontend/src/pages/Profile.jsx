import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import { PhotoCameraRounded, EditRounded, BlockRounded, CheckCircleRounded, ForwardToInboxRounded, DeleteForeverRounded, MailOutlineRounded, PhoneRounded, LockResetRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { patch, post, del, upload } from '../lib/api';
import { refreshPeople } from '../lib/usePeople';
import EmpAvatar, { bustAvatar } from '../components/EmpAvatar';
import { Loading, ErrorAlert, ConfirmDialog, FormDialog } from '../components/ui';
import { Section, F } from './EmployeeEdit';
import { fmtDate } from '../lib/format';

function Info({ label, value }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{value || '—'}</Typography>
    </Grid>
  );
}

const PERSONAL = {
  profile: [['mobile', 'Mobile'], ['landline', 'Landline'], ['personal_email', 'Personal email'], ['dob', 'Date of birth', 'date'], ['gender', 'Gender', ['Female', 'Male', 'Non-binary', 'Prefer not to say']],
    ['marital_status', 'Marital status', ['Single', 'Married', 'Partnered', 'Prefer not to say']], ['national_id', 'National ID / passport'], ['current_address', 'Current address', 'wide'], ['permanent_address', 'Permanent address', 'wide'], ['education', 'Highest qualification'], ['school', 'School / university']],
  bank: [['bank_name', 'Bank'], ['account_name', 'Account name'], ['branch', 'Branch / BSB'], ['account_number', 'Account number']],
  emergency: [['name', 'Contact name'], ['relationship', 'Relationship'], ['mobile', 'Mobile'], ['landline', 'Landline'], ['email', 'Email']],
  social: [['linkedin', 'LinkedIn URL'], ['facebook', 'Facebook URL'], ['whatsapp', 'WhatsApp number']],
};
const GROUP_TITLES = { profile: 'Personal details', bank: 'Bank account', emergency: 'Emergency contact', social: 'Social' };

function PersonalForm({ emp, editable, onSaved }) {
  const { run } = useUi();
  const [f, setF] = useState({});
  useEffect(() => setF({ full_name: emp.full_name, profile: { ...emp.profile }, bank: { ...emp.bank }, emergency: { ...emp.emergency }, social: { ...emp.social } }), [emp]);
  if (!f.profile) return null;
  const set = (g, k) => (e) => setF((s) => ({ ...s, [g]: { ...s[g], [k]: e.target.value } }));
  const save = async (e) => {
    e.preventDefault();
    const ok = await run(() => patch(`/employees/${emp.id}`, f), 'Details saved');
    if (ok) onSaved();
  };
  return (
    <Stack component="form" spacing={2.5} onSubmit={save}>
      {Object.entries(PERSONAL).filter(([g]) => emp[g] !== undefined).map(([g, fields]) => (
        <Section key={g} title={GROUP_TITLES[g]}>
          {fields.map(([k, label, type]) => (
            <F key={k} md={type === 'wide' ? 12 : 6}>
              {Array.isArray(type) ? (
                <TextField select label={label} value={f[g][k] || ''} onChange={set(g, k)} disabled={!editable}>
                  <MenuItem value="">—</MenuItem>{type.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              ) : (
                <TextField label={label} type={type === 'date' ? 'date' : 'text'} value={f[g][k] || ''} onChange={set(g, k)} disabled={!editable}
                  slotProps={type === 'date' ? { inputLabel: { shrink: true } } : undefined} />
              )}
            </F>
          ))}
        </Section>
      ))}
      {editable && <Box><Button type="submit" variant="contained">Save details</Button></Box>}
    </Stack>
  );
}

export default function Profile() {
  const params = useParams();
  const nav = useNavigate();
  const { user, can, refresh } = useAuth();
  const { run } = useUi();
  const id = params.id ? Number(params.id) : user.id;
  const self = id === user.id;
  const { data: e, loading, error, reload } = useFetch(`/employees/${id}`);
  const bal = useFetch(self || can('Manager') ? `/employees/${id}/leave-balance` : null, []);
  const [tab, setTab] = useState('overview');
  const [confirm, setConfirm] = useState(null);
  const [lieu, setLieu] = useState(null);
  const fileRef = useRef();
  useEffect(() => setTab('overview'), [id]);

  if (loading && !e) return <Loading rows={10} />;
  if (error) return <ErrorAlert error={error} onRetry={reload} />;
  if (!e) return null;
  const admin = can('Admin');
  const canPhoto = self || admin;

  const onPhoto = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return run(() => Promise.reject(new Error('Photo must be 2 MB or smaller')));
    const ok = await run(() => upload(`/employees/${id}/avatar`, file), 'Photo updated');
    if (ok) { bustAvatar(id); reload(); refreshPeople(); if (self) refresh(); }
  };

  const actions = {
    status: { title: e.is_active ? `Deactivate ${e.full_name}?` : `Reactivate ${e.full_name}?`, message: e.is_active ? 'They will be signed out and can no longer sign in.' : 'They will be able to sign in again.', label: e.is_active ? 'Deactivate' : 'Activate', danger: e.is_active,
      fn: () => patch(`/employees/${id}/status`, { is_active: !e.is_active }) },
    invite: { title: 'Send a new password link?', message: `${e.email} will get a link to set a new password (valid 72 hours).`, label: 'Send link', fn: () => post(`/employees/${id}/invite`) },
    delete: { title: `Permanently delete ${e.full_name}?`, message: 'All their requests, reports and comments are deleted too. Deactivating is usually better.', label: 'Delete forever', danger: true, fn: () => del(`/employees/${id}`) },
  };

  return (
    <>
      <Card sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ height: 96, background: 'linear-gradient(120deg, #282c7d 0%, #3c42b5 60%, #ed1f24 140%)' }} />
        <CardContent sx={{ pt: 0 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ alignItems: { md: 'flex-end' }, mt: -5 }}>
            <Box sx={{ position: 'relative', width: 104 }}>
              <EmpAvatar id={e.id} name={e.full_name} hasAvatar={e.has_avatar} size={104} sx={{ border: '4px solid', borderColor: 'background.paper' }} />
              {canPhoto && (
                <>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPhoto} />
                  <Tooltip title="Change photo">
                    <IconButton size="small" onClick={() => fileRef.current.click()} aria-label="Change photo"
                      sx={{ position: 'absolute', right: 0, bottom: 4, bgcolor: 'background.paper', boxShadow: 2, '&:hover': { bgcolor: 'background.paper' } }}>
                      <PhotoCameraRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="h5">{e.full_name}</Typography>
                <Chip size="small" label={e.role} color="primary" variant="outlined" />
                {!e.is_active && <Chip size="small" label="Inactive" />}
              </Stack>
              <Typography color="text.secondary">{[e.designation, e.department, e.branch].filter(Boolean).join(' · ')}</Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', color: 'text.secondary' }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}><MailOutlineRounded fontSize="small" /><Typography variant="body2">{e.email}</Typography></Stack>
                {e.profile?.mobile && <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}><PhoneRounded fontSize="small" /><Typography variant="body2">{e.profile.mobile}</Typography></Stack>}
              </Stack>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {self && <Button startIcon={<LockResetRounded />} onClick={() => nav('/change-password')}>Change password</Button>}
              {admin && <Button variant="outlined" startIcon={<EditRounded />} onClick={() => nav(`/employees/${id}/edit`)}>Edit employment</Button>}
              {admin && !self && <Button startIcon={<ForwardToInboxRounded />} onClick={() => setConfirm('invite')}>Password link</Button>}
              {admin && !self && <Button color={e.is_active ? 'error' : 'success'} startIcon={e.is_active ? <BlockRounded /> : <CheckCircleRounded />} onClick={() => setConfirm('status')}>{e.is_active ? 'Deactivate' : 'Activate'}</Button>}
              {can('Super Admin') && !self && <IconButton color="error" onClick={() => setConfirm('delete')} aria-label="Delete"><DeleteForeverRounded /></IconButton>}
            </Stack>
          </Stack>
        </CardContent>
        <Divider />
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab value="overview" label="Overview" />
          {e.bank !== undefined && <Tab value="personal" label={self ? 'My details' : 'Personal details'} />}
          {bal.data.length > 0 && <Tab value="leave" label="Leave" />}
        </Tabs>
      </Card>

      {tab === 'overview' && (
        <Card><CardContent>
          <Grid container spacing={3}>
            <Info label="Employee ID" value={e.emp_code} />
            <Info label="Department" value={e.department} />
            <Info label="Designation" value={e.designation} />
            <Info label="Branch" value={e.branch} />
            <Info label="Employee type" value={e.job_type} />
            <Info label="Reports to" value={e.reporter} />
            <Info label="Start date" value={fmtDate(e.start_date)} />
            {e.end_date && <Info label="End date" value={fmtDate(e.end_date)} />}
            <Info label="Access level" value={e.role} />
          </Grid>
        </CardContent></Card>
      )}
      {tab === 'personal' && <PersonalForm emp={e} editable={self} onSaved={reload} />}
      {tab === 'leave' && (
        <Card><CardContent>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1">Leave balance {new Date().getFullYear()}</Typography>
            {admin && <Button size="small" onClick={() => setLieu(String(e.lieu_days ?? 0))}>Set lieu days</Button>}
          </Stack>
          <Stack spacing={2}>
            {bal.data.map((b) => (
              <Box key={b.name}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 600 }}>{b.name}</Typography>
                  <Typography color="text.secondary">{b.used} used · {b.pending} pending · <b>{b.remaining}</b> of {b.entitled} left</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={b.entitled ? Math.min(100, (b.used / b.entitled) * 100) : 0} sx={{ height: 8, borderRadius: 4 }} />
              </Box>
            ))}
          </Stack>
        </CardContent></Card>
      )}

      <ConfirmDialog open={Boolean(confirm)} title={confirm && actions[confirm].title} message={confirm && actions[confirm].message} confirmLabel={confirm && actions[confirm].label}
        danger={confirm && actions[confirm].danger} onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const which = confirm;
          const ok = await run(actions[which].fn, (r) => r?.message || 'Done');
          if (ok) { refreshPeople(); if (which === 'delete') nav('/employees'); else reload(); }
          return Boolean(ok);
        }} />
      <FormDialog open={lieu !== null} title="Lieu leave days" onClose={() => setLieu(null)} maxWidth="xs"
        onSubmit={async () => { const ok = await run(() => patch(`/employees/${id}/lieu`, { lieu_days: Number(lieu) }), 'Lieu leave updated'); if (ok) bal.reload(); return Boolean(ok); }}>
        <TextField type="number" label="Days granted this year" value={lieu ?? ''} onChange={(ev) => setLieu(ev.target.value)} slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
          helperText="Extra days earned for working weekends or public holidays." />
      </FormDialog>
    </>
  );
}
