export const ROLES = ['Super Admin', 'Admin', 'Manager', 'Employee'];
const rank = { 'Super Admin': 4, Admin: 3, Manager: 2, Employee: 1 };

export const atLeast = (user, role) => (rank[user?.role] || 0) >= rank[role];
export const isAdmin = (user) => atLeast(user, 'Admin');
export const isManager = (user) => atLeast(user, 'Manager');
