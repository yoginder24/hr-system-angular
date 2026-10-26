import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Employee } from '../../../core/models/employee.model';
import { Payroll, PayrollStatus } from '../../../core/models/payroll.model';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PayrollService } from '../../../core/services/payroll.service';
import { payrollStatusClass } from '../../../core/utils/status.utils';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-payroll-list',
  imports: [RouterLink, DatePipe, CurrencyPipe, ConfirmDialogComponent],
  templateUrl: './payroll-list.component.html',
})
export class PayrollListComponent implements OnInit {
  private payrollService = inject(PayrollService);
  private employeeService = inject(EmployeeService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  // ----- Data -----
  records = signal<Payroll[]>([]);
  employees = signal<Employee[]>([]); // only loaded for Admin / HR
  loading = signal(true);
  errorMessage = signal('');

  // ----- Filters -----
  employeeFilter = signal(0); // 0 = all employees
  monthFilter = signal(''); // '' = all months, otherwise "YYYY-MM"
  statusFilter = signal<PayrollStatus | ''>(''); // '' = all statuses
  statuses: PayrollStatus[] = ['Draft', 'Processed', 'Paid'];

  // ----- Delete dialog -----
  recordToDelete = signal<Payroll | null>(null);
  deleting = signal(false);

  // ----- What this user may do (the real check is still the route guard) -----
  canViewAll = this.auth.hasPermission('payroll.viewAll');
  canManage = this.auth.hasPermission('payroll.manage');
  canDelete = this.auth.hasPermission('payroll.delete');
  private ownEmployeeId = this.auth.currentUser()?.employeeId ?? 0;

  statusClass = payrollStatusClass;

  // ----- Computed values -----
  // employee id -> full name
  private names = computed(() => {
    const map = new Map<number, string>(this.employees().map((e) => [e.id, `${e.firstName} ${e.lastName}`] as const));

    // Employees do not load the employee list, so add their own name from the session
    const user = this.auth.currentUser();
    if (user && !map.has(user.employeeId)) {
      map.set(user.employeeId, user.name);
    }
    return map;
  });

  employeeOptions = computed(() =>
    [...this.employees()].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    ),
  );

  // Safety net: an Employee sees only their OWN records, and never Drafts
  private visibleRecords = computed(() =>
    this.canViewAll
      ? this.records()
      : this.records().filter((r) => r.employeeId === this.ownEmployeeId && r.status !== 'Draft'),
  );

  filteredRecords = computed(() => {
    const employeeId = this.employeeFilter();
    const month = this.monthFilter();
    const status = this.statusFilter();

    return this.visibleRecords()
      .filter(
        (r) =>
          (employeeId === 0 || r.employeeId === employeeId) &&
          (month === '' || r.salaryMonth === month) &&
          (status === '' || r.status === status),
      )
      .sort((a, b) => b.salaryMonth.localeCompare(a.salaryMonth) || b.id - a.id); // newest first
  });

  // Summary of the rows currently shown
  summary = computed(() => {
    const list = this.filteredRecords();
    return {
      count: list.length,
      totalNet: list.reduce((sum, r) => sum + r.netSalary, 0),
      paid: list.filter((r) => r.status === 'Paid').length,
      unpaid: list.filter((r) => r.status !== 'Paid').length,
    };
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const user = this.auth.currentUser();
    if (!user) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    if (this.canViewAll) {
      forkJoin({
        records: this.payrollService.getAll(),
        employees: this.employeeService.getAll(),
      }).subscribe({
        next: ({ records, employees }) => {
          this.records.set(records);
          this.employees.set(employees);
          this.loading.set(false);
        },
        error: () => this.showLoadError(),
      });
    } else {
      // Employee: ask the API only for this person's records
      this.payrollService.getByEmployee(user.employeeId).subscribe({
        next: (records) => {
          this.records.set(records);
          this.loading.set(false);
        },
        error: () => this.showLoadError(),
      });
    }
  }

  private showLoadError(): void {
    this.errorMessage.set('Could not load payroll. Is JSON Server running? (npm run api)');
    this.loading.set(false);
  }

  // ----- Filter events -----
  onEmployeeChange(event: Event): void {
    this.employeeFilter.set(Number((event.target as HTMLSelectElement).value));
  }

  onMonthChange(event: Event): void {
    this.monthFilter.set((event.target as HTMLInputElement).value);
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as PayrollStatus | '');
  }

  clearFilters(): void {
    this.employeeFilter.set(0);
    this.monthFilter.set('');
    this.statusFilter.set('');
  }

  // ----- Delete flow -----
  askDelete(record: Payroll): void {
    this.recordToDelete.set(record);
  }

  cancelDelete(): void {
    this.recordToDelete.set(null);
  }

  confirmDelete(): void {
    const record = this.recordToDelete();
    if (!record || !this.canDelete) {
      return;
    }

    this.deleting.set(true);
    this.payrollService.delete(record.id).subscribe({
      next: () => {
        this.records.update((list) => list.filter((r) => r.id !== record.id));
        this.deleting.set(false);
        this.recordToDelete.set(null);
        this.notify.success('Payroll record deleted.');
      },
      error: () => {
        this.deleting.set(false);
        this.recordToDelete.set(null);
        this.notify.error('Delete failed. Please try again.');
      },
    });
  }

  // ----- Small helper for the template -----
  employeeName(id: number): string {
    return this.names().get(id) ?? 'Unknown';
  }
}
