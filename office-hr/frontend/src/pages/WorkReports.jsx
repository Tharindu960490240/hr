import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { AddRounded, DeleteOutlineRounded, EditRounded } from '@mui/icons-material';
import { useUi } from '../context/UiContext';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../lib/useFetch';
import { get, post, put, del } from '../lib/api';
import DataTable from '../components/DataTable';
import { PageHeader, ErrorAlert, FormDialog, EmptyState, ConfirmDialog } from '../components/ui';
import { fmtDate, fmtTime, today, dayjs } from '../lib/format';

export const hours = (a, b) => (a && b ? Math.round(dayjs(`2000-01-01T${b}`).diff(dayjs(`2000-01-01T${a}`), 'minute') / 6) / 10 : 0);
const hhmm = (t) => (t ? t.slice(0, 5) : '');
const blankItem = () => ({ start_time: '', end_time: '', task_id: '', description: '' });

export function ReportView({ id, onClose, onEdit }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { setR(null); setErr(null); if (id) get(`/work-reports/${id}`).then(setR).catch(setErr); }, [id]);
  return (
    <Dialog open={Boolean(id)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{r ? `${r.employee} · ${dayjs(r.work_date).format('ddd D MMM YYYY')}` : 'Work report'}</DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error">{err.message}</Alert>}
        {r && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={4}>
              <Box><Typography variant="caption" color="text.secondary">In</Typography><Typography sx={{ fontWeight: 700 }}>{fmtTime(r.time_in)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Out</Typography><Typography sx={{ fontWeight: 700 }}>{fmtTime(r.time_out)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Hours</Typography><Typography sx={{ fontWeight: 700 }}>{hours(r.time_in, r.time_out)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">How the day went</Typography><Rating value={r.rating} readOnly size="small" sx={{ display: 'flex' }} /></Box>
            </Stack>
            {r.notes && <Typography color="text.secondary">{r.notes}</Typography>}
            <Divider />
            <Stack spacing={1.25}>
              {r.items.map((i) => (
                <Stack key={i.id} direction="row" spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 120, flex: 'none' }}>{fmtTime(i.start_time)} – {fmtTime(i.end_time)}</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{i.description}</Typography>
                    {i.task_title && <Typography variant="caption" color="primary">Task: {i.task_title}</Typography>}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {onEdit && r && <Button startIcon={<EditRounded />} onClick={() => onEdit(r)}>Edit</Button>}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function ReportForm({ open, initial, onClose, onSaved }) {
  const { run } = useUi();
  const tasks = useFetch(open ? '/tasks?scope=assigned&status=open' : null, []);
  const [f, setF] = useState(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setF(initial
      ? { ...initial, time_in: hhmm(initial.time_in), time_out: hhmm(initial.time_out), items: initial.items.map((i) => ({ ...i, start_time: hhmm(i.start_time), end_time: hhmm(i.end_time), task_id: i.task_id || '' })) }
      : { work_date: today(), time_in: '09:00', time_out: '17:30', rating: 4, notes: '', items: [{ ...blankItem(), start_time: '09:00', end_time: '10:00' }] });
  }, [open, initial]);
  if (!f) return null;
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setItem = (i, k, v) => setF((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const itemErr = (it) => !it.start_time || !it.end_time || it.end_time <= it.start_time || !it.description.trim();
  const valid = f.time_out > f.time_in && f.items.length && !f.items.some(itemErr) && f.rating;

  const submit = async () => {
    setTouched(true);
    if (!valid) return false;
    const body = { work_date: f.work_date, time_in: f.time_in, time_out: f.time_out, rating: f.rating, notes: f.notes,
      items: f.items.map((i) => ({ start_time: i.start_time, end_time: i.end_time, task_id: i.task_id || null, description: i.description })) };
    const r = await run(() => (initial ? put(`/work-reports/${initial.id}`, body) : post('/work-reports', body)), initial ? 'Report updated' : 'Report submitted');
    if (r) onSaved();
    return Boolean(r);
  };
  const lastEnd = f.items.at(-1)?.end_time || f.time_in;

  return (
    <FormDialog open={open} onClose={onClose} title={initial ? 'Edit work report' : 'Daily work report'} onSubmit={submit} submitLabel={initial ? 'Save' : 'Submit report'} maxWidth="md">
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
          <TextField type="date" label="Date" value={f.work_date} disabled={Boolean(initial)} onChange={(e) => set('work_date', e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }} />
          <TextField type="time" label="Time in" value={f.time_in} onChange={(e) => set('time_in', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="time" label="Time out" value={f.time_out} onChange={(e) => set('time_out', e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
            error={touched && f.time_out <= f.time_in} helperText={touched && f.time_out <= f.time_in ? 'After time in' : ''} />
          <Box sx={{ flex: 'none' }}>
            <Typography variant="caption" color="text.secondary">How did today go?</Typography>
            <Rating value={f.rating} onChange={(_, v) => set('rating', v)} sx={{ display: 'flex' }} />
          </Box>
        </Stack>
        <Divider textAlign="left"><Typography variant="overline">What you worked on</Typography></Divider>
        {f.items.map((it, i) => (
          <Stack key={i} direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'flex-start' } }}>
            <TextField type="time" label="From" value={it.start_time} onChange={(e) => setItem(i, 'start_time', e.target.value)} sx={{ width: { md: 130 } }} slotProps={{ inputLabel: { shrink: true } }} error={touched && !it.start_time} />
            <TextField type="time" label="To" value={it.end_time} onChange={(e) => setItem(i, 'end_time', e.target.value)} sx={{ width: { md: 130 } }} slotProps={{ inputLabel: { shrink: true } }}
              error={touched && (!it.end_time || it.end_time <= it.start_time)} />
            <TextField select label="Task (optional)" value={it.task_id} onChange={(e) => setItem(i, 'task_id', e.target.value)} sx={{ width: { md: 220 } }}>
              <MenuItem value="">No task</MenuItem>
              {tasks.data.map((t) => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}
              {it.task_id && !tasks.data.some((t) => t.id === it.task_id) && <MenuItem value={it.task_id}>{it.task_title || `Task #${it.task_id}`}</MenuItem>}
            </TextField>
            <TextField label="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} error={touched && !it.description.trim()} />
            <IconButton onClick={() => set('items', f.items.filter((_, j) => j !== i))} disabled={f.items.length === 1} aria-label="Remove activity"><DeleteOutlineRounded /></IconButton>
          </Stack>
        ))}
        <Box>
          <Button startIcon={<AddRounded />} onClick={() => set('items', [...f.items, { ...blankItem(), start_time: lastEnd, end_time: lastEnd < '23:00' ? dayjs(`2000-01-01T${lastEnd}`).add(1, 'hour').format('HH:mm') : '' }])}>Add activity</Button>
        </Box>
        <TextField label="Notes (optional)" multiline minRows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </Stack>
    </FormDialog>
  );
}

export default function WorkReports() {
  const { user } = useAuth();
  const { run } = useUi();
  const [params, setParams] = useSearchParams();
  const from = dayjs().subtract(60, 'day').format('YYYY-MM-DD');
  const { data, loading, error, reload } = useFetch(`/work-reports?from=${from}`, []);
  const [form, setForm] = useState({ open: params.get('new') === '1', initial: null });
  const [view, setView] = useState(null);
  const [remove, setRemove] = useState(null);
  const done = data.some((r) => r.work_date === today());

  const columns = [
    { key: 'work_date', label: 'Date', render: (r) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{dayjs(r.work_date).format('ddd D MMM')}</Typography> },
    { key: 'time_in', label: 'In', render: (r) => fmtTime(r.time_in) },
    { key: 'time_out', label: 'Out', render: (r) => fmtTime(r.time_out) },
    { key: 'hours', label: 'Hours', align: 'right', sort: (r) => hours(r.time_in, r.time_out), render: (r) => hours(r.time_in, r.time_out) },
    { key: 'item_count', label: 'Activities', align: 'right' },
    { key: 'rating', label: 'Day', render: (r) => <Rating value={r.rating} readOnly size="small" /> },
    { key: 'x', label: '', sort: false, align: 'right', render: (r) => (
      <IconButton size="small" aria-label="Delete" onClick={(e) => { e.stopPropagation(); setRemove(r); }}><DeleteOutlineRounded fontSize="small" /></IconButton>
    ) },
  ];

  const close = () => { setForm({ open: false, initial: null }); if (params.get('new')) setParams({}, { replace: true }); };

  return (
    <>
      <PageHeader title="Daily work report" subtitle={`Log your hours and what you worked on, ${user.full_name.split(' ')[0]}. Managers use these for attendance.`}
        actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ open: true, initial: null })} disabled={done}>{done ? "Today's report is in" : "Add today's report"}</Button>} />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        <DataTable columns={columns} rows={data} loading={loading} initialSort={{ key: 'work_date', dir: 'desc' }} onRowClick={(r) => setView(r.id)}
          empty={<EmptyState title="No reports yet" hint="Submit your first daily report to get started." />} />
      </Card>
      <ReportForm open={form.open} initial={form.initial} onClose={close} onSaved={reload} />
      <ReportView id={view} onClose={() => setView(null)} onEdit={(r) => { setView(null); setForm({ open: true, initial: r }); }} />
      <ConfirmDialog open={Boolean(remove)} title="Delete this report?" message={remove && fmtDate(remove.work_date)} confirmLabel="Delete" danger onClose={() => setRemove(null)}
        onConfirm={async () => { const ok = await run(() => del(`/work-reports/${remove.id}`), 'Report deleted'); if (ok) reload(); return Boolean(ok); }} />
    </>
  );
}
