import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import { AddRounded, CalendarMonthRounded, CloseRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post, patch } from '../lib/api';
import PersonPicker from '../components/PersonPicker';
import { PageHeader, StatusChip, ErrorAlert, FormDialog, EmptyState, Loading } from '../components/ui';
import { fmtShort } from '../lib/format';

const blank = { name: '', description: '', category_id: '', priority: 'medium', status: 'planned', start_date: '', end_date: '', note: '', member_ids: [], reporter_ids: [], team_ids: [], kpis: [] };

export function ProjectForm({ open, onClose, initial, onSaved }) {
  const { run } = useUi();
  const cats = useFetch(open ? '/categories' : null, []);
  const teams = useFetch(open ? '/teams' : null, []);
  const [f, setF] = useState(blank);
  const [kpi, setKpi] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setF(initial ? {
      ...blank, ...initial, category_id: initial.category_id || '', start_date: initial.start_date || '', end_date: initial.end_date || '',
      member_ids: initial.members.map((m) => m.id), reporter_ids: initial.reporters.map((m) => m.id), team_ids: initial.teams.map((t) => t.id), kpis: initial.kpis.map((k) => k.name),
    } : blank);
  }, [open, initial]);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const dateErr = f.start_date && f.end_date && f.end_date < f.start_date;
  const submit = async () => {
    setTouched(true);
    if (!f.name.trim() || dateErr) return false;
    const body = { ...f, category_id: f.category_id || null, start_date: f.start_date || null, end_date: f.end_date || null };
    ['id', 'members', 'reporters', 'teams', 'tasks', 'owner', 'owner_id', 'category', 'task_count', 'done_count', 'created_at', 'can_edit'].forEach((k) => delete body[k]);
    const r = await run(() => (initial ? patch(`/projects/${initial.id}`, body) : post('/projects', body)), initial ? 'Project saved' : 'Project created');
    if (r) onSaved?.(r);
    return Boolean(r);
  };
  const addKpi = () => { if (kpi.trim()) { set('kpis', [...f.kpis, kpi.trim()]); setKpi(''); } };

  return (
    <FormDialog open={open} onClose={onClose} title={initial ? 'Edit project' : 'New project'} onSubmit={submit} submitLabel={initial ? 'Save' : 'Create project'} maxWidth="md">
      <Stack spacing={2.25}>
        <TextField label="Project name" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus error={touched && !f.name.trim()} helperText={touched && !f.name.trim() ? 'Give the project a name' : ''} />
        <TextField label="Description" multiline minRows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select label="Category" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <MenuItem value="">None</MenuItem>
            {cats.data.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField select label="Priority" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            <MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem>
          </TextField>
          <TextField select label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {['planned', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => <MenuItem key={s} value={s}>{s === 'on_hold' ? 'On hold' : s[0].toUpperCase() + s.slice(1)}</MenuItem>)}
          </TextField>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField type="date" label="Start" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="End" value={f.end_date} onChange={(e) => set('end_date', e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: f.start_date } }}
            error={Boolean(dateErr)} helperText={dateErr ? 'Must be after the start date' : ''} />
        </Stack>
        <PersonPicker multiple label="Members" value={f.member_ids} onChange={(v) => set('member_ids', v)} />
        <PersonPicker multiple label="Reporters (can add tasks & review)" value={f.reporter_ids} onChange={(v) => set('reporter_ids', v)} />
        <Autocomplete multiple options={teams.data} getOptionLabel={(t) => t.name} value={teams.data.filter((t) => f.team_ids.includes(t.id))}
          onChange={(_, v) => set('team_ids', v.map((t) => t.id))} isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(p) => <TextField {...p} label="Teams" />} />
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <TextField label="Add a KPI / success measure" value={kpi} onChange={(e) => setKpi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKpi(); } }} />
            <Button onClick={addKpi} disabled={!kpi.trim()}>Add</Button>
          </Stack>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {f.kpis.map((k, i) => <Chip key={i} label={k} onDelete={() => set('kpis', f.kpis.filter((_, j) => j !== i))} />)}
          </Stack>
        </Stack>
        <TextField label="Notes" multiline minRows={2} value={f.note} onChange={(e) => set('note', e.target.value)} />
      </Stack>
    </FormDialog>
  );
}

export default function Projects() {
  const nav = useNavigate();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch('/projects', []);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(false);
  const rows = data.filter((p) => (!status || p.status === status) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHeader title="Projects" subtitle={can('Manager') ? 'Every project in the organisation.' : 'Projects you are part of.'}
        actions={can('Manager') && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm(true)}>New project</Button>} />
      <ErrorAlert error={error} onRetry={reload} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
        <TextField placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { sm: 320 } }}
          slotProps={{ input: { endAdornment: q && <IconButton size="small" onClick={() => setQ('')} aria-label="Clear"><CloseRounded fontSize="small" /></IconButton> } }} />
        <TextField select value={status} onChange={(e) => setStatus(e.target.value)} sx={{ maxWidth: { sm: 200 } }} slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">All statuses</MenuItem>
          {['planned', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => <MenuItem key={s} value={s}>{s === 'on_hold' ? 'On hold' : s[0].toUpperCase() + s.slice(1)}</MenuItem>)}
        </TextField>
      </Stack>
      {loading && !data.length ? <Loading /> : rows.length === 0 ? <Card><EmptyState title="No projects" hint={can('Manager') ? 'Create the first one.' : "You're not on any projects yet."} /></Card> : (
        <Grid container spacing={2.5}>
          {rows.map((p) => {
            const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
            return (
              <Grid key={p.id} size={{ xs: 12, sm: 6, xl: 4 }}>
                <Card sx={{ height: '100%' }}>
                  <CardActionArea onClick={() => nav(`/projects/${p.id}`)} sx={{ height: '100%', alignItems: 'stretch' }}>
                    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{p.category || 'Uncategorised'}</Typography>
                        <StatusChip value={p.status} />
                      </Stack>
                      <Typography variant="h6" sx={{ lineHeight: 1.3 }}>{p.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</Typography>
                      <Stack spacing={0.5}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">{p.done_count}/{p.task_count} tasks done</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>{pct}%</Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} color={p.status === 'completed' ? 'success' : 'primary'} />
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                        <CalendarMonthRounded sx={{ fontSize: 16 }} />
                        <Typography variant="caption">{fmtShort(p.start_date)} – {fmtShort(p.end_date)}</Typography>
                        <span style={{ flex: 1 }} />
                        <StatusChip value={p.priority} />
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
      <ProjectForm open={form} onClose={() => setForm(false)} onSaved={(r) => nav(`/projects/${r.id}`)} />
    </>
  );
}
