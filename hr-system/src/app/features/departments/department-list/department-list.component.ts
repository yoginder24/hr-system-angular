import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, switchMap, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Department } from '../../../core/models/department.model';
import { Employee } from '../../../core/models/employee.model';
import { DepartmentService } from '../../../core/services/department.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

// A department plus two extra values we calculate for the table
interface DepartmentRow extends Department {
  managerName: string;
  employeeCount: number;
}

type CountFilter = 'all' | 'withEmployees' | 'empty';

@Component({
  selector: 'app-department-list',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './department-list.component.html',
})
export class DepartmentListComponent implements OnInit {
  private departmentService = inject(DepartmentService);
  private employeeService = inject(EmployeeService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  // ----- Data -----
  departments = signal<Department[]>([]);
  employees = signal<Employee[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  // ----- Filters -----
  searchText = signal('');
  countFilter = signal<CountFilter>('all');

  // ----- Delete dialog -----
  departmentToDelete = signal<DepartmentRow | null>(null);
  deleting = signal(false);

  // ----- What this user may do (the real check is still the route guard) -----
  canManage = this.auth.hasPermission('departments.manage');
  canDelete = this.auth.hasPermission('departments.delete');

  // ----- Computed values -----
  // Builds one row per department, with manager name and employee count.
  private rows = computed<DepartmentRow[]>(() => {
    const employees = this.employees();

    // employee id -> full name
    const names = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`] as const));

    // department id -> number of employees
    const counts = new Map<number, number>();
    for (const e of employees) {
      counts.set(e.departmentId, (counts.get(e.departmentId) ?? 0) + 1);
    }

    return this.departments().map((d) => ({
      ...d,
      managerName: d.managerId === null ? 'Not assigned' : (names.get(d.managerId) ?? 'Unknown'),
      employeeCount: counts.get(d.id) ?? 0,
    }));
  });

  filteredRows = computed(() => {
    const text = this.searchText().trim().toLowerCase();
    const filter = this.countFilter();

    return this.rows().filter((row) => {
      const matchesText =
        text === '' ||
        row.name.toLowerCase().includes(text) ||
        row.description.toLowerCase().includes(text);

      const matchesCount =
        filter === 'all' ||
        (filter === 'withEmployees' && row.employeeCount > 0) ||
        (filter === 'empty' && row.employeeCount === 0);

      return matchesText && matchesCount;
    });
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      departments: this.departmentService.getAll(),
      employees: this.employeeService.getAll(),
    }).subscribe({
      next: ({ departments, employees }) => {
        this.departments.set(departments);
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load departments. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  // ----- Filter events -----
  onSearch(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  onFilterChange(event: Event): void {
    this.countFilter.set((event.target as HTMLSelectElement).value as CountFilter);
  }

  clearFilters(): void {
    this.searchText.set('');
    this.countFilter.set('all');
  }

  // ----- Delete flow -----
  askDelete(row: DepartmentRow): void {
    this.departmentToDelete.set(row);
  }

  cancelDelete(): void {
    this.departmentToDelete.set(null);
  }

  confirmDelete(): void {
    const department = this.departmentToDelete();
    if (!department || !this.canDelete) {
      return;
    }

    this.deleting.set(true);

    // 1) Ask the server for the CURRENT number of employees
    // 2) Only if it is 0, send the DELETE request
    this.departmentService
      .countEmployees(department.id)
      .pipe(
        switchMap((count) => {
          if (count > 0) {
            return throwError(
              () =>
                new Error(
                  `${department.name} still has ${count} employee(s). Move them to another department first.`,
                ),
            );
          }
          return this.departmentService.delete(department.id);
        }),
      )
      .subscribe({
        next: () => {
          this.departments.update((list) => list.filter((d) => d.id !== department.id));
          this.deleting.set(false);
          this.departmentToDelete.set(null);
          this.notify.success(`${department.name} department was deleted.`);
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.departmentToDelete.set(null);

          // Our own message (department not empty) or a general failure message
          this.notify.error(err instanceof Error ? err.message : 'Delete failed. Please try again.');

          // Refresh, because the counts on screen were out of date
          this.loadData();
        },
      });
  }
}
