import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { AttendanceFormComponent } from './features/attendance/attendance-form/attendance-form.component';
import { AttendanceListComponent } from './features/attendance/attendance-list/attendance-list.component';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { DepartmentFormComponent } from './features/departments/department-form/department-form.component';
import { DepartmentListComponent } from './features/departments/department-list/department-list.component';
import { EmployeeDetailComponent } from './features/employees/employee-detail/employee-detail.component';
import { EmployeeFormComponent } from './features/employees/employee-form/employee-form.component';
import { EmployeeListComponent } from './features/employees/employee-list/employee-list.component';
import { LeaveDetailComponent } from './features/leave/leave-detail/leave-detail.component';
import { LeaveFormComponent } from './features/leave/leave-form/leave-form.component';
import { LeaveListComponent } from './features/leave/leave-list/leave-list.component';
import { PayrollDetailComponent } from './features/payroll/payroll-detail/payroll-detail.component';
import { PayrollFormComponent } from './features/payroll/payroll-form/payroll-form.component';
import { PayrollListComponent } from './features/payroll/payroll-list/payroll-list.component';
import { ProfileComponent } from './features/profile/profile.component';
import { UnauthorizedComponent } from './features/unauthorized/unauthorized.component';
import { UserFormComponent } from './features/users/user-form/user-form.component';
import { UserListComponent } from './features/users/user-list/user-list.component';
import { MainLayoutComponent } from './shared/layout/main-layout/main-layout.component';

export const routes: Routes = [
  // Login page: only for people who are NOT logged in
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },

  // Everything inside the layout needs a logged-in user
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [roleGuard],
        data: { permissions: ['dashboard.view'] },
      },

      // ----- Employees -----
      {
        path: 'employees',
        component: EmployeeListComponent,
        canActivate: [roleGuard],
        data: { permissions: ['employees.view'] },
      },
      {
        path: 'employees/new', // must come BEFORE employees/:id
        component: EmployeeFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['employees.add'] },
      },
      {
        path: 'employees/:id/edit',
        component: EmployeeFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['employees.edit'] },
      },
      {
        path: 'employees/:id',
        component: EmployeeDetailComponent,
        canActivate: [roleGuard],
        data: { permissions: ['employees.view'] },
      },

      // ----- Departments -----
      {
        path: 'departments',
        component: DepartmentListComponent,
        canActivate: [roleGuard],
        data: { permissions: ['departments.view'] },
      },
      {
        path: 'departments/new', // must come BEFORE departments/:id/edit
        component: DepartmentFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['departments.manage'] },
      },
      {
        path: 'departments/:id/edit',
        component: DepartmentFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['departments.manage'] },
      },

      // ----- Attendance -----
      {
        path: 'attendance',
        component: AttendanceListComponent,
        canActivate: [roleGuard],
        data: { permissions: ['attendance.viewAll', 'attendance.viewOwn'] },
      },
      {
        path: 'attendance/new', // must come BEFORE attendance/:id/edit
        component: AttendanceFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['attendance.manage'] },
      },
      {
        path: 'attendance/:id/edit',
        component: AttendanceFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['attendance.manage'] },
      },

      // ----- Leave -----
      {
        path: 'leave',
        component: LeaveListComponent,
        canActivate: [roleGuard],
        data: { permissions: ['leave.viewAll', 'leave.viewOwn'] },
      },
      {
        path: 'leave/new', // must come BEFORE leave/:id
        component: LeaveFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['leave.apply'] },
      },
      {
        path: 'leave/:id',
        component: LeaveDetailComponent,
        canActivate: [roleGuard],
        data: { permissions: ['leave.viewAll', 'leave.viewOwn'] },
      },

      // ----- Payroll -----
      {
        path: 'payroll',
        component: PayrollListComponent,
        canActivate: [roleGuard],
        data: { permissions: ['payroll.viewAll', 'payroll.viewOwn'] },
      },
      {
        path: 'payroll/new', // must come BEFORE payroll/:id
        component: PayrollFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['payroll.manage'] },
      },
      {
        path: 'payroll/:id/edit',
        component: PayrollFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['payroll.manage'] },
      },
      {
        path: 'payroll/:id',
        component: PayrollDetailComponent,
        canActivate: [roleGuard],
        data: { permissions: ['payroll.viewAll', 'payroll.viewOwn'] },
      },

      // ----- Users (Admin only) -----
      {
        path: 'users',
        component: UserListComponent,
        canActivate: [roleGuard],
        data: { permissions: ['users.manage'] },
      },
      {
        path: 'users/new', // must come BEFORE users/:id/edit
        component: UserFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['users.manage'] },
      },
      {
        path: 'users/:id/edit',
        component: UserFormComponent,
        canActivate: [roleGuard],
        data: { permissions: ['users.manage'] },
      },

      // ----- Profile -----
      {
        path: 'profile', // my own profile
        component: ProfileComponent,
        canActivate: [roleGuard],
        data: { permissions: ['profile.viewOwn'] },
      },
      {
        path: 'profile/:id', // any employee's profile (Admin / HR only)
        component: ProfileComponent,
        canActivate: [roleGuard],
        data: { permissions: ['profile.viewAny'] },
      },

      // Anyone logged in may see this page
      { path: 'unauthorized', component: UnauthorizedComponent },
    ],
  },

  // Unknown URL -> dashboard (guards will send you to login if needed)
  { path: '**', redirectTo: 'dashboard' },
];
