import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, switchMap, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Employee } from '../../../core/models/employee.model';
import { User, UserRole } from '../../../core/models/user.model';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UserService } from '../../../core/services/user.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

// A user plus the employee details we show in the table
interface UserRow extends User {
  employeeName: string;
  employeeCode: string;
}

@Component({
  selector: 'app-user-list',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);
  private employeeService = inject(EmployeeService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  // ----- Data -----
  users = signal<User[]>([]);
  employees = signal<Employee[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  // ----- Filters -----
  searchText = signal('');
  roleFilter = signal<UserRole | ''>(''); // '' = all roles
  roles: UserRole[] = ['Admin', 'HR', 'Employee'];

  // ----- Delete dialog -----
  userToDelete = signal<UserRow | null>(null);
  deleting = signal(false);

  private ownUserId = this.auth.currentUser()?.id ?? 0;

  // ----- Computed values -----
  private rows = computed<UserRow[]>(() => {
    const employees = new Map(this.employees().map((e) => [e.id, e] as const));

    return this.users().map((u) => {
      const employee = employees.get(u.employeeId);
      return {
        ...u,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown employee',
        employeeCode: employee?.employeeCode ?? '-',
      };
    });
  });

  filteredRows = computed(() => {
    const text = this.searchText().trim().toLowerCase();
    const role = this.roleFilter();

    return this.rows().filter((r) => {
      const matchesText =
        text === '' ||
        r.email.toLowerCase().includes(text) ||
        r.employeeName.toLowerCase().includes(text) ||
        r.employeeCode.toLowerCase().includes(text);
      const matchesRole = role === '' || r.role === role;
      return matchesText && matchesRole;
    });
  });

  adminCount = computed(() => this.users().filter((u) => u.role === 'Admin').length);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      users: this.userService.getAll(),
      employees: this.employeeService.getAll(),
    }).subscribe({
      next: ({ users, employees }) => {
        this.users.set(users);
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load users. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  // ----- Filter events -----
  onSearch(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  onRoleChange(event: Event): void {
    this.roleFilter.set((event.target as HTMLSelectElement).value as UserRole | '');
  }

  clearFilters(): void {
    this.searchText.set('');
    this.roleFilter.set('');
  }

  // ----- Delete rules (shown in the UI; checked again on the server data before deleting) -----
  isSelf(row: UserRow): boolean {
    return row.id === this.ownUserId;
  }

  // Returns the reason why this user cannot be deleted, or '' when deleting is allowed
  deleteBlockedReason(row: UserRow): string {
    if (this.isSelf(row)) {
      return 'You cannot delete your own account';
    }
    if (row.role === 'Admin' && this.adminCount() <= 1) {
      return 'At least one Admin must remain';
    }
    return '';
  }

  askDelete(row: UserRow): void {
    this.userToDelete.set(row);
  }

  cancelDelete(): void {
    this.userToDelete.set(null);
  }

  confirmDelete(): void {
    const row = this.userToDelete();
    if (!row) {
      return;
    }

    this.deleting.set(true);

    // Load the LATEST users from the server, check the rules, then delete
    this.userService
      .getAll()
      .pipe(
        switchMap((latest) => {
          const target = latest.find((u) => u.id === row.id);
          if (!target) {
            return throwError(() => new Error('This user no longer exists.'));
          }
          if (target.id === this.ownUserId) {
            return throwError(() => new Error('You cannot delete your own account.'));
          }
          if (target.role === 'Admin' && latest.filter((u) => u.role === 'Admin').length <= 1) {
            return throwError(() => new Error('At least one Admin account must remain.'));
          }
          return this.userService.delete(target.id);
        }),
      )
      .subscribe({
        next: () => {
          this.users.update((list) => list.filter((u) => u.id !== row.id));
          this.deleting.set(false);
          this.userToDelete.set(null);
          this.notify.success(`User account ${row.email} was deleted.`);
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.userToDelete.set(null);
          this.notify.error(err instanceof Error ? err.message : 'Delete failed. Please try again.');
          this.loadData();
        },
      });
  }

  roleClass(role: UserRole): string {
    switch (role) {
      case 'Admin':
        return 'text-bg-danger';
      case 'HR':
        return 'text-bg-primary';
      default:
        return 'text-bg-secondary';
    }
  }
}
