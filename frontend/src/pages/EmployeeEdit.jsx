import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post, patch } from '../lib/api';
import { refreshPeople } from '../lib/usePeople';
import PersonPicker from '../components/PersonPicker';
import { PageHeader, Loading, ErrorAlert } from '../components/ui';
import PasswordField from '../components/PasswordField';
import { passwordOk } from '../components/PasswordRules';

const blank = {
  emp_code: '', email: '', full_name: '', role: 'Employee', reporter_id: null, branch_id: '', job_type_id: '', department_id: '', designation_id: '',
  start_date: '', end_date: '', password: '',
  profile: { mobile: '', dob: '', gender: '', national_id: '', current_address: '', permanent_address: '', education: '' },
};

export function Section({ title, children }) {
  return (
    <Card><CardContent>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>{title}</Typography>
      <Grid container spacing={2}>{children}</Grid>
    </CardContent></Card>
  );
}
export const F = ({ children, md = 6 }) => <Grid size={{ xs: 12, md }}>{children}</Grid>;

export default function EmployeeEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can, user } = useAuth();
  const { run } = useUi();
  const existing = useFetch(id ? `/employees/${id}` : null);
  const branches = useFetch('/companies/branches', []);
  const depts = useFetch('/departments', []);
  const desigs = useFetch('/designations', []);
  const jobs = useFetch('/job-types', []);
  const [f, setF] = useState(blank);
  const [setPw, setSetPw] = useState(false);
  const [touched, setTouched] = useState(false);
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    const e = existing.data;
    if (!e) return;
    setF({ ...blank, ...e, branch_id: e.branch_id || '', job_type_id: e.job_type_id || '', department_id: e.department_id || '', designation_id: e.designation_id || '',
      start_date: e.start_date || '', end_date: e.end_date || '', profile: { ...blank.profile, ...e.profile } });
  }, [existing.data]);

  if (id && existing.loading) return <Loading rows={10} />;
  if (existing.error) return <ErrorAlert error={existing.error} />;

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e, ...(k === 'department_id' ? { designation_id: '' } : {}) }));
  const setP = (k) => (e) => setF((s) => ({ ...s, profile: { ...s.profile, [k]: e.target.value } }));
  const errors = {
    emp_code: !f.emp_code.trim() && 'Required',
    full_name: !f.full_name.trim() && 'Required',
    email: !/^\S+@\S+\.\S+$/.test(f.email) && 'Enter a valid email',
    end_date: f.end_date && f.start_date && f.end_date < f.start_date && 'Must be after the start date',
    password: !id && setPw && !passwordOk(f.password) && 'Needs 8+ characters with upper & lower case, a number and a symbol',
  };
  // only hand a select a value once its options exist (avoids MUI "out-of-range value" while lists load)
  const sel = (list, v) => (v && list.some((o) => o.id === v) ? v : '');
  const roles = can('Super Admin') ? ['Employee', 'Manager', 'Admin', 'Super Admin'] : ['Employee', 'Manager'];
  const self = Number(id) === user.id;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const body = {
      emp_code: f.emp_code, email: f.email, full_name: f.full_name, role: f.role, reporter_id: f.reporter_id || null,
      branch_id: f.branch_id || null, job_type_id: f.job_type_id || null, department_id: f.department_id || null, designation_id: f.designation_id || null,
      start_date: f.start_date || null, end_date: f.end_date || null, profile: f.profile,
      ...(!id && setPw ? { password: f.password } : {}),
    };
    if (self) delete body.role;
    const r = await run(() => (id ? patch(`/employees/${id}`, body) : post('/employees', body)), id ? 'Employee saved' : 'Employee added');
    if (!r) return;
    refreshPeople();
    if (!id && r.invite_link) setInvite({ link: r.invite_link, id: r.id });
    else nav(`/employees/${id || r.id}`);
  };

  if (invite) {
    return (
      <Card sx={{ maxWidth: 640 }}><CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>Employee added</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>An email with a link to set their password has been sent. While email isn't configured, you can share this link (valid 72 hours):</Typography>
        <TextField value={invite.link} slotProps={{ input: { readOnly: true } }} onFocus={(e) => e.target.select()} />
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => navigator.clipboard?.writeText(invite.link)}>Copy link</Button>
          <Button onClick={() => nav(`/employees/${invite.id}`)}>View profile</Button>
        </Stack>
      </CardContent></Card>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title={id ? `Edit ${existing.data?.full_name}` : 'Add employee'} subtitle={id ? 'Update employment details.' : 'They will get an email to set their own password.'}
        actions={<><Button onClick={() => nav(-1)} color="inherit">Cancel</Button><Button type="submit" variant="contained">{id ? 'Save' : 'Add employee'}</Button></>} />
      <Stack spacing={2.5}>
        <Section title="Account">
          <F><TextField label="Full name" required value={f.full_name} onChange={set('full_name')} error={touched && Boolean(errors.full_name)} helperText={touched && errors.full_name} /></F>
          <F><TextField label="Work email" required type="email" value={f.email} onChange={set('email')} error={touched && Boolean(errors.email)} helperText={touched && errors.email} /></F>
          <F md={4}><TextField label="Employee ID" required value={f.emp_code} onChange={set('emp_code')} error={touched && Boolean(errors.emp_code)} helperText={touched && errors.emp_code} /></F>
          <F md={4}>
            <TextField select label="Access level" value={f.role} onChange={set('role')} disabled={self || (!can('Super Admin') && ['Admin', 'Super Admin'].includes(f.role))}
              helperText={self ? "You can't change your own access" : 'Managers approve requests; admins manage the organisation'}>
              {[...new Set([...roles, f.role])].map((r) => <MenuItem key={r} value={r} disabled={!roles.includes(r)}>{r}</MenuItem>)}
            </TextField>
          </F>
          <F md={4}><PersonPicker label="Reports to" value={f.reporter_id} onChange={set('reporter_id')} exclude={id ? [Number(id)] : []} /></F>
          {!id && (
            <F md={12}>
              <FormControlLabel control={<Switch checked={setPw} onChange={(e) => setSetPw(e.target.checked)} />} label="Set a temporary password instead of emailing an invite" />
              {setPw && <PasswordField size="small" label="Temporary password" value={f.password} onChange={set('password')} error={touched && Boolean(errors.password)} helperText={touched && errors.password} sx={{ mt: 1 }} />}
            </F>
          )}
        </Section>
        <Section title="Employment">
          <F><TextField select label="Department" value={sel(depts.data, f.department_id)} onChange={set('department_id')}><MenuItem value="">—</MenuItem>{depts.data.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}</TextField></F>
          <F><TextField select label="Designation" value={sel(desigs.data.filter((d) => d.department_id === f.department_id), f.designation_id)} onChange={set('designation_id')} disabled={!f.department_id} helperText={!f.department_id ? 'Choose a department first' : ''}>
            <MenuItem value="">—</MenuItem>{desigs.data.filter((d) => d.department_id === f.department_id).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField></F>
          <F><TextField select label="Branch" value={sel(branches.data, f.branch_id)} onChange={set('branch_id')}><MenuItem value="">—</MenuItem>{branches.data.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}</TextField></F>
          <F><TextField select label="Employee type" value={sel(jobs.data, f.job_type_id)} onChange={set('job_type_id')} helperText="Decides their leave entitlements"><MenuItem value="">—</MenuItem>{jobs.data.map((j) => <MenuItem key={j.id} value={j.id}>{j.name}</MenuItem>)}</TextField></F>
          <F><TextField type="date" label="Start date" value={f.start_date} onChange={set('start_date')} slotProps={{ inputLabel: { shrink: true } }} /></F>
          <F><TextField type="date" label="End date (if leaving)" value={f.end_date} onChange={set('end_date')} slotProps={{ inputLabel: { shrink: true } }} error={Boolean(errors.end_date)} helperText={errors.end_date} /></F>
        </Section>
        <Section title="Contact (optional)">
          <F><TextField label="Mobile" value={f.profile.mobile} onChange={setP('mobile')} /></F>
          <F><TextField type="date" label="Date of birth" value={f.profile.dob} onChange={setP('dob')} slotProps={{ inputLabel: { shrink: true } }} /></F>
          <F md={12}><TextField label="Current address" value={f.profile.current_address} onChange={setP('current_address')} /></F>
        </Section>
        {!id && <Alert severity="info">Personal details like bank account and emergency contact are filled in by the employee from their own profile.</Alert>}
      </Stack>
    </form>
  );
}
