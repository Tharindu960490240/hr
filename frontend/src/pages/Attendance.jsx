import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { ChevronLeftRounded, ChevronRightRounded } from '@mui/icons-material';
import { useFetch } from '../lib/useFetch';
import DataTable from '../components/DataTable';
import EmpAvatar from '../components/EmpAvatar';
import { PageHeader, StatusChip, ErrorAlert } from '../components/ui';
import { fmtTime, today, dayjs } from '../lib/format';

const FILTERS = [
  ['', 'Everyone'], ['present', 'In office'], ['wfh', 'WFH'], ['leave', 'On leave'], ['no_report', 'No report'], ['holiday', 'Holiday'],
];

export default function Attendance() {
  const nav = useNavigate();
  const [date, setDate] = useState(today());
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useFetch(`/attendance?date=${date}`, { rows: [] });

  const counts = useMemo(() => data.rows.reduce((acc, r) => {
    const k = r.status === 'wfh_no_report' ? 'wfh' : r.status;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {}), [data]);
  const rows = data.rows.filter((r) => (!filter || r.status === filter || (filter === 'wfh' && r.status === 'wfh_no_report'))
    && (!q || r.full_name.toLowerCase().includes(q.toLowerCase())));

  const shift = (n) => setDate(dayjs(date).add(n, 'day').format('YYYY-MM-DD'));

  const columns = [
    { key: 'full_name', label: 'Employee', render: (r) => (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <EmpAvatar id={r.id} name={r.full_name} hasAvatar={r.has_avatar} size={30} />
        <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.full_name}</Typography><Typography variant="caption" color="text.secondary">{r.emp_code}</Typography></Box>
      </Stack>
    ) },
    { key: 'department', label: 'Department' },
    { key: 'branch', label: 'Branch' },
    { key: 'status', label: 'Status', render: (r) => <StatusChip value={r.status} label={r.status === 'leave' ? r.leave_type : undefined} /> },
    { key: 'time_in', label: 'In', render: (r) => fmtTime(r.time_in) },
    { key: 'time_out', label: 'Out', render: (r) => fmtTime(r.time_out) },
  ];

  return (
    <>
      <PageHeader title="Attendance" subtitle="Who was in, working from home or away — based on approved requests and daily work reports." />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2, alignItems: { md: 'center' }, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <IconButton onClick={() => shift(-1)} aria-label="Previous day"><ChevronLeftRounded /></IconButton>
            <TextField type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} sx={{ width: 170 }} slotProps={{ htmlInput: { max: today(), 'aria-label': 'Date' } }} />
            <IconButton onClick={() => shift(1)} disabled={date >= today()} aria-label="Next day"><ChevronRightRounded /></IconButton>
          </Stack>
          <Typography sx={{ fontWeight: 700, minWidth: 150 }}>{dayjs(date).format('dddd, D MMM')}</Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, flex: 1 }}>
            {FILTERS.map(([k, l]) => (
              <Chip key={k} label={`${l}${k ? ` · ${counts[k] || 0}` : ` · ${data.rows.length}`}`} onClick={() => setFilter(k)} color={filter === k ? 'primary' : 'default'} variant={filter === k ? 'filled' : 'outlined'} />
            ))}
          </Stack>
          <TextField placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { md: 200 } }} />
        </Stack>
        <DataTable columns={columns} rows={rows} loading={loading} dense pageSize={50}
          onRowClick={(r) => r.report_id && nav(`/work-reports/all?report=${r.report_id}`)} />
      </Card>
    </>
  );
}
