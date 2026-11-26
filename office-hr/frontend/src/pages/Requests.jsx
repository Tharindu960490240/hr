import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { AddRounded, EditRounded, DeleteOutlineRounded, EventBusyRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post, patch, del } from '../lib/api';
import DataTable from '../components/DataTable';
import { PageHeader, StatusChip, ErrorAlert, ConfirmDialog, FormDialog, EmptyState } from '../components/ui';
import { range, fmtDate, today, dayjs } from '../lib/format';

const blank = { kind: 'leave', leave_type: '', start_date: '', end_date: '', reason: '' };

/** Rough working-day estimate shown while filling the form (server is authoritative). */
const weekdays = (a, b) => {
  if (!a || !b || b < a) return 0;
  let n = 0;
  for (let d = dayjs(a); !d.isAfter(dayjs(b)); d = d.add(1, 'day')) if (d.day() % 6 !== 0) n++;
  return n;
};

export function RequestForm({ open, onClose, initial, balance, onSaved }) {
  const { run } = useUi();
  const [f, setF] = useState(blank);
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (open) { setF(initial ? { ...blank, ...initial, leave_type: initial.leave_type || '' } : blank); setTouched(false); } }, [open, initial]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value, ...(k === 'start_date' && (!s.end_date || s.end_date < e.target.value) ? { end_date: e.target.value } : {}) }));
  const days = weekdays(f.start_date, f.end_date);
  const type = balance?.find((b) => b.name === f.leave_type);
  const errors = {
    leave_type: f.kind === 'leave' && !f.leave_type ? 'Choose a leave type' : '',
    start_date: !f.start_date ? 'Pick a start date' : '',
    end_date: !f.end_date ? 'Pick an end date' : f.end_date < f.start_date ? 'Must be on or after the start date' : '',
    reason: f.reason.trim().length < 3 ? 'Please give a short reason' : '',
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (!valid) return false;
    const body = { ...f, leave_type: f.kind === 'leave' ? f.leave_type : null };
    const r = await run(() => (initial?.id ? patch(`/requests/${initial.id}`, body) : post('/requests', body)), initial?.id ? 'Request updated' : 'Request sent for approval');
    if (r) onSaved();
    return Boolean(r);
  };

  return (
    <FormDialog open={open} onClose={onClose} title={initial?.id ? 'Edit request' : 'New request'} onSubmit={submit} submitLabel={initial?.id ? 'Save changes' : 'Send request'}>
      <Stack spacing={2.25} sx={{ pt: 0.5 }}>
        <ToggleButtonGroup exclusive fullWidth color="primary" value={f.kind} onChange={(_, v) => v && !initial?.id && setF((s) => ({ ...s, kind: v }))} disabled={Boolean(initial?.id)}>
          <ToggleButton value="leave">Leave</ToggleButton>
          <ToggleButton value="wfh">Work from home</ToggleButton>
        </ToggleButtonGroup>
        {f.kind === 'leave' && (
          <TextField select label="Leave type" value={f.leave_type} onChange={set('leave_type')} error={touched && Boolean(errors.leave_type)}
            helperText={touched && errors.leave_type ? errors.leave_type : type ? `${type.remaining - type.pending} day(s) available` : ' '}>
            {(balance || []).filter((b) => b.entitled > 0).map((b) => (
              <MenuItem key={b.name} value={b.name}>{b.name} — {b.remaining - b.pending} available</MenuItem>
            ))}
          </TextField>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField type="date" label="From" value={f.start_date} onChange={set('start_date')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: f.kind === 'leave' ? undefined : today() } }}
            error={touched && Boolean(errors.start_date)} helperText={touched ? errors.start_date : ''} />
          <TextField type="date" label="To" value={f.end_date} onChange={set('end_date')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: f.start_date } }}
            error={touched && Boolean(errors.end_date)} helperText={touched ? errors.end_date : ''} />
        </Stack>
        {days > 0 && (
          <Typography variant="body2" color="text.secondary">
            About <b>{days}</b> working day{days > 1 ? 's' : ''} (public holidays are not counted).
          </Typography>
        )}
        <TextField label="Reason" multiline minRows={3} value={f.reason} onChange={set('reason')} error={touched && Boolean(errors.reason)} helperText={touched ? errors.reason : ''} />
      </Stack>
    </FormDialog>
  );
}

export default function Requests() {
  const { user } = useAuth();
  const { run } = useUi();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('all');
  const { data, loading, error, reload } = useFetch('/requests?scope=mine', []);
  const bal = useFetch(`/employees/${user.id}/leave-balance`, []);
  const [form, setForm] = useState({ open: params.get('new') === '1', initial: null });
  const [cancel, setCancel] = useState(null);
  const [remove, setRemove] = useState(null);

  const rows = useMemo(() => (tab === 'all' ? data : data.filter((r) => (tab === 'upcoming' ? r.end_date >= today() && ['pending', 'approved'].includes(r.status) : r.kind === tab))), [data, tab]);
  const refresh = () => { reload(); bal.reload(); };
  const closeForm = () => { setForm({ open: false, initial: null }); if (params.get('new')) setParams({}, { replace: true }); };

  const columns = [
    { key: 'kind', label: 'Type', render: (r) => <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.kind === 'leave' ? r.leave_type : 'Work from home'}</Typography></Box>, sort: (r) => r.leave_type || 'wfh' },
    { key: 'start_date', label: 'Dates', render: (r) => range(r.start_date, r.end_date) },
    { key: 'days', label: 'Days', align: 'right' },
    { key: 'reason', label: 'Reason', render: (r) => <Typography variant="body2" sx={{ maxWidth: 260 }} noWrap title={r.reason}>{r.reason}</Typography> },
    { key: 'status', label: 'Status', render: (r) => (
      <Tooltip title={r.decision_note || r.cancel_reason || (r.decided_by_name ? `by ${r.decided_by_name}` : '')}><span><StatusChip value={r.status} /></span></Tooltip>
    ) },
    { key: 'created_at', label: 'Requested', render: (r) => fmtDate(r.created_at) },
    { key: 'actions', label: '', sort: false, align: 'right', render: (r) => (
      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
        {r.status === 'pending' && (
          <>
            <Tooltip title="Edit"><IconButton size="small" onClick={() => setForm({ open: true, initial: r })}><EditRounded fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Delete"><IconButton size="small" onClick={() => setRemove(r)}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>
          </>
        )}
        {(r.status === 'approved' && r.start_date > today()) && (
          <Tooltip title="Cancel"><IconButton size="small" onClick={() => setCancel(r)}><EventBusyRounded fontSize="small" /></IconButton></Tooltip>
        )}
      </Stack>
    ) },
  ];

  return (
    <>
      <PageHeader title="Leave & work from home" subtitle="Request time off or a work-from-home day. Your manager is notified straight away."
        actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ open: true, initial: null })}>New request</Button>} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {bal.data.filter((b) => b.entitled > 0 || b.used > 0).map((b) => (
          <Grid key={b.name} size={{ xs: 6, sm: 4, lg: 2.4 }}>
            <Card><CardContent sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary" noWrap>{b.name}</Typography>
              <Typography variant="h5">{b.remaining}<Typography component="span" color="text.secondary" sx={{ fontSize: 15 }}> / {b.entitled}</Typography></Typography>
              <Typography variant="caption" color="text.secondary">{b.used} used{b.pending ? ` · ${b.pending} pending` : ''}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="all" label="All" />
          <Tab value="upcoming" label="Upcoming" />
          <Tab value="leave" label="Leave" />
          <Tab value="wfh" label="Work from home" />
        </Tabs>
        <DataTable columns={columns} rows={rows} loading={loading} initialSort={{ key: 'start_date', dir: 'desc' }}
          empty={<EmptyState title="No requests yet" hint="Your leave and work-from-home requests will show here." />} />
      </Card>

      <RequestForm open={form.open} initial={form.initial} balance={bal.data} onClose={closeForm} onSaved={refresh} />
      <ConfirmDialog open={Boolean(cancel)} title="Cancel this request?" message={cancel && `${cancel.kind === 'leave' ? cancel.leave_type : 'Work from home'}, ${range(cancel.start_date, cancel.end_date)}. Your manager will be told.`}
        reason reasonRequired confirmLabel="Cancel request" danger onClose={() => setCancel(null)}
        onConfirm={async (reason) => { const ok = await run(() => post(`/requests/${cancel.id}/cancel`, { reason }), 'Request cancelled'); if (ok) refresh(); return Boolean(ok); }} />
      <ConfirmDialog open={Boolean(remove)} title="Delete this request?" message="It hasn't been reviewed yet, so it will simply be removed." confirmLabel="Delete" danger onClose={() => setRemove(null)}
        onConfirm={async () => { const ok = await run(() => del(`/requests/${remove.id}`), 'Request deleted'); if (ok) refresh(); return Boolean(ok); }} />
    </>
  );
}
