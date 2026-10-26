import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Permission } from '../../../core/auth/permissions';

interface MenuItem {
  label: string;
  icon: string;
  path: string;
  permissions: Permission[]; // the user needs at least one of these to see the link
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private auth = inject(AuthService);

  // The parent tells us if the sidebar is open (used on mobile)
  isOpen = input(false);

  // We tell the parent when a link was clicked, so it can close the sidebar
  linkClicked = output<void>();

  private menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'bi-speedometer2', path: '/dashboard', permissions: ['dashboard.view'] },
    { label: 'Employees', icon: 'bi-people', path: '/employees', permissions: ['employees.view'] },
    { label: 'Departments', icon: 'bi-diagram-3', path: '/departments', permissions: ['departments.view'] },
    { label: 'Attendance', icon: 'bi-clock-history', path: '/attendance', permissions: ['attendance.viewAll', 'attendance.viewOwn'] },
    { label: 'Leave', icon: 'bi-calendar-check', path: '/leave', permissions: ['leave.viewAll', 'leave.viewOwn'] },
    { label: 'Payroll', icon: 'bi-cash-stack', path: '/payroll', permissions: ['payroll.viewAll', 'payroll.viewOwn'] },
    { label: 'Users', icon: 'bi-person-gear', path: '/users', permissions: ['users.manage'] },
    { label: 'My Profile', icon: 'bi-person-badge', path: '/profile', permissions: ['profile.viewOwn'] },
  ];

  // Only the links this user is allowed to open.
  // This is for convenience. The REAL check is the roleGuard on each route.
  visibleItems = computed(() =>
    this.menuItems.filter((item) => this.auth.hasAnyPermission(item.permissions)),
  );
}
