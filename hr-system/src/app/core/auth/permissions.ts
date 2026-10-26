import { UserRole } from '../models/user.model';

// Every permission in the app. Names look like "area.action".
export type Permission =
  | 'dashboard.view'
  | 'employees.view'
  | 'employees.add'
  | 'employees.edit'
  | 'employees.delete'
  | 'departments.view'
  | 'departments.manage'
  | 'departments.delete'
  | 'attendance.viewAll'
  | 'attendance.viewOwn'
  | 'attendance.manage'
  | 'attendance.markOwn'
  | 'attendance.delete'
  | 'leave.viewAll'
  | 'leave.viewOwn'
  | 'leave.apply'
  | 'leave.approve'
  | 'payroll.viewAll'
  | 'payroll.viewOwn'
  | 'payroll.manage'
  | 'payroll.delete'
  | 'profile.viewOwn'
  | 'profile.viewAny'
  | 'users.manage';

// Which permissions does each role have? Change this ONE file to change the rules.
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Admin: [
    'dashboard.view',
    'employees.view', 'employees.add', 'employees.edit', 'employees.delete',
    'departments.view', 'departments.manage', 'departments.delete',
    'attendance.viewAll', 'attendance.manage', 'attendance.delete', 'attendance.markOwn',
    'leave.viewAll', 'leave.apply', 'leave.approve',
    'payroll.viewAll', 'payroll.manage', 'payroll.delete',
    'profile.viewOwn', 'profile.viewAny',
    'users.manage', // only Admin can create and manage user accounts
  ],

  // HR does NOT get everything: no employee delete, no department delete,
  // no attendance delete, and payroll is read-only.
  HR: [
    'dashboard.view',
    'employees.view', 'employees.add', 'employees.edit',
    'departments.view', 'departments.manage',
    'attendance.viewAll', 'attendance.manage', 'attendance.markOwn',
    'leave.viewAll', 'leave.apply', 'leave.approve',
    'payroll.viewAll', // remove this line to hide payroll from HR completely
    'profile.viewOwn', 'profile.viewAny',
  ],

  // Employees only see their OWN data ("...Own" permissions).
  Employee: [
    'dashboard.view',
    'attendance.viewOwn', 'attendance.markOwn',
    'leave.viewOwn', 'leave.apply',
    'payroll.viewOwn',
    'profile.viewOwn',
  ],
};
