import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import { PersonAddAlt1Rounded, FileDownloadRounded, SearchRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { download } from '../lib/api';
import DataTable from '../components/DataTable';
import EmpAvatar from '../components/EmpAvatar';
import { PageHeader, ErrorAlert, EmptyState } from '../components/ui';
import { fmtDate } from '../lib/format';

export default function Employees() {
  const nav = useNavigate();
  const { can } = useAuth();
  const { run } = useUi();
  const [q, setQ] = useState('');
  const [deb, setDeb] = useState('');
  const [active, setActive] = useState('true');
  const [dept, setDept] = useState('');
  useEffect(() => { const t = setTimeout(() => setDeb(q), 250); return () => clearTimeout(t); }, [q]);
  const qs = new URLSearchParams({ ...(deb ? { q: deb } : {}), ...(active ? { active } : {}) });
  const { data, loading, error, reload } = useFetch(`/employees?${qs}`, []);
  const depts = [...new Set(data.map((e) => e.department).filter(Boolean))].sort();
  const rows = dept ? data.filter((e) => e.department === dept) : data;

  const columns = [
    { key: 'full_name', label: 'Name', render: (e) => (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <EmpAvatar id={e.id} name={e.full_name} hasAvatar={e.has_avatar} size={36} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{e.full_name}</Typography>
          <Typography variant="caption" color="text.secondary">{e.email}</Typography>
        </Box>
      </Stack>
    ) },
    { key: 'emp_code', label: 'ID', render: (e) => <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{e.emp_code}</Typography> },
    { key: 'designation', label: 'Role', render: (e) => <Box><Typography variant="body2">{e.designation || '—'}</Typography><Typography variant="caption" color="text.secondary">{e.department}</Typography></Box> },
    { key: 'branch', label: 'Branch' },
    { key: 'reporter', label: 'Reports to' },
    { key: 'role', label: 'Access', render: (e) => <Chip size="small" label={e.role} variant={e.role === 'Employee' ? 'outlined' : 'filled'} color={e.role === 'Employee' ? 'default' : 'primary'} sx={{ height: 24 }} /> },
    { key: 'start_date', label: 'Started', render: (e) => fmtDate(e.start_date) },
    { key: 'is_active', label: 'Status', render: (e) => <Chip size="small" label={e.is_active ? 'Active' : 'Inactive'} color={e.is_active ? 'success' : 'default'} variant={e.is_active ? 'filled' : 'outlined'} sx={{ height: 24 }} /> },
  ];

  return (
    <>
      <PageHeader title="Employees" subtitle={`${data.length} ${active === 'false' ? 'former' : active ? 'active' : ''} staff`}
        actions={can('Admin') && (<>
          <Button startIcon={<FileDownloadRounded />} onClick={() => run(() => download('/employees/export.csv', 'employees.csv'))}>Export CSV</Button>
          <Button variant="contained" startIcon={<PersonAddAlt1Rounded />} onClick={() => nav('/employees/new')}>Add employee</Button>
        </>)} />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField placeholder="Search by name, email or ID" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { md: 340 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <TextField select label="Department" value={dept} onChange={(e) => setDept(e.target.value)} sx={{ maxWidth: { md: 220 } }}>
            <MenuItem value="">All departments</MenuItem>
            {depts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </TextField>
          {can('Admin') && (
            <TextField select label="Status" value={active} onChange={(e) => setActive(e.target.value)} sx={{ maxWidth: { md: 180 } }}>
              <MenuItem value="true">Active</MenuItem><MenuItem value="false">Inactive</MenuItem><MenuItem value="">All</MenuItem>
            </TextField>
          )}
        </Stack>
        <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(e) => nav(`/employees/${e.id}`)} initialSort={{ key: 'full_name', dir: 'asc' }}
          empty={<EmptyState title="No one matches" hint="Try a different search." />} />
      </Card>
    </>
  );
}
