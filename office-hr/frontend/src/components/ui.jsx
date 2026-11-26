import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import { InboxRounded } from '@mui/icons-material';
import { labelize } from '../lib/format';

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" component="h1">{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
        {children}
      </Box>
      {actions && <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>{actions}</Stack>}
    </Stack>
  );
}

const STATUS_COLORS = {
  pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'default',
  todo: 'default', in_progress: 'info', done: 'success',
  planned: 'default', active: 'info', on_hold: 'warning', completed: 'success',
  high: 'error', medium: 'warning', low: 'default',
  present: 'success', wfh: 'info', leave: 'warning', holiday: 'secondary', weekend: 'default', no_report: 'error', wfh_no_report: 'info',
};
const STATUS_LABELS = { todo: 'To do', wfh: 'Work from home', no_report: 'No report', wfh_no_report: 'WFH (no report)', on_hold: 'On hold' };

export function StatusChip({ value, label, size = 'small', variant }) {
  if (!value) return null;
  const color = STATUS_COLORS[value] || 'default';
  return <Chip size={size} color={color} variant={variant || (color === 'default' ? 'outlined' : 'filled')} label={label || STATUS_LABELS[value] || labelize(value)} sx={{ height: 24 }} />;
}

export function EmptyState({ title = 'Nothing here yet', hint, action }) {
  return (
    <Stack sx={{ alignItems: 'center', textAlign: 'center', py: 6, px: 2, color: 'text.secondary' }} spacing={1}>
      <InboxRounded sx={{ fontSize: 44, opacity: 0.4 }} />
      <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{title}</Typography>
      {hint && <Typography variant="body2">{hint}</Typography>}
      {action}
    </Stack>
  );
}

export function Loading({ rows = 5 }) {
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} variant="rounded" height={36} />)}
    </Stack>
  );
}

export function ErrorAlert({ error, onRetry }) {
  if (!error) return null;
  return (
    <Alert severity="error" sx={{ mb: 2 }} action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
      {error.message}
    </Alert>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'primary', hint, onClick }) {
  return (
    <Card sx={{ height: '100%', cursor: onClick ? 'pointer' : 'default', transition: 'transform .15s', '&:hover': onClick ? { transform: 'translateY(-2px)' } : {} }} onClick={onClick}>
      <CardContent sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, alignItems: 'center', p: { xs: 1.75, sm: 2 } }}>
        {Icon && (
          <Box sx={{ width: { xs: 38, sm: 46 }, height: { xs: 38, sm: 46 }, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: `${tone}.main`, color: '#fff', opacity: 0.92, flex: 'none' }}>
            <Icon />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3, fontSize: { xs: 12.5, sm: 14 } }}>{label}</Typography>
          <Typography variant="h5" sx={{ lineHeight: 1.2 }}>{value ?? '—'}</Typography>
          {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
        </Box>
      </CardContent>
    </Card>
  );
}

/** Confirm, optionally asking for a reason. onConfirm(reason) may return a promise. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, reason, reasonLabel = 'Reason', reasonRequired, onClose, onConfirm }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const ok = await onConfirm(text.trim());
      if (ok !== false) { setText(''); onClose(); }
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {message && <Typography color="text.secondary" sx={{ mb: reason ? 2 : 0 }}>{message}</Typography>}
        {reason && <TextField autoFocus multiline minRows={2} label={reasonLabel} value={text} onChange={(e) => setText(e.target.value)} sx={{ mt: 1 }} />}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">Cancel</Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={submit} disabled={busy || (reasonRequired && text.trim().length < 3)}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Dialog wrapping a form; onSubmit returns truthy to close. */
export function FormDialog({ open, title, onClose, onSubmit, submitLabel = 'Save', children, maxWidth = 'sm', disabled }) {
  const [busy, setBusy] = useState(false);
  const handle = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { if (await onSubmit()) onClose(); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth={maxWidth} fullWidth>
      <form onSubmit={handle} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>{children}</DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={busy} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy || disabled}>{submitLabel}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
