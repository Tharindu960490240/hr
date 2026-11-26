import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import { AddRounded, DeleteOutlineRounded } from '@mui/icons-material';
import { useUi } from '../../context/UiContext';
import { useFetch } from '../../lib/useFetch';
import { put } from '../../lib/api';
import { PageHeader, ErrorAlert, Loading, EmptyState } from '../../components/ui';

function TypeCard({ jt, onSaved }) {
  const { run } = useUi();
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setRows(jt.types.map((t) => ({ name: t.name, days: String(t.days) }))); setDirty(false); }, [jt]);
  const update = (i, k, v) => { setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x))); setDirty(true); };
  const names = rows.map((r) => r.name.trim().toLowerCase());
  const invalid = rows.some((r, i) => !r.name.trim() || r.days === '' || Number(r.days) < 0 || names.indexOf(names[i]) !== i);
  const total = rows.reduce((s, r) => s + (Number(r.days) || 0), 0);
  const save = async () => {
    const ok = await run(() => put(`/leave-types/${jt.job_type_id}`, { types: rows.map((r) => ({ name: r.name.trim(), days: Number(r.days) })) }), `Saved ${jt.job_type} leave`);
    if (ok) onSaved();
  };
  return (
    <Card sx={{ height: '100%' }}><CardContent>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="h6">{jt.job_type}</Typography>
        <Typography variant="body2" color="text.secondary">{total} days / year</Typography>
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1.5}>
        {rows.map((r, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField label="Leave type" value={r.name} onChange={(e) => update(i, 'name', e.target.value)} error={!r.name.trim() || names.indexOf(names[i]) !== i} />
            <TextField label="Days" type="number" value={r.days} onChange={(e) => update(i, 'days', e.target.value)} sx={{ width: 110, flex: 'none' }} slotProps={{ htmlInput: { min: 0, step: 0.5 } }} />
            <IconButton onClick={() => { setRows(rows.filter((_, j) => j !== i)); setDirty(true); }} aria-label="Remove"><DeleteOutlineRounded /></IconButton>
          </Stack>
        ))}
        {!rows.length && <Typography variant="body2" color="text.secondary">No leave types — people of this type can only request work from home and lieu leave.</Typography>}
      </Stack>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 2 }}>
        <Button startIcon={<AddRounded />} onClick={() => { setRows([...rows, { name: '', days: '' }]); setDirty(true); }}>Add type</Button>
        <Button variant="contained" disabled={!dirty || invalid} onClick={save}>Save</Button>
      </Stack>
    </CardContent></Card>
  );
}

export default function LeaveEntitlements() {
  const { data, loading, error, reload } = useFetch('/leave-types', []);
  return (
    <>
      <PageHeader title="Leave entitlements" subtitle="Days per calendar year for each employee type. Lieu leave is set per person on their profile." />
      <ErrorAlert error={error} onRetry={reload} />
      {loading && !data.length ? <Loading /> : !data.length ? <Card><EmptyState title="Add an employee type first" /></Card> : (
        <Grid container spacing={2.5}>
          {data.map((jt) => <Grid key={jt.job_type_id} size={{ xs: 12, md: 6 }}><TypeCard jt={jt} onSaved={reload} /></Grid>)}
        </Grid>
      )}
    </>
  );
}
