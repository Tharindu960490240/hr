import { useState } from 'react';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { CheckRounded, CloseRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post } from '../lib/api';
import DataTable from '../components/DataTable';
import EmpAvatar from '../components/EmpAvatar';
import { PageHeader, StatusChip, ErrorAlert, ConfirmDialog, EmptyState } from '../components/ui';
import { range, fmtDate, today } from '../lib/format';

export default function Approvals() {
  const { can } = useAuth();
  const { run } = useUi();
  const [status, setStatus] = useState('pending');
  const [kind, setKind] = useState('');
  const qs = new URLSearchParams({ scope: 'approvals', ...(status ? { status } : {}), ...(kind ? { kind } : {}) });
  const { data, loading, error, reload } = useFetch(`/requests?${qs}`, []);
  const [act, setAct] = useState(null); // { row, action }

  const columns = [
    { key: 'employee', label: 'Employee', render: (r) => (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <EmpAvatar id={r.employee_id} name={r.employee} hasAvatar={r.has_avatar} size={32} />
        <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.employee}</Typography><Typography variant="caption" color="text.secondary">{r.emp_code}</Typography></Box>
      </Stack>
    ) },
    { key: 'kind', label: 'Type', render: (r) => (r.kind === 'leave' ? r.leave_type : 'Work from home'), sort: (r) => r.leave_type || 'wfh' },
    { key: 'start_date', label: 'Dates', render: (r) => range(r.start_date, r.end_date) },
    { key: 'days', label: 'Days', align: 'right' },
    { key: 'reason', label: 'Reason', render: (r) => <Typography variant="body2" sx={{ maxWidth: 240 }} noWrap title={r.reason}>{r.reason}</Typography> },
    { key: 'created_at', label: 'Requested', render: (r) => fmtDate(r.created_at) },
    { key: 'status', label: 'Status', render: (r) => <Tooltip title={r.decision_note || r.cancel_reason || ''}><span><StatusChip value={r.status} /></span></Tooltip> },
    { key: 'actions', label: '', sort: false, align: 'right', render: (r) => (
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        {r.status === 'pending' && (
          <>
            <Button size="small" variant="contained" color="success" startIcon={<CheckRounded />} onClick={() => setAct({ row: r, action: 'approve' })}>Approve</Button>
            <Button size="small" variant="outlined" color="error" startIcon={<CloseRounded />} onClick={() => setAct({ row: r, action: 'reject' })}>Reject</Button>
          </>
        )}
        {r.status === 'approved' && can('Admin') && r.end_date >= today() && (
          <Button size="small" color="inherit" onClick={() => setAct({ row: r, action: 'cancel' })}>Cancel</Button>
        )}
      </Stack>
    ) },
  ];

  const label = act && { approve: 'Approve', reject: 'Reject', cancel: 'Cancel' }[act.action];

  return (
    <>
      <PageHeader title="Approvals" subtitle={can('Admin') ? 'Leave and work-from-home requests from everyone.' : 'Leave and work-from-home requests from people who report to you.'} />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ px: 2, borderBottom: 1, borderColor: 'divider', alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Tabs value={status} onChange={(_, v) => setStatus(v)} variant="scrollable">
            <Tab value="pending" label="Waiting" />
            <Tab value="approved" label="Approved" />
            <Tab value="rejected" label="Rejected" />
            <Tab value="cancelled" label="Cancelled" />
            <Tab value="" label="All" />
          </Tabs>
          <TextField select size="small" label="Type" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ width: 200, my: 1 }}>
            <MenuItem value="">Leave and WFH</MenuItem>
            <MenuItem value="leave">Leave only</MenuItem>
            <MenuItem value="wfh">Work from home only</MenuItem>
          </TextField>
        </Stack>
        <DataTable columns={columns} rows={data} loading={loading} initialSort={{ key: 'start_date', dir: status === 'pending' ? 'asc' : 'desc' }}
          empty={<EmptyState title={status === 'pending' ? 'Nothing waiting for you' : 'No requests'} hint={status === 'pending' ? 'New requests will appear here.' : undefined} />} />
      </Card>

      <ConfirmDialog
        open={Boolean(act)}
        title={act && `${label} ${act.row.employee}'s request?`}
        message={act && `${act.row.kind === 'leave' ? act.row.leave_type : 'Work from home'} · ${range(act.row.start_date, act.row.end_date)} · ${act.row.days} day(s)`}
        reason
        reasonLabel={act?.action === 'approve' ? 'Note (optional)' : 'Reason (sent to the employee)'}
        reasonRequired={act?.action !== 'approve'}
        confirmLabel={label}
        danger={act?.action !== 'approve'}
        onClose={() => setAct(null)}
        onConfirm={async (note) => {
          const { row, action } = act;
          const ok = await run(
            () => (action === 'cancel' ? post(`/requests/${row.id}/cancel`, { reason: note }) : post(`/requests/${row.id}/${action}`, note ? { note } : {})),
            action === 'approve' ? 'Request approved' : action === 'reject' ? 'Request rejected' : 'Request cancelled',
          );
          if (ok) reload();
          return Boolean(ok);
        }}
      />
    </>
  );
}
