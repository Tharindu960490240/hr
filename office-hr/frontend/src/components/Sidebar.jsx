import { useState } from 'react';
import { NavLink, useMatch, useResolvedPath } from 'react-router-dom';
import Tooltip from '@mui/material/Tooltip';
import { ExpandMoreRounded, ChevronLeftRounded } from '@mui/icons-material';
import { NAV } from './nav';
import { useAuth } from '../context/AuthContext';
import '../styles/sidebar.css';

const loadOpen = () => {
  try { return JSON.parse(localStorage.getItem('sb-sections')) || {}; } catch { return {}; }
};

// className must be a plain string: MUI Tooltip merges classNames and drops NavLink's function form
function NavItem({ item, count, collapsed, onNavigate }) {
  const { pathname } = useResolvedPath(item.to);
  const active = Boolean(useMatch({ path: pathname, end: item.end ?? false }));
  const Icon = item.icon;
  const link = (
    <NavLink to={item.to} end={item.end ?? false} className={`sb-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
      <Icon />
      <span className="sb-item-label">{item.label}</span>
      {count > 0 && <span className="sb-badge">{count > 99 ? '99+' : count}</span>}
    </NavLink>
  );
  return collapsed ? <Tooltip title={item.label} placement="right">{link}</Tooltip> : link;
}

export default function Sidebar({ collapsed = false, onToggleCollapse, onNavigate, badges = {} }) {
  const { can } = useAuth();
  const [closed, setClosed] = useState(loadOpen);

  const toggle = (id) =>
    setClosed((c) => {
      const next = { ...c, [id]: !c[id] };
      try { localStorage.setItem('sb-sections', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  const sections = NAV.filter((s) => !s.role || can(s.role))
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.role || can(i.role)) }))
    .filter((s) => s.items.length);

  return (
    <nav className={`sb${collapsed ? ' collapsed' : ''}`} aria-label="Main navigation">
      <NavLink to="/" className="sb-brand" onClick={onNavigate}>
        <img src="/assets/afc-icon-white.svg" alt="" />
        <span className="sb-brand-text">
          <strong>Office HR</strong>
          <span>People &amp; projects</span>
        </span>
      </NavLink>

      <div className="sb-scroll">
        {sections.map((s, idx) => {
          const open = collapsed || !s.title || !closed[s.id];
          return (
            <div className="sb-section" key={s.id || idx}>
              {s.title && (
                <button type="button" className="sb-section-head" aria-expanded={open} onClick={() => toggle(s.id)}>
                  {s.title}
                  <ExpandMoreRounded className="sb-chevron" />
                </button>
              )}
              {open && s.items.map((item) => (
                <NavItem key={item.to} item={item} count={item.badge ? badges[item.badge] : 0} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          );
        })}
      </div>

      {onToggleCollapse && (
        <div className="sb-footer">
          <button type="button" className="sb-item sb-collapse" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <ChevronLeftRounded />
            <span className="sb-item-label" style={{ textAlign: 'left' }}>Collapse</span>
          </button>
        </div>
      )}
    </nav>
  );
}
