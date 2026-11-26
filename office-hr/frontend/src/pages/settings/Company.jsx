import { useEffect, useRef, useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import { AddRounded, EditRounded, DeleteOutlineRounded, BusinessRounded, UploadRounded } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { useFetch } from '../../lib/useFetch';
import { api, post, patch, del, upload } from '../../lib/api';
import DataTable from '../../components/DataTable';
import { PageHeader, ErrorAlert, Loading, FormDialog, ConfirmDialog, EmptyState } from '../../components/ui';

function Logo({ company, v }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!company.has_logo) return;
    let url;
    api(`/companies/${company.id}/logo`, { raw: true }).then((r) => r.blob()).then((b) => { url = URL.createObjectURL(b); setSrc(url); }).catch(() => {});
    return () => url && URL.revokeObjectURL(url);
  }, [company.id, company.has_logo, v]);
  return <Avatar variant="rounded" src={src || undefined} sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}><BusinessRounded /></Avatar>;
}

export default function Company() {
  const { can } = useAuth();
  const { run } = useUi();
  const { data, loading, error, reload } = useFetch('/companies', []);
  const [cForm, setCForm] = useState(null);
  const [bForm, setBForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [v, setV] = useState(0);
  const fileRef = useRef();
  const [logoFor, setLogoFor] = useState(null);

  const saveCompany = async () => {
    if (!cForm.name?.trim()) return false;
    const body = { name: cForm.name, description: cForm.description || '', admin_email: cForm.admin_email || '', admin_contact: cForm.admin_contact || '' };
    const ok = await run(() => (cForm.id ? patch(`/companies/${cForm.id}`, body) : post('/companies', body)), 'Company saved');
    if (ok) reload();
    return Boolean(ok);
  };
  const saveBranch = async () => {
    if (!bForm.name?.trim()) return false;
    const body = { name: bForm.name, contact: bForm.contact || '', address: bForm.address || '', city: bForm.city || '' };
    const ok = await run(() => (bForm.id ? patch(`/companies/branches/${bForm.id}`, body) : post(`/companies/${bForm.company_id}/branches`, body)), 'Branch saved');
    if (ok) reload();
    return Boolean(ok);
  };
  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = await run(() => upload(`/companies/${logoFor}/logo`, file), 'Logo updated');
    if (ok) { setV((x) => x + 1); reload(); }
  };

  return (
    <>
      <PageHeader title="Company & branches" subtitle="Your organisation's details and office locations."
        actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setCForm({ name: '' })}>Add company</Button>} />
      <ErrorAlert error={error} onRetry={reload} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onLogo} />
      {loading && !data.length ? <Loading /> : !data.length ? <Card><EmptyState title="No company yet" /></Card> : (
        <Stack spacing={3}>
          {data.map((c) => (
            <Card key={c.id}>
              <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ alignItems: { md: 'center' } }}>
                  <Box sx={{ position: 'relative' }}>
                    <Logo company={c} v={v} />
                    <Tooltip title="Upload logo"><IconButton size="small" onClick={() => { setLogoFor(c.id); fileRef.current.click(); }}
                      sx={{ position: 'absolute', right: -8, bottom: -8, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}><UploadRounded fontSize="small" /></IconButton></Tooltip>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">{c.name}</Typography>
                    <Typography color="text.secondary">{c.description}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{[c.admin_email, c.admin_contact].filter(Boolean).join(' · ')}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button startIcon={<EditRounded />} onClick={() => setCForm(c)}>Edit</Button>
                    {can('Super Admin') && <Button color="error" onClick={() => setRemove({ type: 'company', item: c })}>Delete</Button>}
                  </Stack>
                </Stack>
              </CardContent>
              <Stack direction="row" sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Branches ({c.branches.length})</Typography>
                <Button size="small" startIcon={<AddRounded />} onClick={() => setBForm({ company_id: c.id, name: '' })}>Add branch</Button>
              </Stack>
              <DataTable dense rows={c.branches} empty={<EmptyState title="No branches" />} columns={[
                { key: 'name', label: 'Branch', render: (b) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.name}</Typography> },
                { key: 'city', label: 'City' },
                { key: 'address', label: 'Address' },
                { key: 'contact', label: 'Phone' },
                { key: 'x', label: '', sort: false, align: 'right', render: (b) => (
                  <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                    <IconButton size="small" aria-label="Edit" onClick={() => setBForm(b)}><EditRounded fontSize="small" /></IconButton>
                    <IconButton size="small" aria-label="Delete" onClick={() => setRemove({ type: 'branch', item: b })}><DeleteOutlineRounded fontSize="small" /></IconButton>
                  </Stack>
                ) },
              ]} />
            </Card>
          ))}
        </Stack>
      )}
      {cForm && (
        <FormDialog open title={cForm.id ? 'Edit company' : 'Add company'} onClose={() => setCForm(null)} onSubmit={saveCompany}>
          <Grid container spacing={2}>
            <Grid size={12}><TextField label="Company name" autoFocus value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} error={!cForm.name?.trim()} /></Grid>
            <Grid size={12}><TextField label="Description" multiline minRows={2} value={cForm.description || ''} onChange={(e) => setCForm({ ...cForm, description: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="HR email" type="email" value={cForm.admin_email || ''} onChange={(e) => setCForm({ ...cForm, admin_email: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="HR phone" value={cForm.admin_contact || ''} onChange={(e) => setCForm({ ...cForm, admin_contact: e.target.value })} /></Grid>
          </Grid>
        </FormDialog>
      )}
      {bForm && (
        <FormDialog open title={bForm.id ? 'Edit branch' : 'Add branch'} onClose={() => setBForm(null)} onSubmit={saveBranch}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Branch name" autoFocus value={bForm.name} onChange={(e) => setBForm({ ...bForm, name: e.target.value })} error={!bForm.name?.trim()} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="City" value={bForm.city || ''} onChange={(e) => setBForm({ ...bForm, city: e.target.value })} /></Grid>
            <Grid size={12}><TextField label="Address" value={bForm.address || ''} onChange={(e) => setBForm({ ...bForm, address: e.target.value })} /></Grid>
            <Grid size={12}><TextField label="Phone" value={bForm.contact || ''} onChange={(e) => setBForm({ ...bForm, contact: e.target.value })} /></Grid>
          </Grid>
        </FormDialog>
      )}
      <ConfirmDialog open={Boolean(remove)} title={`Delete ${remove?.item.name}?`}
        message={remove?.type === 'company' ? 'All its branches are deleted too.' : 'Employees in this branch will have no branch set.'} confirmLabel="Delete" danger onClose={() => setRemove(null)}
        onConfirm={async () => {
          const ok = await run(() => del(remove.type === 'company' ? `/companies/${remove.item.id}` : `/companies/branches/${remove.item.id}`), 'Deleted');
          if (ok) reload();
          return Boolean(ok);
        }} />
    </>
  );
}
