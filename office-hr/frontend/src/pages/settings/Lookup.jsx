import { useState } from 'react';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AddRounded, EditRounded, DeleteOutlineRounded } from '@mui/icons-material';
import { useUi } from '../../context/UiContext';
import { useFetch } from '../../lib/useFetch';
import { post, patch, del } from '../../lib/api';
import DataTable from '../../components/DataTable';
import { PageHeader, ErrorAlert, FormDialog, ConfirmDialog, EmptyState } from '../../components/ui';

const KINDS = {
  departments: { title: 'Departments', one: 'department', sub: 'Groups employees and their designations.' },
  designations: { title: 'Designations', one: 'designation', sub: 'Job titles within each department.' },
  'job-types': { title: 'Employee types', one: 'employee type', sub: 'Employment types (full-time, contract…) — each has its own leave entitlements.' },
  categories: { title: 'Project categories', one: 'category', sub: 'Used to group projects.' },
};

export default function Lookup({ kind }) {
  const cfg = KINDS[kind];
  const { run } = useUi();
  const { data, loading, error, reload } = useFetch(`/${kind}`, []);
  const depts = useFetch(kind === 'designations' ? '/departments' : null, []);
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [touched, setTouched] = useState(false);
  const [dept, setDept] = useState('');
  const rows = dept ? data.filter((r) => r.department_id === dept) : data;

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <Typography sx={{ fontWeight: 600 }}>{r.name}</Typography> },
    ...(kind === 'designations' ? [{ key: 'department', label: 'Department' }] : []),
    { key: 'description', label: 'Description', render: (r) => <Typography variant="body2" color="text.secondary">{r.description || '—'}</Typography> },
    { key: 'x', label: '', sort: false, align: 'right', render: (r) => (
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Tooltip title="Edit"><IconButton size="small" onClick={() => { setTouched(false); setForm(r); }}><EditRounded fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Delete"><IconButton size="small" onClick={() => setRemove(r)}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>
      </Stack>
    ) },
  ];

  const save = async () => {
    setTouched(true);
    if (!form.name?.trim() || (kind === 'designations' && !form.department_id)) return false;
    const body = { name: form.name, description: form.description || '', ...(kind === 'designations' ? { department_id: form.department_id } : {}) };
    const ok = await run(() => (form.id ? patch(`/${kind}/${form.id}`, body) : post(`/${kind}`, body)), form.id ? 'Saved' : `Added ${cfg.one}`);
    if (ok) reload();
    return Boolean(ok);
  };

  return (
    <>
      <PageHeader title={cfg.title} subtitle={cfg.sub}
        actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => { setTouched(false); setForm({ name: '', description: '', department_id: dept || '' }); }}>Add {cfg.one}</Button>} />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        {kind === 'designations' && (
          <Stack sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <TextField select label="Department" value={dept} onChange={(e) => setDept(e.target.value)} sx={{ maxWidth: 280 }}>
              <MenuItem value="">All departments</MenuItem>{depts.data.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
          </Stack>
        )}
        <DataTable columns={columns} rows={rows} loading={loading} pageSize={50} empty={<EmptyState title={`No ${cfg.title.toLowerCase()} yet`} />} />
      </Card>
      {form && (
        <FormDialog open title={form.id ? `Edit ${cfg.one}` : `Add ${cfg.one}`} onClose={() => setForm(null)} onSubmit={save} maxWidth="xs">
          <Stack spacing={2.25}>
            {kind === 'designations' && (
              <TextField select label="Department" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} error={touched && !form.department_id}>
                {depts.data.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            )}
            <TextField label="Name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={touched && !form.name.trim()} helperText={touched && !form.name.trim() ? 'Required' : ''} />
            <TextField label="Description" multiline minRows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Stack>
        </FormDialog>
      )}
      <ConfirmDialog open={Boolean(remove)} title={`Delete ${remove?.name}?`}
        message={kind === 'departments' ? 'Its designations are deleted too, and employees in it are left without a department.' : 'Anything using it will be left blank.'}
        confirmLabel="Delete" danger onClose={() => setRemove(null)}
        onConfirm={async () => { const ok = await run(() => del(`/${kind}/${remove.id}`), 'Deleted'); if (ok) reload(); return Boolean(ok); }} />
    </>
  );
}
