import { useState } from 'react';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import { AddRounded, DeleteOutlineRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post, del } from '../lib/api';
import DataTable from '../components/DataTable';
import { PageHeader, ErrorAlert, FormDialog, ConfirmDialog, EmptyState } from '../components/ui';
import { dayjs, today } from '../lib/format';

export default function Holidays() {
  const { can } = useAuth();
  const { run } = useUi();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, loading, error, reload } = useFetch(`/holidays?year=${year}`, []);
  const branches = useFetch(can('Admin') ? '/companies/branches' : null, []);
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [touched, setTouched] = useState(false);
  const admin = can('Admin');

  const columns = [
    { key: 'holiday_date', label: 'Date', render: (h) => (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', opacity: h.holiday_date < today() ? 0.55 : 1 }}>
        <Box sx={{ width: 44, textAlign: 'center', borderRadius: 2, bgcolor: 'action.hover', py: 0.25 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: 'secondary.main', lineHeight: 1.3 }}>{dayjs(h.holiday_date).format('MMM').toUpperCase()}</Typography>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{dayjs(h.holiday_date).format('D')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">{dayjs(h.holiday_date).format('dddd')}</Typography>
      </Stack>
    ) },
    { key: 'reason', label: 'Holiday', render: (h) => <Typography sx={{ fontWeight: 600 }}>{h.reason}</Typography> },
    { key: 'branches', label: 'Applies to', sort: false, render: (h) => (h.branches.length ? (
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>{h.branches.map((b) => <Chip key={b.id} size="small" label={b.name} />)}</Stack>
    ) : <Chip size="small" color="primary" variant="outlined" label="All branches" />) },
    ...(admin ? [{ key: 'x', label: '', sort: false, align: 'right', render: (h) => <IconButton size="small" aria-label="Delete" onClick={() => setRemove(h)}><DeleteOutlineRounded fontSize="small" /></IconButton> }] : []),
  ];

  return (
    <>
      <PageHeader title="Company holidays" subtitle="Days the office is closed. They don't count against your leave."
        actions={<>
          <TextField select value={year} onChange={(e) => setYear(e.target.value)} sx={{ width: 110 }} slotProps={{ htmlInput: { 'aria-label': 'Year' } }}>
            {[-1, 0, 1].map((d) => { const y = new Date().getFullYear() + d; return <MenuItem key={y} value={y}>{y}</MenuItem>; })}
          </TextField>
          {admin && <Button variant="contained" startIcon={<AddRounded />} onClick={() => { setTouched(false); setForm({ holiday_date: '', reason: '', branch_ids: [] }); }}>Add holiday</Button>}
        </>} />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        <DataTable columns={columns} rows={data} loading={loading} initialSort={{ key: 'holiday_date', dir: 'asc' }} pageSize={50} empty={<EmptyState title={`No holidays in ${year}`} />} />
      </Card>
      {form && (
        <FormDialog open title="Add company holiday" onClose={() => setForm(null)}
          onSubmit={async () => {
            setTouched(true);
            if (!form.holiday_date || !form.reason.trim()) return false;
            const ok = await run(() => post('/holidays', form), 'Holiday added — staff have been notified');
            if (ok) reload();
            return Boolean(ok);
          }}>
          <Stack spacing={2.25}>
            <TextField type="date" label="Date" value={form.holiday_date} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} error={touched && !form.holiday_date} />
            <TextField label="Name / reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={touched && !form.reason.trim()} />
            <Autocomplete multiple options={branches.data} getOptionLabel={(b) => b.name} value={branches.data.filter((b) => form.branch_ids.includes(b.id))}
              onChange={(_, v) => setForm({ ...form, branch_ids: v.map((b) => b.id) })} isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(p) => <TextField {...p} label="Branches" helperText="Leave empty for all branches" />} />
          </Stack>
        </FormDialog>
      )}
      <ConfirmDialog open={Boolean(remove)} title={`Remove ${remove?.reason}?`} confirmLabel="Remove" danger onClose={() => setRemove(null)}
        onConfirm={async () => { const ok = await run(() => del(`/holidays/${remove.id}`), 'Holiday removed'); if (ok) reload(); return Boolean(ok); }} />
    </>
  );
}
