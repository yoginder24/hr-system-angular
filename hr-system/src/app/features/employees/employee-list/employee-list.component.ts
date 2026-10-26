import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Department } from '../../../core/models/department.model';
import { Employee, EmploymentStatus } from '../../../core/models/employee.model';
import { DepartmentService } from '../../../core/services/department.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-employee-list',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './employee-list.component.html',
})
export class EmployeeListComponent implements OnInit {
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  // ----- Data -----
  employees = signal<Employee[]>([]);
  departments = signal<Department[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  // ----- Filters and paging -----
  searchText = signal('');
  departmentFilter = signal(0); // 0 means "all departments"
  statusFilter = signal<EmploymentStatus | ''>(''); // '' means "all statuses"
  currentPage = signal(1);
  readonly pageSize = 5;

  statuses: EmploymentStatus[] = ['Active', 'On Leave', 'Inactive'];

  // ----- Delete dialog -----
  employeeToDelete = signal<Employee | null>(null);
  deleting = signal(false);

  // ----- What this user may do (the real check is still the route guard) -----
  canAdd = this.auth.hasPermission('employees.add');
  canEdit = this.auth.hasPermission('employees.edit');
  canDelete = this.auth.hasPermission('employees.delete');

  // ----- Computed values -----
  // department id -> department name
  private departmentNames = computed(
    () => new Map(this.departments().map((d) => [d.id, d.name] as const)),
  );

  filteredEmployees = computed(() => {
    const text = this.searchText().trim().toLowerCase();
    const departmentId = this.departmentFilter();
    const status = this.statusFilter();

    return this.employees().filter((e) => {
      const matchesText =
        text === '' ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(text) ||
        e.employeeCode.toLowerCase().includes(text) ||
        e.email.toLowerCase().includes(text);

      const matchesDepartment = departmentId === 0 || e.departmentId === departmentId;
      const matchesStatus = status === '' || e.employmentStatus === status;

      return matchesText && matchesDepartment && matchesStatus;
    });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredEmployees().length / this.pageSize)),
  );

  // The page number, never larger than the number of pages
  page = computed(() => Math.min(this.currentPage(), this.totalPages()));

  pagedEmployees = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredEmployees().slice(start, start + this.pageSize);
  });

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  rangeStart = computed(() =>
    this.filteredEmployees().length === 0 ? 0 : (this.page() - 1) * this.pageSize + 1,
  );

  rangeEnd = computed(() => Math.min(this.page() * this.pageSize, this.filteredEmployees().length));

  // ----- Lifecycle -----
  // ngOnInit runs once, right after the component is created.
  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    // forkJoin runs both requests together and waits for both to finish
    forkJoin({
      employees: this.employeeService.getAll(),
      departments: this.departmentService.getAll(),
    }).subscribe({
      next: ({ employees, departments }) => {
        this.employees.set(employees);
        this.departments.set(departments);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load employees. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  // ----- Filter events -----
  onSearch(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  onDepartmentChange(event: Event): void {
    this.departmentFilter.set(Number((event.target as HTMLSelectElement).value));
    this.currentPage.set(1);
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as EmploymentStatus | '');
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchText.set('');
    this.departmentFilter.set(0);
    this.statusFilter.set('');
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  // ----- Delete flow -----
  askDelete(employee: Employee): void {
    this.employeeToDelete.set(employee);
  }

  cancelDelete(): void {
    this.employeeToDelete.set(null);
  }

  confirmDelete(): void {
    const employee = this.employeeToDelete();
    if (!employee || !this.canDelete) {
      return;
    }

    // Protect the demo: nobody may delete the record they are logged in with
    if (employee.id === this.auth.currentUser()?.employeeId) {
      this.notify.error('You cannot delete your own employee record.');
      this.employeeToDelete.set(null);
      return;
    }

    this.deleting.set(true);
    this.employeeService.delete(employee.id).subscribe({
      next: () => {
        // Remove it from the screen without reloading everything
        this.employees.update((list) => list.filter((e) => e.id !== employee.id));
        this.deleting.set(false);
        this.employeeToDelete.set(null);
        this.notify.success(`${employee.firstName} ${employee.lastName} was deleted.`);
      },
      error: () => {
        this.deleting.set(false);
        this.employeeToDelete.set(null);
        this.notify.error('Delete failed. Please try again.');
      },
    });
  }

  // ----- Small helpers for the template -----
  departmentName(id: number): string {
    return this.departmentNames().get(id) ?? 'Unknown';
  }

  initials(employee: Employee): string {
    return ((employee.firstName[0] ?? '') + (employee.lastName[0] ?? '')).toUpperCase();
  }

  statusClass(status: EmploymentStatus): string {
    switch (status) {
      case 'Active':
        return 'text-bg-success';
      case 'On Leave':
        return 'text-bg-warning';
      default:
        return 'text-bg-secondary';
    }
  }
}
