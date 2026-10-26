import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Attendance, AttendanceStatus } from '../../../core/models/attendance.model';
import { Employee } from '../../../core/models/employee.model';
import { AttendanceService } from '../../../core/services/attendance.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { workedHours } from '../../../core/utils/date.utils';
import { attendanceStatusClass } from '../../../core/utils/status.utils';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-attendance-list',
  imports: [RouterLink, DatePipe, ConfirmDialogComponent],
  templateUrl: './attendance-list.component.html',
})
export class AttendanceListComponent implements OnInit {
  private attendanceService = inject(AttendanceService);
  private employeeService = inject(EmployeeService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  // ----- Data -----
  records = signal<Attendance[]>([]);
  employees = signal<Employee[]>([]); // only loaded for Admin / HR
  loading = signal(true);
  errorMessage = signal('');

  // ----- Filters -----
  employeeFilter = signal(0); // 0 = all employees
  dateFilter = signal(''); // '' = all dates
  statusFilter = signal<AttendanceStatus | ''>(''); // '' = all statuses
  statuses: AttendanceStatus[] = ['Present', 'Late', 'Half Day', 'Absent'];

  // ----- Delete dialog -----
  recordToDelete = signal<Attendance | null>(null);
  deleting = signal(false);

  // ----- What this user may do (the real check is still the route guard) -----
  canViewAll = this.auth.hasPermission('attendance.viewAll');
  canManage = this.auth.hasPermission('attendance.manage');
  canDelete = this.auth.hasPermission('attendance.delete');
  private ownEmployeeId = this.auth.currentUser()?.employeeId ?? 0;

  statusClass = attendanceStatusClass;

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

  // Employees for the filter dropdown, sorted by name
  employeeOptions = computed(() =>
    [...this.employees()].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    ),
  );

  // Safety net: an Employee never sees records of other people
  private visibleRecords = computed(() =>
    this.canViewAll
      ? this.records()
      : this.records().filter((r) => r.employeeId === this.ownEmployeeId),
  );

  filteredRecords = computed(() => {
    const employeeId = this.employeeFilter();
    const date = this.dateFilter();
    const status = this.statusFilter();

    return this.visibleRecords()
      .filter(
        (r) =>
          (employeeId === 0 || r.employeeId === employeeId) &&
          (date === '' || r.date === date) &&
          (status === '' || r.status === status),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id); // newest first
  });

  // Basic summary of the rows currently shown
  summary = computed(() => {
    const list = this.filteredRecords();
    const count = (status: AttendanceStatus) => list.filter((r) => r.status === status).length;

    return {
      total: list.length,
      present: count('Present'),
      late: count('Late'),
      halfDay: count('Half Day'),
      absent: count('Absent'),
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
      // Admin / HR: load every record and the employee names
      forkJoin({
        records: this.attendanceService.getAll(),
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
      this.attendanceService.getByEmployee(user.employeeId).subscribe({
        next: (records) => {
          this.records.set(records);
          this.loading.set(false);
        },
        error: () => this.showLoadError(),
      });
    }
  }

  private showLoadError(): void {
    this.errorMessage.set('Could not load attendance. Is JSON Server running? (npm run api)');
    this.loading.set(false);
  }

  // ----- Filter events -----
  onEmployeeChange(event: Event): void {
    this.employeeFilter.set(Number((event.target as HTMLSelectElement).value));
  }

  onDateChange(event: Event): void {
    this.dateFilter.set((event.target as HTMLInputElement).value);
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as AttendanceStatus | '');
  }

  clearFilters(): void {
    this.employeeFilter.set(0);
    this.dateFilter.set('');
    this.statusFilter.set('');
  }

  // ----- Delete flow -----
  askDelete(record: Attendance): void {
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
    this.attendanceService.delete(record.id).subscribe({
      next: () => {
        this.records.update((list) => list.filter((r) => r.id !== record.id));
        this.deleting.set(false);
        this.recordToDelete.set(null);
        this.notify.success('Attendance record deleted.');
      },
      error: () => {
        this.deleting.set(false);
        this.recordToDelete.set(null);
        this.notify.error('Delete failed. Please try again.');
      },
    });
  }

  // ----- Small helpers for the template -----
  employeeName(id: number): string {
    return this.names().get(id) ?? 'Unknown';
  }

  hours(record: Attendance): string {
    return workedHours(record.checkIn, record.checkOut);
  }
}
