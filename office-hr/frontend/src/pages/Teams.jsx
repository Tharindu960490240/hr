import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { AddRounded, EditRounded, DeleteOutlineRounded, StarRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post, patch, del } from '../lib/api';
import EmpAvatar from '../components/EmpAvatar';
import PersonPicker from '../components/PersonPicker';
import { PageHeader, ErrorAlert, Loading, EmptyState, FormDialog, ConfirmDialog } from '../components/ui';

function TeamForm({ open, initial, onClose, onSaved }) {
  const { run } = useUi();
  const [f, setF] = useState({ name: '', description: '', leader_id: null, member_ids: [] });
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) { setTouched(false); setF(initial ? { name: initial.name, description: initial.description, leader_id: initial.leader_id, member_ids: initial.members.map((m) => m.id) } : { name: '', description: '', leader_id: null, member_ids: [] }); }
  }, [open, initial]);
  return (
    <FormDialog open={open} onClose={onClose} title={initial ? 'Edit team' : 'New team'}
      onSubmit={async () => {
        setTouched(true);
        if (!f.name.trim()) return false;
        const ok = await run(() => (initial ? patch(`/teams/${initial.id}`, f) : post('/teams', f)), initial ? 'Team saved' : 'Team created');
        if (ok) onSaved();
        return Boolean(ok);
      }}>
      <Stack spacing={2.25}>
        <TextField label="Team name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus error={touched && !f.name.trim()} helperText={touched && !f.name.trim() ? 'Required' : ''} />
        <TextField label="What does the team do?" multiline minRows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <PersonPicker label="Team lead" value={f.leader_id} onChange={(v) => setF({ ...f, leader_id: v })} />
        <PersonPicker multiple label="Members" value={f.member_ids} onChange={(v) => setF({ ...f, member_ids: v })} exclude={f.leader_id ? [f.leader_id] : []} />
      </Stack>
    </FormDialog>
  );
}

export default function Teams({ mine }) {
  const { can } = useAuth();
  const { run } = useUi();
  const { data, loading, error, reload } = useFetch(mine ? '/teams/mine' : '/teams', []);
  const [form, setForm] = useState({ open: false, initial: null });
  const [remove, setRemove] = useState(null);
  const manage = !mine && can('Manager');

  return (
    <>
      <PageHeader title={mine ? 'My teams' : 'Teams'} subtitle={mine ? 'Teams you lead or belong to.' : 'Groups of people who work together on projects.'}
        actions={manage && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ open: true, initial: null })}>New team</Button>} />
      <ErrorAlert error={error} onRetry={reload} />
      {loading && !data.length ? <Loading /> : data.length === 0 ? <Card><EmptyState title={mine ? "You're not in a team yet" : 'No teams yet'} /></Card> : (
        <Grid container spacing={2.5}>
          {data.map((t) => (
            <Grid key={t.id} size={{ xs: 12, md: 6, xl: 4 }}>
              <Card sx={{ height: '100%' }}><CardContent>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h6">{t.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{t.description}</Typography>
                  </Box>
                  {manage && (
                    <Stack direction="row">
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => setForm({ open: true, initial: t })}><EditRounded fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" onClick={() => setRemove(t)}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                  )}
                </Stack>
                <Divider sx={{ my: 2 }} />
                {t.leader && (
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
                    <EmpAvatar id={t.leader_id} name={t.leader} size={32} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{t.leader}</Typography>
                    <Chip size="small" icon={<StarRounded />} label="Lead" color="secondary" sx={{ height: 22 }} />
                  </Stack>
                )}
                <Stack spacing={1}>
                  {t.members.map((m) => (
                    <Stack key={m.id} direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                      <EmpAvatar id={m.id} name={m.full_name} hasAvatar={m.has_avatar} size={28} />
                      <Typography variant="body2">{m.full_name}</Typography>
                    </Stack>
                  ))}
                  {!t.members.length && <Typography variant="body2" color="text.secondary">No members yet.</Typography>}
                </Stack>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      )}
      <TeamForm open={form.open} initial={form.initial} onClose={() => setForm({ open: false, initial: null })} onSaved={reload} />
      <ConfirmDialog open={Boolean(remove)} title={`Delete ${remove?.name}?`} message="Members stay in the system; only the team is removed." confirmLabel="Delete" danger onClose={() => setRemove(null)}
        onConfirm={async () => { const ok = await run(() => del(`/teams/${remove.id}`), 'Team deleted'); if (ok) reload(); return Boolean(ok); }} />
    </>
  );
}
