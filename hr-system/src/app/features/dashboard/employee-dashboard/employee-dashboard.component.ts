import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Attendance } from '../../../core/models/attendance.model';
import { Employee } from '../../../core/models/employee.model';
import { LeaveRequest } from '../../../core/models/leave.model';
import { Payroll } from '../../../core/models/payroll.model';
import { AttendanceService } from '../../../core/services/attendance.service';
import { DepartmentService } from '../../../core/services/department.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { LeaveService } from '../../../core/services/leave.service';
import { PayrollService } from '../../../core/services/payroll.service';
import { leaveDays } from '../../../core/utils/date.utils';
import {
  attendanceStatusClass,
  employeeStatusClass,
  payrollStatusClass,
} from '../../../core/utils/status.utils';
import { DEMO_ANNUAL_LEAVE_DAYS, leaveSummary } from '../../../core/utils/summary.utils';
import { PunchCardComponent } from '../../../shared/components/punch-card/punch-card.component';

@Component({
  selector: 'app-employee-dashboard',
  imports: [RouterLink, DatePipe, CurrencyPipe, PunchCardComponent],
  templateUrl: './employee-dashboard.component.html',
})
export class EmployeeDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private attendanceService = inject(AttendanceService);
  private leaveService = inject(LeaveService);
  private payrollService = inject(PayrollService);

  private ownEmployeeId = this.auth.currentUser()?.employeeId ?? 0;
  demoAllowance = DEMO_ANNUAL_LEAVE_DAYS;

  // ----- Data (only THIS person's records) -----
  employee = signal<Employee | null>(null);
  departmentName = signal('');
  attendance = signal<Attendance[]>([]);
  leave = signal<LeaveRequest[]>([]);
  payroll = signal<Payroll[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  employeeClass = employeeStatusClass;
  attendanceClass = attendanceStatusClass;
  payrollClass = payrollStatusClass;

  // ----- Computed values -----
  recentAttendance = computed(() =>
    [...this.attendance()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 5),
  );

  pendingRequests = computed(() =>
    this.leave()
      .filter((r) => r.status === 'Pending')
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  );

  leaveInfo = computed(() => leaveSummary(this.leave(), new Date().getFullYear()));

  usedPercent = computed(() => {
    const info = this.leaveInfo();
    return info.allowance === 0 ? 0 : Math.min(100, Math.round((info.used / info.allowance) * 100));
  });

  // The newest record that is not a Draft (drafts are already removed when loading)
  latestPayroll = computed(
    () =>
      [...this.payroll()]
        .sort((a, b) => b.salaryMonth.localeCompare(a.salaryMonth) || b.id - a.id)
        .find((p) => p.status !== 'Draft') ?? null,
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    if (this.ownEmployeeId < 1) {
      this.errorMessage.set('Your account is not linked to an employee record.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      employee: this.employeeService.getById(this.ownEmployeeId),
      attendance: this.attendanceService.getByEmployee(this.ownEmployeeId),
      leave: this.leaveService.getByEmployee(this.ownEmployeeId),
      payroll: this.payrollService.getByEmployee(this.ownEmployeeId),
    })
      .pipe(
        // Load only MY department (not the whole department list)
        switchMap((data) =>
          this.departmentService.getById(data.employee.departmentId).pipe(
            catchError(() => of(null)),
            map((department) => ({ ...data, department })),
          ),
        ),
      )
      .subscribe({
        next: ({ employee, attendance, leave, payroll, department }) => {
          this.employee.set(employee);
          this.departmentName.set(department?.name ?? 'Unknown');
          this.attendance.set(attendance);
          this.leave.set(leave);
          this.payroll.set(payroll.filter((p) => p.status !== 'Draft')); // employees never see Drafts
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(
            err.status === 404
              ? 'Your employee record was not found.'
              : 'Could not load the dashboard. Is JSON Server running? (npm run api)',
          );
          this.loading.set(false);
        },
      });
  }

  // Called after "Mark Present": reload only the attendance list (no full-page spinner)
  refreshAttendance(): void {
    this.attendanceService.getByEmployee(this.ownEmployeeId).subscribe({
      next: (records) => this.attendance.set(records),
    });
  }

  // ----- Small helpers for the template -----
  days(request: LeaveRequest): number {
    return leaveDays(request.startDate, request.endDate);
  }
}
