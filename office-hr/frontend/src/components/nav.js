import {
  DashboardRounded, ChecklistRounded, EditNoteRounded, EventAvailableRounded, GroupsRounded,
  CelebrationRounded, AccountTreeRounded, FactCheckRounded, ListAltRounded, CategoryRounded,
  BadgeRounded, AssignmentTurnedInRounded, HowToRegRounded, SummarizeRounded, Diversity3Rounded,
  BusinessRounded, ApartmentRounded, WorkOutlineRounded, ContactPageRounded, BeachAccessRounded,
} from '@mui/icons-material';

/** Sidebar structure. `role` = minimum role needed to see the item / section. */
export const NAV = [
  { items: [{ to: '/', label: 'Dashboard', icon: DashboardRounded, end: true }] },
  {
    id: 'work', title: 'My work',
    items: [
      { to: '/tasks', label: 'My tasks', icon: ChecklistRounded, end: true },
      { to: '/work-reports', label: 'Daily work report', icon: EditNoteRounded, end: true },
      { to: '/requests', label: 'Leave & work from home', icon: EventAvailableRounded },
      { to: '/teams/mine', label: 'My teams', icon: GroupsRounded },
      { to: '/holidays', label: 'Company holidays', icon: CelebrationRounded },
    ],
  },
  {
    id: 'projects', title: 'Projects',
    items: [
      { to: '/projects', label: 'Projects', icon: AccountTreeRounded },
      { to: '/tasks/review', label: 'Tasks to review', icon: FactCheckRounded, badge: 'review' },
      { to: '/tasks/all', label: 'All tasks', icon: ListAltRounded, role: 'Manager' },
      { to: '/settings/categories', label: 'Project categories', icon: CategoryRounded, role: 'Admin' },
    ],
  },
  {
    id: 'people', title: 'People and records', role: 'Manager',
    items: [
      { to: '/employees', label: 'Employees', icon: BadgeRounded },
      { to: '/approvals', label: 'Approvals', icon: AssignmentTurnedInRounded, badge: 'approvals' },
      { to: '/attendance', label: 'Attendance', icon: HowToRegRounded },
      { to: '/work-reports/all', label: 'Work reports', icon: SummarizeRounded },
      { to: '/teams', label: 'Teams', icon: Diversity3Rounded, end: true },
    ],
  },
  {
    id: 'settings', title: 'Organisation', role: 'Admin',
    items: [
      { to: '/settings/company', label: 'Company & branches', icon: BusinessRounded },
      { to: '/settings/departments', label: 'Departments', icon: ApartmentRounded },
      { to: '/settings/designations', label: 'Designations', icon: WorkOutlineRounded },
      { to: '/settings/job-types', label: 'Employee types', icon: ContactPageRounded },
      { to: '/settings/leave', label: 'Leave entitlements', icon: BeachAccessRounded },
    ],
  },
];
