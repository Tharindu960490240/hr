import { useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { AddRounded, EditRounded, DeleteOutlineRounded, RepeatRounded, SendRounded, CheckRounded, ReplayRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post, del } from '../lib/api';
import EmpAvatar from '../components/EmpAvatar';
import { StatusChip, Loading, ErrorAlert, ConfirmDialog, EmptyState } from '../components/ui';
import { TaskForm } from './Tasks';
import { fmtDate, fmtDateTime, fromNow, labelize } from '../lib/format';

function Field({ label, children }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', py: 1, gap: 2 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box sx={{ textAlign: 'right', fontSize: 14, fontWeight: 600 }}>{children ?? '—'}</Box>
    </Stack>
  );
}

const describe = (a) => {
  if (a.action === 'created') return a.changes?.repeated_from ? 'created this (next repeat)' : 'created the task';
  if (a.action === 'status') return `moved it to ${labelize(a.changes.status?.to)}${a.changes.note ? ` — "${a.changes.note}"` : ''}`;
  if (a.action === 'approved') return `approved it${a.changes.note ? ` — "${a.changes.note}"` : ''}`;
  if (a.action === 'rejected') return `asked for changes — "${a.changes.note}"`;
  if (a.action === 'next_created') return `scheduled the next repeat for ${fmtDate(a.changes.due_date)}`;
  if (a.action === 'edited') return `changed ${Object.keys(a.changes).map((k) => labelize(k.replace('_id', ''))).join(', ').toLowerCase()}`;
  return a.action;
};

export default function TaskDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { run } = useUi();
  const { data: t, loading, error, reload } = useFetch(`/tasks/${id}`);
  const [edit, setEdit] = useState(false);
  const [sub, setSub] = useState(false);
  const [doneDlg, setDoneDlg] = useState(false);
  const [review, setReview] = useState(null);
  const [remove, setRemove] = useState(false);
  const [comment, setComment] = useState('');
  const [tab, setTab] = useState('comments');

  if (loading && !t) return <Loading rows={8} />;
  if (error) return <ErrorAlert error={error} onRetry={reload} />;
  if (!t) return null;

  const setStatus = async (status, note) => {
    const r = await run(() => post(`/tasks/${t.id}/status`, { status, ...(note ? { note } : {}) }), (x) => x.message);
    if (r) { reload(); if (r.next_task_id) setTimeout(() => nav(`/tasks/${r.next_task_id}`), 50); }
    return Boolean(r);
  };
  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const ok = await run(() => post(`/tasks/${t.id}/comments`, { body: comment.trim() }));
    if (ok) { setComment(''); reload(); }
  };

  return (
    <>
      <Breadcrumbs sx={{ mb: 1.5 }}>
        {t.project_id ? <Link component={RouterLink} to={`/projects/${t.project_id}`} underline="hover" color="inherit">{t.project}</Link>
          : <Link component={RouterLink} to="/tasks" underline="hover" color="inherit">Tasks</Link>}
        {t.ancestors.map((a) => <Link key={a.id} component={RouterLink} to={`/tasks/${a.id}`} underline="hover" color="inherit">{a.title}</Link>)}
        <Typography color="text.primary" noWrap sx={{ maxWidth: 260 }}>{t.title}</Typography>
      </Breadcrumbs>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3, justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <StatusChip value={t.status} />
            <StatusChip value={t.priority} label={`${labelize(t.priority)} priority`} />
            {t.kind === 'repeating' && <StatusChip value="active" label="Repeating" />}
          </Stack>
          <Typography variant="h5" component="h1">{t.title}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {t.can_edit && <Button startIcon={<EditRounded />} variant="outlined" onClick={() => setEdit(true)}>Edit</Button>}
          {t.can_delete && <Button color="error" startIcon={<DeleteOutlineRounded />} onClick={() => setRemove(true)}>Delete</Button>}
        </Stack>
      </Stack>

      {t.approval === 'pending' && (
        <Alert severity="warning" sx={{ mb: 2 }} action={t.can_review && (
          <Stack direction="row" spacing={1}>
            <Button color="success" variant="contained" size="small" startIcon={<CheckRounded />} onClick={() => setReview('approved')}>Approve</Button>
            <Button color="inherit" size="small" startIcon={<ReplayRounded />} onClick={() => setReview('rejected')}>Request changes</Button>
          </Stack>
        )}>
          {t.can_review ? 'This task is done and waiting for your review.' : `Done — waiting for ${t.reporter || 'a reviewer'} to review.`}
        </Alert>
      )}
      {t.approval === 'rejected' && <Alert severity="error" sx={{ mb: 2 }}>Changes requested: {t.approval_note}</Alert>}
      {t.approval === 'approved' && <Alert severity="success" sx={{ mb: 2 }}>Approved{t.approval_note ? ` — ${t.approval_note}` : ''}.</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <Card><CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Description</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', color: t.description ? 'text.primary' : 'text.secondary' }}>{t.description || 'No description.'}</Typography>
              {t.completion_note && (<><Divider sx={{ my: 2 }} /><Typography variant="subtitle2">Completion note</Typography><Typography color="text.secondary">{t.completion_note}</Typography></>)}
            </CardContent></Card>

            <Card><CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">Sub-tasks {t.subtasks.length > 0 && <Typography component="span" color="text.secondary">({t.subtasks.filter((s) => s.status === 'done').length}/{t.subtasks.length})</Typography>}</Typography>
                {t.depth < 3 && t.can_update_status && <Button size="small" startIcon={<AddRounded />} onClick={() => setSub(true)}>Add sub-task</Button>}
              </Stack>
              {t.subtasks.length === 0 ? <Typography color="text.secondary" variant="body2">No sub-tasks.</Typography> : (
                <Stack divider={<Divider flexItem />}>
                  {t.subtasks.map((s) => (
                    <Stack key={s.id} direction="row" spacing={1.5} onClick={() => nav(`/tasks/${s.id}`)}
                      sx={{ py: 1, pl: (s.depth - t.depth - 1) * 3, alignItems: 'center', cursor: 'pointer', '&:hover .t': { color: 'primary.main' } }}>
                      <StatusChip value={s.status} />
                      <Typography className="t" variant="body2" sx={{ fontWeight: 600, flex: 1 }} noWrap>{s.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.assignee}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent></Card>

            <Card>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Tab value="comments" label={`Comments (${t.comments.length})`} />
                <Tab value="activity" label="History" />
              </Tabs>
              <CardContent>
                {tab === 'comments' ? (
                  <Stack spacing={2}>
                    {t.comments.length === 0 && <EmptyState title="No comments yet" />}
                    {t.comments.map((c) => (
                      <Stack key={c.id} direction="row" spacing={1.5}>
                        <EmpAvatar id={c.author_id} name={c.author} hasAvatar={c.has_avatar} size={32} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.author}</Typography>
                            <Typography variant="caption" color="text.secondary" title={fmtDateTime(c.created_at)}>{fromNow(c.created_at)}</Typography>
                          </Stack>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.body}</Typography>
                        </Box>
                        {c.author_id === user.id && (
                          <IconButton size="small" aria-label="Delete comment" onClick={async () => { if (await run(() => del(`/tasks/${t.id}/comments/${c.id}`))) reload(); }}>
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    ))}
                    <Stack component="form" direction="row" spacing={1} onSubmit={addComment} sx={{ alignItems: 'flex-start' }}>
                      <TextField multiline maxRows={6} placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment(e); }} />
                      <Button type="submit" variant="contained" disabled={!comment.trim()} aria-label="Post comment" sx={{ minWidth: 0, px: 1.5, height: 40 }}><SendRounded fontSize="small" /></Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack spacing={1.25}>
                    {t.activity.map((a) => (
                      <Typography key={a.id} variant="body2"><b>{a.actor || 'Someone'}</b> {describe(a)} <Typography component="span" variant="caption" color="text.secondary">· {fromNow(a.created_at)}</Typography></Typography>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            {t.can_update_status && (
              <Card><CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Progress</Typography>
                <ButtonGroup fullWidth>
                  {['todo', 'in_progress', 'done'].map((s) => (
                    <Button key={s} variant={t.status === s ? 'contained' : 'outlined'} onClick={() => (s === 'done' ? setDoneDlg(true) : setStatus(s))} disabled={t.status === s}>
                      {s === 'todo' ? 'To do' : s === 'in_progress' ? 'In progress' : 'Done'}
                    </Button>
                  ))}
                </ButtonGroup>
              </CardContent></Card>
            )}
            <Card><CardContent>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Details</Typography>
              <Field label="Assignee">{t.assignee && <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}><EmpAvatar id={t.assignee_id} name={t.assignee} size={22} />{t.assignee}</Stack>}</Field>
              <Field label="Reviewer">{t.reporter}</Field>
              <Field label="Due">{t.due_date && fmtDate(t.due_date)}</Field>
              <Field label="Estimate">{t.estimate_hours != null && `${t.estimate_hours} h`}</Field>
              {t.repeat_rule && <Field label="Repeats"><Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}><RepeatRounded fontSize="small" /><span>Every {t.repeat_rule.every > 1 ? `${t.repeat_rule.every} ` : ''}{t.repeat_rule.unit}{t.repeat_rule.every > 1 ? 's' : ''}{t.repeat_rule.until ? ` until ${fmtDate(t.repeat_rule.until)}` : ''}</span></Stack></Field>}
              <Field label="Started">{t.started_at && fmtDate(t.started_at)}</Field>
              <Field label="Completed">{t.completed_at && fmtDate(t.completed_at)}</Field>
              <Divider sx={{ my: 1 }} />
              <Field label="Created by">{t.created_by_name}</Field>
              <Field label="Created">{fmtDate(t.created_at)}</Field>
            </CardContent></Card>
          </Stack>
        </Grid>
      </Grid>

      <TaskForm open={edit} initial={t} onClose={() => setEdit(false)} onSaved={reload} />
      <TaskForm open={sub} fixed={{ parent_id: t.id, project_id: t.project_id }} onClose={() => setSub(false)} onSaved={reload} />
      <ConfirmDialog open={doneDlg} title="Mark as done?" message={t.reporter_id && t.reporter_id !== user.id ? `${t.reporter} will be asked to review it.` : undefined}
        reason reasonLabel="Completion note (optional)" confirmLabel="Mark done" onClose={() => setDoneDlg(false)} onConfirm={(note) => setStatus('done', note)} />
      <ConfirmDialog open={Boolean(review)} title={review === 'approved' ? 'Approve this task?' : 'Request changes?'} reason
        reasonLabel={review === 'approved' ? 'Note (optional)' : 'What needs to change?'} reasonRequired={review === 'rejected'}
        confirmLabel={review === 'approved' ? 'Approve' : 'Send back'} danger={review === 'rejected'} onClose={() => setReview(null)}
        onConfirm={async (note) => { const ok = await run(() => post(`/tasks/${t.id}/review`, { decision: review, ...(note ? { note } : {}) }), (x) => x.message); if (ok) reload(); return Boolean(ok); }} />
      <ConfirmDialog open={remove} title="Delete this task?" message={t.subtasks.length ? `Its ${t.subtasks.length} sub-task(s) will be deleted too.` : 'This cannot be undone.'}
        confirmLabel="Delete" danger onClose={() => setRemove(false)}
        onConfirm={async () => { const ok = await run(() => del(`/tasks/${t.id}`), 'Task deleted'); if (ok) nav(t.project_id ? `/projects/${t.project_id}` : '/tasks'); return Boolean(ok); }} />
    </>
  );
}
