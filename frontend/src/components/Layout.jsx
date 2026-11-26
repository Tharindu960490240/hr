import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  MenuRounded, NotificationsNoneRounded, DarkModeRounded, LightModeRounded, PersonRounded,
  LockResetRounded, LogoutRounded, CircleRounded,
} from '@mui/icons-material';
import Sidebar from './Sidebar';
import EmpAvatar from './EmpAvatar';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { get, post } from '../lib/api';
import { fromNow } from '../lib/format';

const WIDE = 300;
const NARROW = 84;

function NotificationsButton() {
  const nav = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const [data, setData] = useState({ unread: 0, items: [] });
  const load = useCallback(() => get('/notifications').then(setData).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);
  const open = async (n) => {
    setAnchor(null);
    if (!n.read_at) post(`/notifications/${n.id}/read`).then(load);
    if (n.link) nav(n.link);
  };
  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e) => { setAnchor(e.currentTarget); load(); }} aria-label={`Notifications, ${data.unread} unread`}>
          <Badge badgeContent={data.unread} color="secondary" max={99}><NotificationsNoneRounded /></Badge>
        </IconButton>
      </Tooltip>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 24px)', borderRadius: 3 } } }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
          <Typography variant="subtitle1">Notifications</Typography>
          {data.unread > 0 && <Button size="small" onClick={() => post('/notifications/read-all').then(load)}>Mark all read</Button>}
        </Stack>
        <Divider />
        <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {data.items.length === 0 && <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>You're all caught up.</Typography>}
          {data.items.slice(0, 15).map((n) => (
            <Box key={n.id} onClick={() => open(n)} sx={{ display: 'flex', gap: 1.5, px: 2, py: 1.25, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
              <CircleRounded sx={{ fontSize: 9, mt: 0.9, color: n.read_at ? 'transparent' : 'secondary.main' }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: n.read_at ? 500 : 700 }}>{n.title}</Typography>
                {n.body && <Typography variant="body2" color="text.secondary" noWrap>{n.body}</Typography>}
                <Typography variant="caption" color="text.secondary">{fromNow(n.created_at)}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <Divider />
        <Button fullWidth onClick={() => { setAnchor(null); nav('/notifications'); }} sx={{ py: 1.2, borderRadius: 0 }}>See all</Button>
      </Popover>
    </>
  );
}

export default function Layout() {
  const { user, logout, can } = useAuth();
  const { mode, toggleMode } = useUi();
  const nav = useNavigate();
  const loc = useLocation();
  const desktop = useMediaQuery('(min-width:1000px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('sb-collapsed') === '1'; } catch { return false; } });
  const [menu, setMenu] = useState(null);
  const [badges, setBadges] = useState({});

  const toggleCollapse = () => setCollapsed((c) => {
    try { localStorage.setItem('sb-collapsed', c ? '0' : '1'); } catch { /* ignore */ }
    return !c;
  });

  // sidebar counters
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await get('/dashboard');
        if (alive) setBadges({ review: d.to_review, approvals: d.manager?.pending_approvals || 0 });
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [loc.pathname]);

  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  const width = desktop ? (collapsed ? NARROW : WIDE) : 0;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {desktop ? (
        <Box component="aside" sx={{ width, flex: 'none', position: 'sticky', top: 0, height: '100vh', transition: 'width .2s ease', zIndex: 2 }}>
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} badges={badges} />
        </Box>
      ) : (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} slotProps={{ paper: { sx: { width: WIDE, border: 0 } } }}>
          <Sidebar onNavigate={() => setMobileOpen(false)} badges={badges} />
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box component="header" sx={{
          position: 'sticky', top: 0, zIndex: 1, height: 64, px: { xs: 1.5, sm: 3 }, display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', backdropFilter: 'blur(8px)',
        }}>
          {!desktop && <IconButton onClick={() => setMobileOpen(true)} aria-label="Open menu"><MenuRounded /></IconButton>}
          <Box sx={{ flex: 1 }} />
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton onClick={toggleMode} aria-label="Toggle theme">{mode === 'dark' ? <LightModeRounded /> : <DarkModeRounded />}</IconButton>
          </Tooltip>
          <NotificationsButton />
          <Box component="button" onClick={(e) => setMenu(e.currentTarget)} aria-label="Account menu"
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, ml: 0.5, p: 0.5, pr: { sm: 1.5 }, border: 0, borderRadius: 10, bgcolor: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}>
            <EmpAvatar id={user.id} name={user.full_name} hasAvatar={user.has_avatar} size={34} />
            <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{user.full_name}</Typography>
              <Typography variant="caption" color="text.secondary">{user.role}</Typography>
            </Box>
          </Box>
          <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} onClick={() => setMenu(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <MenuItem onClick={() => nav('/profile')}><ListItemIcon><PersonRounded fontSize="small" /></ListItemIcon>My profile</MenuItem>
            <MenuItem onClick={() => nav('/change-password')}><ListItemIcon><LockResetRounded fontSize="small" /></ListItemIcon>Change password</MenuItem>
            <Divider />
            <MenuItem onClick={() => { logout(); nav('/login'); }}><ListItemIcon><LogoutRounded fontSize="small" /></ListItemIcon>Sign out</MenuItem>
          </Menu>
        </Box>
        <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 3, lg: 4 }, maxWidth: 1500, width: '100%', mx: 'auto' }}>
          <Outlet context={{ can }} />
        </Box>
      </Box>
    </Box>
  );
}
