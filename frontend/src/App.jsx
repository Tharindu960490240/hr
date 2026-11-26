import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import { Login, ForgotPassword, ResetPassword } from './pages/AuthPages';
import { EmptyState } from './components/ui';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Profile = lazy(() => import('./pages/Profile'));
const Employees = lazy(() => import('./pages/Employees'));
const EmployeeEdit = lazy(() => import('./pages/EmployeeEdit'));
const Requests = lazy(() => import('./pages/Requests'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Attendance = lazy(() => import('./pages/Attendance'));
const WorkReports = lazy(() => import('./pages/WorkReports'));
const AllWorkReports = lazy(() => import('./pages/AllWorkReports'));
const Teams = lazy(() => import('./pages/Teams'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Tasks = lazy(() => import('./pages/Tasks'));
const TaskDetail = lazy(() => import('./pages/TaskDetail'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Holidays = lazy(() => import('./pages/Holidays'));
const Company = lazy(() => import('./pages/settings/Company'));
const Lookup = lazy(() => import('./pages/settings/Lookup'));
const LeaveEntitlements = lazy(() => import('./pages/settings/LeaveEntitlements'));

function RequireAuth({ children, role }) {
  const { user, ready, can } = useAuth();
  const loc = useLocation();
  if (!ready) return <LoadingSpinner open />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  if (role && !can(role)) return <EmptyState title="You don't have access to this page" hint="Ask an administrator if you need it." />;
  return children;
}

const R = ({ role, children }) => <RequireAuth role={role}>{children}</RequireAuth>;

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<R><Layout /></R>}>
            <Route index element={<Dashboard />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="holidays" element={<Holidays />} />
            <Route path="requests" element={<Requests />} />
            <Route path="work-reports" element={<WorkReports />} />
            <Route path="teams/mine" element={<Teams mine />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="tasks" element={<Tasks scope="assigned" />} />
            <Route path="tasks/review" element={<Tasks scope="review" />} />
            <Route path="tasks/all" element={<R role="Manager"><Tasks scope="all" /></R>} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="employees" element={<R role="Manager"><Employees /></R>} />
            <Route path="employees/new" element={<R role="Admin"><EmployeeEdit /></R>} />
            <Route path="employees/:id" element={<R role="Manager"><Profile /></R>} />
            <Route path="employees/:id/edit" element={<R role="Admin"><EmployeeEdit /></R>} />
            <Route path="approvals" element={<R role="Manager"><Approvals /></R>} />
            <Route path="attendance" element={<R role="Manager"><Attendance /></R>} />
            <Route path="work-reports/all" element={<R role="Manager"><AllWorkReports /></R>} />
            <Route path="teams" element={<R role="Manager"><Teams /></R>} />
            <Route path="settings/company" element={<R role="Admin"><Company /></R>} />
            <Route path="settings/departments" element={<R role="Admin"><Lookup kind="departments" /></R>} />
            <Route path="settings/designations" element={<R role="Admin"><Lookup kind="designations" /></R>} />
            <Route path="settings/job-types" element={<R role="Admin"><Lookup kind="job-types" /></R>} />
            <Route path="settings/categories" element={<R role="Admin"><Lookup kind="categories" /></R>} />
            <Route path="settings/leave" element={<R role="Admin"><LeaveEntitlements /></R>} />
            <Route path="*" element={<EmptyState title="Page not found" hint="Check the address or use the menu." />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
