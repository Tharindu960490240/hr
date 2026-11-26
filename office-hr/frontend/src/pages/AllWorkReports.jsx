import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import { useFetch } from '../lib/useFetch';
import DataTable from '../components/DataTable';
import EmpAvatar from '../components/EmpAvatar';
import PersonPicker from '../components/PersonPicker';
import { PageHeader, ErrorAlert } from '../components/ui';
import { ReportView, hours } from './WorkReports';
import { fmtTime, today, dayjs } from '../lib/format';

export default function AllWorkReports() {
  const [params, setParams] = useSearchParams();
  const [emp, setEmp] = useState(null);
  const [from, setFrom] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [to, setTo] = useState(today());
  const qs = new URLSearchParams({ from, to, ...(emp ? { employee_id: emp } : { all: 'true' }) });
  const { data, loading, error, reload } = useFetch(`/work-reports?${qs}`, []);
  const view = params.get('report');

  const columns = [
    { key: 'employee', label: 'Employee', render: (r) => (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <EmpAvatar id={r.employee_id} name={r.employee} hasAvatar={r.has_avatar} size={30} />
        <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.employee}</Typography><Typography variant="caption" color="text.secondary">{r.emp_code}</Typography></Box>
      </Stack>
    ) },
    { key: 'work_date', label: 'Date', render: (r) => dayjs(r.work_date).format('ddd D MMM') },
    { key: 'time_in', label: 'In', render: (r) => fmtTime(r.time_in) },
    { key: 'time_out', label: 'Out', render: (r) => fmtTime(r.time_out) },
    { key: 'hours', label: 'Hours', align: 'right', sort: (r) => hours(r.time_in, r.time_out), render: (r) => hours(r.time_in, r.time_out) },
    { key: 'item_count', label: 'Activities', align: 'right' },
    { key: 'rating', label: 'Day', render: (r) => <Rating value={r.rating} readOnly size="small" /> },
  ];
  const total = data.reduce((s, r) => s + hours(r.time_in, r.time_out), 0);

  return (
    <>
      <PageHeader title="Work reports" subtitle="Daily reports submitted by your staff." />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', alignItems: { md: 'center' } }}>
          <Box sx={{ width: { md: 300 } }}><PersonPicker label="Employee (all)" value={emp} onChange={setEmp} /></Box>
          <TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} sx={{ width: { md: 170 } }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} sx={{ width: { md: 170 } }} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from } }} />
          <Box sx={{ flex: 1 }} />
          <Typography color="text.secondary"><b>{data.length}</b> reports · <b>{Math.round(total)}</b> hours</Typography>
        </Stack>
        <DataTable columns={columns} rows={data} loading={loading} initialSort={{ key: 'work_date', dir: 'desc' }} onRowClick={(r) => setParams({ report: r.id })} />
      </Card>
      <ReportView id={view} onClose={() => setParams({})} />
    </>
  );
}
