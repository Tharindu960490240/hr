import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import {
  ChecklistRounded, PendingActionsRounded, WarningAmberRounded, TaskAltRounded, AssignmentTurnedInRounded,
  PeopleAltRounded, AccountTreeRounded, FactCheckRounded,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../lib/useFetch';
import { PageHeader, StatCard, StatusChip, Loading, ErrorAlert, EmptyState } from '../components/ui';
import { fmtShort, range, labelize, dayjs } from '../lib/format';

function Section({ title, action, children }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle1">{title}</Typography>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function WeeklyChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.reports + d.on_leave));
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', height: 160 }} role="img" aria-label="Work reports and people on leave per day, last two weeks">
        {data.map((d) => (
          <Stack key={d.day} sx={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }} title={`${fmtShort(d.day)}: ${d.reports} reports, ${d.on_leave} on leave`}>
            <Box sx={{ width: '100%', maxWidth: 26, height: `${(d.on_leave / max) * 100}%`, bgcolor: 'secondary.main', opacity: 0.75, borderRadius: '4px 4px 0 0', mb: '2px' }} />
            <Box sx={{ width: '100%', maxWidth: 26, height: `${(d.reports / max) * 100}%`, bgcolor: 'primary.main', borderRadius: d.on_leave ? 0 : '4px 4px 0 0' }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: 10.5 }}>{dayjs(d.day).format('dd')}</Typography>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}><Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'primary.main' }} /><Typography variant="caption">Work reports</Typography></Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}><Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'secondary.main' }} /><Typography variant="caption">On leave</Typography></Stack>
      </Stack>
    </Box>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: d, loading, error, reload } = useFetch('/dashboard');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading && !d) return <Loading rows={8} />;
  if (error) return <ErrorAlert error={error} onRetry={reload} />;
  const m = d.manager;
  const isWeekday = ![0, 6].includes(new Date().getDay());

  return (
    <>
      <PageHeader title={`${greet}, ${user.full_name.split(' ')[0]}`} subtitle={dayjs().format('dddd, D MMMM YYYY')} />

      {!d.reported_today && isWeekday && (
        <Alert severity="info" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={() => nav('/work-reports?new=1')}>Add report</Button>}>
          You haven't submitted today's work report yet.
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="To do" value={d.tasks.todo} icon={ChecklistRounded} onClick={() => nav('/tasks')} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="In progress" value={d.tasks.in_progress} icon={PendingActionsRounded} tone="info" onClick={() => nav('/tasks')} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Overdue" value={d.tasks.overdue} icon={WarningAmberRounded} tone={d.tasks.overdue ? 'error' : 'success'} onClick={() => nav('/tasks')} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Done (30 days)" value={d.tasks.done_30d} icon={TaskAltRounded} tone="success" /></Grid>
      </Grid>

      {m && (
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 6, md: 3 }}><StatCard label="Pending approvals" value={m.pending_approvals} icon={AssignmentTurnedInRounded} tone={m.pending_approvals ? 'warning' : 'success'} onClick={() => nav('/approvals')} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><StatCard label="Tasks to review" value={d.to_review} icon={FactCheckRounded} tone="info" onClick={() => nav('/tasks/review')} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><StatCard label="Active staff" value={m.people.active} hint={`${m.people.total} total`} icon={PeopleAltRounded} onClick={() => nav('/employees')} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><StatCard label="Active projects" value={m.projects.active} hint={`${m.projects.planned} planned · ${m.projects.completed} done`} icon={AccountTreeRounded} tone="secondary" onClick={() => nav('/projects')} /></Grid>
        </Grid>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Section title="Due soon" action={<Button size="small" onClick={() => nav('/tasks')}>All my tasks</Button>}>
            {d.due_soon.length === 0 ? <EmptyState title="No upcoming deadlines" /> : (
              <Stack divider={<Divider flexItem />}>
                {d.due_soon.map((t) => {
                  const overdue = dayjs(t.due_date).isBefore(dayjs(), 'day');
                  return (
                    <Stack key={t.id} direction="row" spacing={2} onClick={() => nav(`/tasks/${t.id}`)} sx={{ py: 1.25, alignItems: 'center', cursor: 'pointer', '&:hover .t': { color: 'primary.main' } }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography className="t" sx={{ fontWeight: 600 }} noWrap>{t.title}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{t.project || 'Personal task'}</Typography>
                      </Box>
                      <StatusChip value={t.priority} />
                      <Typography variant="body2" sx={{ width: 70, textAlign: 'right', color: overdue ? 'error.main' : 'text.secondary', fontWeight: overdue ? 700 : 400 }}>{fmtShort(t.due_date)}</Typography>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Section title={`Leave balance ${new Date().getFullYear()}`} action={<Button size="small" onClick={() => nav('/requests?new=1')}>Request leave</Button>}>
            {d.leave_balance.length === 0 ? <Typography color="text.secondary">No leave types set up for your employment type yet.</Typography> : (
              <Stack spacing={1.75}>
                {d.leave_balance.filter((b) => b.entitled > 0 || b.used > 0).map((b) => (
                  <Box key={b.name}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.name}</Typography>
                      <Typography variant="body2" color="text.secondary"><b style={{ color: 'var(--text-color)' }}>{b.remaining}</b> of {b.entitled} left{b.pending ? ` · ${b.pending} pending` : ''}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={b.entitled ? Math.min(100, (b.used / b.entitled) * 100) : 0} sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                ))}
              </Stack>
            )}
          </Section>
        </Grid>

        {m && (
          <>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Section title="Last two weeks">
                <WeeklyChart data={m.weekly} />
              </Section>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Section title="Out of office today" action={<Button size="small" onClick={() => nav('/attendance')}>Attendance</Button>}>
                {m.out_today.length === 0 ? <Typography color="text.secondary">Everyone's in today.</Typography> : (
                  <Stack spacing={1}>
                    {m.out_today.map((o, i) => (
                      <Stack key={i} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{o.full_name}</Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">until {fmtShort(o.end_date)}</Typography>
                          <StatusChip value={o.kind === 'leave' ? 'leave' : 'wfh'} label={o.kind === 'leave' ? o.leave_type : 'WFH'} />
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Section>
            </Grid>
          </>
        )}

        <Grid size={{ xs: 12, md: 6 }}>
          <Section title="My upcoming time off" action={<Button size="small" onClick={() => nav('/requests')}>View all</Button>}>
            {d.my_requests.length === 0 ? <Typography color="text.secondary">Nothing booked.</Typography> : (
              <Stack spacing={1.25}>
                {d.my_requests.map((r) => (
                  <Stack key={r.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.kind === 'leave' ? r.leave_type : 'Work from home'}</Typography>
                      <Typography variant="caption" color="text.secondary">{range(r.start_date, r.end_date)}</Typography>
                    </Box>
                    <StatusChip value={r.status} />
                  </Stack>
                ))}
              </Stack>
            )}
          </Section>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title="Upcoming holidays" action={<Button size="small" onClick={() => nav('/holidays')}>Calendar</Button>}>
            {d.holidays.length === 0 ? <Typography color="text.secondary">No holidays coming up.</Typography> : (
              <Stack spacing={1.25}>
                {d.holidays.map((h) => (
                  <Stack key={h.holiday_date + h.reason} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 48, textAlign: 'center', borderRadius: 2, bgcolor: 'action.hover', py: 0.5 }}>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: 'secondary.main', lineHeight: 1.2 }}>{dayjs(h.holiday_date).format('MMM').toUpperCase()}</Typography>
                      <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{dayjs(h.holiday_date).format('D')}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{h.reason}</Typography>
                      <Typography variant="caption" color="text.secondary">{labelize(dayjs(h.holiday_date).format('dddd'))}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}
          </Section>
        </Grid>
      </Grid>
    </>
  );
}
