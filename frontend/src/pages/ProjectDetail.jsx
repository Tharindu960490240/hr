import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import AvatarGroup from '@mui/material/AvatarGroup';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { AddRounded, EditRounded, DeleteOutlineRounded, FlagRounded, ExpandMoreRounded, ChevronRightRounded } from '@mui/icons-material';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { del } from '../lib/api';
import EmpAvatar from '../components/EmpAvatar';
import { StatusChip, Loading, ErrorAlert, ConfirmDialog, EmptyState } from '../components/ui';
import { ProjectForm } from './Projects';
import { TaskForm } from './Tasks';
import { fmtDate, fmtShort, labelize, dayjs } from '../lib/format';

function TaskRow({ t, children, depth, nav }) {
  const [open, setOpen] = useState(true);
  const late = t.due_date && t.status !== 'done' && dayjs(t.due_date).isBefore(dayjs(), 'day');
  return (
    <>
      <Stack direction="row" spacing={1.5} onClick={() => nav(`/tasks/${t.id}`)}
        sx={{ py: 1.1, pl: 1 + depth * 3.5, pr: 1, alignItems: 'center', cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
        <Box sx={{ width: 24, flex: 'none' }}>
          {children.length > 0 && (
            <Box component="span" role="button" aria-label={open ? 'Collapse' : 'Expand'} onClick={(e) => { e.stopPropagation(); setOpen(!open); }} sx={{ display: 'flex' }}>
              {open ? <ExpandMoreRounded fontSize="small" /> : <ChevronRightRounded fontSize="small" />}
            </Box>
          )}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: depth ? 500 : 650, flex: 1, minWidth: 0, textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.7 : 1 }} noWrap>{t.title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, width: 140 }} noWrap>{t.assignee}</Typography>
        <Typography variant="caption" sx={{ width: 56, color: late ? 'error.main' : 'text.secondary', fontWeight: late ? 700 : 400 }}>{fmtShort(t.due_date)}</Typography>
        <Box sx={{ width: 104, textAlign: 'right' }}>{t.approval === 'pending' ? <StatusChip value="pending" label="In review" /> : <StatusChip value={t.status} />}</Box>
      </Stack>
      {open && children}
    </>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { run } = useUi();
  const { data: p, loading, error, reload } = useFetch(`/projects/${id}`);
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState(false);
  const [remove, setRemove] = useState(false);
  const [filter, setFilter] = useState('all');

  const tree = useMemo(() => {
    if (!p) return [];
    const kids = new Map();
    for (const t of p.tasks) kids.set(t.parent_id ?? 0, [...(kids.get(t.parent_id ?? 0) || []), t]);
    const visible = (t) => filter === 'all' || (filter === 'open' ? t.status !== 'done' : t.status === filter) || (kids.get(t.id) || []).some(visible);
    const build = (pid, depth) => (kids.get(pid) || []).filter(visible).map((t) => <TaskRow key={t.id} t={t} depth={depth} nav={nav}>{build(t.id, depth + 1)}</TaskRow>);
    return build(0, 0);
  }, [p, filter, nav]);

  if (loading && !p) return <Loading rows={8} />;
  if (error) return <ErrorAlert error={error} onRetry={reload} />;
  if (!p) return null;
  const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
  const daysLeft = p.end_date ? dayjs(p.end_date).diff(dayjs(), 'day') : null;

  return (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3, justifyContent: 'space-between' }}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <StatusChip value={p.status} />
            <StatusChip value={p.priority} label={`${labelize(p.priority)} priority`} />
            {p.category && <Chip size="small" variant="outlined" label={p.category} sx={{ height: 24 }} />}
          </Stack>
          <Typography variant="h5" component="h1">{p.name}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>Owned by {p.owner || '—'}</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          {p.can_edit && <Button variant="outlined" startIcon={<EditRounded />} onClick={() => setEdit(true)}>Edit</Button>}
          {p.can_edit && <Button color="error" startIcon={<DeleteOutlineRounded />} onClick={() => setRemove(true)}>Delete</Button>}
        </Stack>
      </Stack>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <Card><CardContent>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{p.description || <i>No description.</i>}</Typography>
              {p.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{p.note}</Typography>}
            </CardContent></Card>
            <Card>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ p: 2, pb: 1, justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                <Typography variant="subtitle1">Tasks</Typography>
                <Stack direction="row" spacing={1}>
                  <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
                    <ToggleButton value="all">All</ToggleButton><ToggleButton value="open">Open</ToggleButton><ToggleButton value="done">Done</ToggleButton>
                  </ToggleButtonGroup>
                  <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setAdd(true)}>Add task</Button>
                </Stack>
              </Stack>
              <Divider />
              <Box sx={{ p: 1 }}>{tree.length ? tree : <EmptyState title="No tasks yet" hint="Break the project down into tasks to track progress." />}</Box>
            </Card>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            <Card><CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1">Progress</Typography>
                <Typography sx={{ fontWeight: 800 }}>{pct}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={pct} sx={{ height: 10, borderRadius: 5, mb: 2 }} />
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Box><Typography variant="caption" color="text.secondary">Start</Typography><Typography sx={{ fontWeight: 600 }}>{fmtDate(p.start_date)}</Typography></Box>
                <Box sx={{ textAlign: 'right' }}><Typography variant="caption" color="text.secondary">End</Typography><Typography sx={{ fontWeight: 600 }}>{fmtDate(p.end_date)}</Typography></Box>
              </Stack>
              {daysLeft != null && !['completed', 'cancelled'].includes(p.status) && (
                <Typography variant="body2" sx={{ mt: 1.5, color: daysLeft < 0 ? 'error.main' : 'text.secondary' }}>
                  {daysLeft < 0 ? `${-daysLeft} days past the end date` : `${daysLeft} days left`}
                </Typography>
              )}
            </CardContent></Card>
            <Card><CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1.5 }}>People</Typography>
              <Typography variant="caption" color="text.secondary">Members</Typography>
              <Stack spacing={1} sx={{ mt: 1, mb: 2 }}>
                {p.members.length === 0 && <Typography variant="body2" color="text.secondary">No members yet.</Typography>}
                {p.members.map((m) => (
                  <Stack key={m.id} direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                    <EmpAvatar id={m.id} name={m.full_name} hasAvatar={m.has_avatar} size={28} />
                    <Typography variant="body2">{m.full_name}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">Reporters</Typography>
              <AvatarGroup max={6} sx={{ justifyContent: 'flex-end', mt: 1, mb: 2 }}>
                {p.reporters.map((m) => <Tooltip key={m.id} title={m.full_name}><span><EmpAvatar id={m.id} name={m.full_name} hasAvatar={m.has_avatar} size={30} /></span></Tooltip>)}
              </AvatarGroup>
              {p.teams.length > 0 && (<>
                <Typography variant="caption" color="text.secondary">Teams</Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 1 }}>{p.teams.map((t) => <Chip key={t.id} size="small" label={t.name} />)}</Stack>
              </>)}
            </CardContent></Card>
            {p.kpis.length > 0 && (
              <Card><CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Success measures</Typography>
                <Stack spacing={1}>{p.kpis.map((k) => <Stack key={k.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}><FlagRounded fontSize="small" color="secondary" /><Typography variant="body2">{k.name}</Typography></Stack>)}</Stack>
              </CardContent></Card>
            )}
          </Stack>
        </Grid>
      </Grid>

      <ProjectForm open={edit} initial={p} onClose={() => setEdit(false)} onSaved={reload} />
      <TaskForm open={add} fixed={{ project_id: p.id }} onClose={() => setAdd(false)} onSaved={reload} />
      <ConfirmDialog open={remove} title="Delete this project?" message={`All ${p.task_count} task(s) in it will be deleted too. This cannot be undone.`} confirmLabel="Delete project" danger
        onClose={() => setRemove(false)} onConfirm={async () => { const ok = await run(() => del(`/projects/${p.id}`), 'Project deleted'); if (ok) nav('/projects'); return Boolean(ok); }} />
    </>
  );
}
