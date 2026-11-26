import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import { CircleRounded, CloseRounded, DoneAllRounded } from '@mui/icons-material';
import { useUi } from '../context/UiContext';
import { useFetch } from '../lib/useFetch';
import { post, del } from '../lib/api';
import { PageHeader, ErrorAlert, Loading, EmptyState } from '../components/ui';
import { fmtDateTime, fromNow } from '../lib/format';

export default function Notifications() {
  const nav = useNavigate();
  const { run } = useUi();
  const { data, loading, error, reload } = useFetch('/notifications', { unread: 0, items: [] });
  const open = (n) => {
    if (!n.read_at) post(`/notifications/${n.id}/read`).then(reload);
    if (n.link) nav(n.link);
  };
  return (
    <>
      <PageHeader title="Notifications" subtitle={`${data.unread} unread`}
        actions={data.unread > 0 && <Button startIcon={<DoneAllRounded />} onClick={() => run(() => post('/notifications/read-all')).then(reload)}>Mark all as read</Button>} />
      <ErrorAlert error={error} onRetry={reload} />
      <Card>
        {loading && !data.items.length ? <Loading /> : data.items.length === 0 ? <EmptyState title="No notifications" /> : (
          <Stack divider={<Divider />}>
            {data.items.map((n) => (
              <Stack key={n.id} direction="row" spacing={2} sx={{ px: 2.5, py: 1.75, alignItems: 'center', cursor: n.link ? 'pointer' : 'default', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => open(n)}>
                <CircleRounded sx={{ fontSize: 10, color: n.read_at ? 'transparent' : 'secondary.main' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: n.read_at ? 500 : 700 }}>{n.title}</Typography>
                  {n.body && <Typography variant="body2" color="text.secondary">{n.body}</Typography>}
                </Box>
                <Typography variant="caption" color="text.secondary" title={fmtDateTime(n.created_at)} sx={{ whiteSpace: 'nowrap' }}>{fromNow(n.created_at)}</Typography>
                <IconButton size="small" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); del(`/notifications/${n.id}`).then(reload); }}><CloseRounded fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>
    </>
  );
}
