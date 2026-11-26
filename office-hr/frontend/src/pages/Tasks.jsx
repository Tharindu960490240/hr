import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import { AddRounded, SearchRounded, RepeatRounded, SubdirectoryArrowRightRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post, patch } from '../lib/api';
import DataTable from '../components/DataTable';
import PersonPicker from '../components/PersonPicker';
import { PageHeader, StatusChip, ErrorAlert, FormDialog, EmptyState } from '../components/ui';
import { fmtShort, dayjs } from '../lib/format';

const blank = {
  title: '', description: '', kind: 'one_time', project_id: '', parent_id: null, due_date: '', priority: 'medium',
  assignee_id: null, reporter_id: null, estimate_hours: '', repeat_rule: { every: 1, unit: 'week', until: '' },
};

/** Create or edit a task. Pass `fixed` = { project_id, parent_id } to lock context. */
export function TaskForm({ open, onClose, onSaved, initial, fixed = {} }) {
  const { user, can } = useAuth();
  const { run } = useUi();
  const projects = useFetch(open && !fixed.project_id && !fixed.parent_id && !initial ? '/projects' : null, []);
  const [f, setF] = useState(blank);
  const [touched, setTouched] = useState(false);
  const editing = Boolean(initial?.id);
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setF(initial
      ? { ...blank, ...initial, due_date: initial.due_date || '', estimate_hours: initial.estimate_hours ?? '', repeat_rule: initial.repeat_rule || blank.repeat_rule }
      : { ...blank, ...fixed, assignee_id: can('Manager') ? null : user.id });
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const inContext = Boolean(fixed.project_id || fixed.parent_id || f.project_id || f.parent_id);
  const errors = {
    title: !f.title.trim() ? 'Give the task a title' : '',
    due_date: f.kind === 'repeating' && !f.due_date ? 'Repeating tasks need a first due date' : '',
    reporter_id: f.reporter_id && f.reporter_id === (f.assignee_id || user.id) ? "The assignee can't review their own task" : '',
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (!valid) return false;
    const body = {
      title: f.title, description: f.description, priority: f.priority, due_date: f.due_date || null,
      assignee_id: f.assignee_id || null, reporter_id: f.reporter_id || null,
      estimate_hours: f.estimate_hours === '' ? null : Number(f.estimate_hours),
      ...(f.kind === 'repeating' ? { repeat_rule: { ...f.repeat_rule, every: Number(f.repeat_rule.every) || 1, until: f.repeat_rule.until || null } } : {}),
    };
    if (!editing) Object.assign(body, { kind: f.project_id ? 'project' : f.kind, project_id: f.project_id || null, parent_id: f.parent_id || null });
    const r = await run(() => (editing ? patch(`/tasks/${initial.id}`, body) : post('/tasks', body)), editing ? 'Task saved' : 'Task created');
    if (r) onSaved?.(r);
    return Boolean(r);
  };

  return (
    <FormDialog open={open} onClose={onClose} title={editing ? 'Edit task' : fixed.parent_id ? 'New sub-task' : 'New task'} onSubmit={submit} submitLabel={editing ? 'Save' : 'Create task'} maxWidth="md">
      <Stack spacing={2.25}>
        {!editing && !inContext && (
          <ToggleButtonGroup exclusive color="primary" value={f.kind} onChange={(_, v) => v && set('kind', v)} size="small">
            <ToggleButton value="one_time">One-time task</ToggleButton>
            <ToggleButton value="repeating"><RepeatRounded fontSize="small" sx={{ mr: 0.75 }} />Repeating task</ToggleButton>
          </ToggleButtonGroup>
        )}
        <TextField label="Title" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus error={touched && Boolean(errors.title)} helperText={touched ? errors.title : ''} />
        <TextField label="Description" multiline minRows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
        {!editing && !fixed.project_id && !fixed.parent_id && f.kind !== 'repeating' && projects.data.length > 0 && (
          <TextField select label="Project (optional)" value={f.project_id || ''} onChange={(e) => set('project_id', e.target.value)}>
            <MenuItem value="">No project</MenuItem>
            {projects.data.filter((p) => !['completed', 'cancelled'].includes(p.status)).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <PersonPicker label="Assignee" value={f.assignee_id} onChange={(v) => set('assignee_id', v)} disabled={!can('Manager') && !f.project_id && !fixed.project_id && !fixed.parent_id}
            helperText={!f.assignee_id ? 'Leave empty to assign to yourself' : ''} />
          <PersonPicker label="Reviewer (optional)" value={f.reporter_id} onChange={(v) => set('reporter_id', v)} error={touched && Boolean(errors.reporter_id)}
            helperText={touched && errors.reporter_id ? errors.reporter_id : 'Approves the task when it is done'} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField type="date" label={f.kind === 'repeating' ? 'First due date' : 'Due date'} value={f.due_date} onChange={(e) => set('due_date', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} error={touched && Boolean(errors.due_date)} helperText={touched ? errors.due_date : ''} />
          <TextField select label="Priority" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            <MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem>
          </TextField>
          <TextField type="number" label="Estimate (hours)" value={f.estimate_hours} onChange={(e) => set('estimate_hours', e.target.value)} slotProps={{ htmlInput: { min: 0, step: 0.5 } }} />
        </Stack>
        {f.kind === 'repeating' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
            <Typography sx={{ flex: 'none' }}>Repeat every</Typography>
            <TextField type="number" value={f.repeat_rule.every} onChange={(e) => set('repeat_rule', { ...f.repeat_rule, every: e.target.value })} sx={{ width: { sm: 90 } }} slotProps={{ htmlInput: { min: 1, max: 365, 'aria-label': 'Repeat interval' } }} />
            <TextField select value={f.repeat_rule.unit} onChange={(e) => set('repeat_rule', { ...f.repeat_rule, unit: e.target.value })} sx={{ width: { sm: 140 } }} slotProps={{ htmlInput: { 'aria-label': 'Repeat unit' } }}>
              <MenuItem value="day">day(s)</MenuItem><MenuItem value="week">week(s)</MenuItem><MenuItem value="month">month(s)</MenuItem>
            </TextField>
            <TextField type="date" label="Until (optional)" value={f.repeat_rule.until || ''} onChange={(e) => set('repeat_rule', { ...f.repeat_rule, until: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
        )}
      </Stack>
    </FormDialog>
  );
}

export const taskColumns = (showAssignee = true) => [
  { key: 'title', label: 'Task', render: (t) => (
    <Box sx={{ minWidth: 220 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        {t.parent_id && <SubdirectoryArrowRightRounded fontSize="small" color="disabled" />}
        {t.kind === 'repeating' && <RepeatRounded fontSize="small" color="action" titleAccess="Repeating" />}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.title}</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t.project || (t.kind === 'repeating' ? 'Repeating task' : 'One-time task')}
        {t.subtask_count ? ` · ${t.subtask_done}/${t.subtask_count} sub-tasks` : ''}
      </Typography>
    </Box>
  ) },
  ...(showAssignee ? [{ key: 'assignee', label: 'Assignee' }] : []),
  { key: 'reporter', label: 'Reviewer' },
  { key: 'due_date', label: 'Due', render: (t) => {
    const late = t.due_date && t.status !== 'done' && dayjs(t.due_date).isBefore(dayjs(), 'day');
    return <Typography variant="body2" sx={{ color: late ? 'error.main' : undefined, fontWeight: late ? 700 : 400 }}>{fmtShort(t.due_date)}</Typography>;
  } },
  { key: 'priority', label: 'Priority', render: (t) => <StatusChip value={t.priority} />, sort: (t) => ({ high: 0, medium: 1, low: 2 })[t.priority] },
  { key: 'status', label: 'Status', render: (t) => (
    <Stack direction="row" spacing={0.5}>
      <StatusChip value={t.status} />
      {t.approval === 'pending' && <StatusChip value="pending" label="In review" />}
      {t.approval === 'rejected' && <StatusChip value="rejected" label="Changes needed" />}
    </Stack>
  ) },
];

const TITLES = {
  assigned: ['My tasks', 'Tasks assigned to you, most urgent first.'],
  review: ['Tasks to review', 'Work that others finished and you need to approve.'],
  all: ['All tasks', 'Every task across the organisation.'],
};

export default function Tasks({ scope }) {
  const nav = useNavigate();
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [form, setForm] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setStatus(scope === 'review' ? '' : 'open'); }, [scope]);
  const qs = new URLSearchParams({ scope, ...(status ? { status } : {}), ...(kind ? { kind } : {}), ...(debounced ? { q: debounced } : {}) });
  const { data, loading, error, reload } = useFetch(`/tasks?${qs}`, []);
  const [title, subtitle] = TITLES[scope];
  const columns = useMemo(() => taskColumns(scope !== 'assigned'), [scope]);

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}
        actions={scope !== 'review' && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm(true)}>New task</Button>} />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ px: 2, borderBottom: 1, borderColor: 'divider', alignItems: { md: 'center' }, gap: 2 }}>
          {scope !== 'review' && (
            <Tabs value={status} onChange={(_, v) => setStatus(v)} variant="scrollable" sx={{ flex: 1 }}>
              <Tab value="open" label="Open" />
              <Tab value="todo" label="To do" />
              <Tab value="in_progress" label="In progress" />
              <Tab value="done" label="Done" />
              <Tab value="" label="All" />
            </Tabs>
          )}
          {scope === 'review' && <Box sx={{ flex: 1 }} />}
          <TextField select size="small" label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ width: { md: 170 }, my: 1 }}>
            <MenuItem value="">All kinds</MenuItem><MenuItem value="project">Project</MenuItem><MenuItem value="one_time">One-time</MenuItem><MenuItem value="repeating">Repeating</MenuItem>
          </TextField>
          <TextField size="small" placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { md: 240 }, mb: { xs: 1, md: 0 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
        </Stack>
        <DataTable columns={columns} rows={data} loading={loading} onRowClick={(t) => nav(`/tasks/${t.id}`)}
          empty={<EmptyState title={scope === 'review' ? 'Nothing to review' : 'No tasks here'} hint={scope === 'assigned' ? 'Enjoy the calm, or create a task for yourself.' : undefined} />} />
      </Card>
      <TaskForm open={form} onClose={() => setForm(false)} onSaved={(r) => (r?.id ? nav(`/tasks/${r.id}`) : reload())} />
    </>
  );
}
