import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Attendance, AttendanceStatus } from '../../core/models/attendance.model';
import { Employee } from '../../core/models/employee.model';
import { LeaveRequest } from '../../core/models/leave.model';
import { Payroll } from '../../core/models/payroll.model';
import { AttendanceService } from '../../core/services/attendance.service';
import { DepartmentService } from '../../core/services/department.service';
import { EmployeeService } from '../../core/services/employee.service';
import { LeaveService } from '../../core/services/leave.service';
import { PayrollService } from '../../core/services/payroll.service';
import { leaveDays, workedHours } from '../../core/utils/date.utils';
import {
  attendanceStatusClass,
  employeeStatusClass,
  leaveStatusClass,
  payrollStatusClass,
} from '../../core/utils/status.utils';
import { DEMO_ANNUAL_LEAVE_DAYS, leaveSummary } from '../../core/utils/summary.utils';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private attendanceService = inject(AttendanceService);
  private leaveService = inject(LeaveService);
  private payrollService = inject(PayrollService);

  // ----- Whose profile is this? -----
  // "/profile" has no id -> use my own employee id. "/profile/5" -> employee 5.
  private ownEmployeeId = this.auth.currentUser()?.employeeId ?? 0;
  private profileId = Number(this.route.snapshot.paramMap.get('id') ?? this.ownEmployeeId);
  isOwn = this.profileId === this.ownEmployeeId;

  // ----- What may this viewer see? (decided by permissions.ts) -----
  canSeeAttendance =
    this.auth.hasPermission('attendance.viewAll') ||
    (this.isOwn && this.auth.hasPermission('attendance.viewOwn'));
  canSeeLeave =
    this.auth.hasPermission('leave.viewAll') ||
    (this.isOwn && this.auth.hasPermission('leave.viewOwn'));
  canSeePayroll =
    this.auth.hasPermission('payroll.viewAll') ||
    (this.isOwn && this.auth.hasPermission('payroll.viewOwn'));
  private canSeeDrafts = this.auth.hasPermission('payroll.viewAll');

  canEdit = this.auth.hasPermission('employees.edit');
  backLink = this.auth.hasPermission('employees.view') && !this.isOwn ? '/employees' : '/dashboard';
  backLabel = this.backLink === '/employees' ? 'Back to employees' : 'Back to dashboard';

  // ----- Data -----
  employee = signal<Employee | null>(null);
  departmentName = signal('');
  attendance = signal<Attendance[]>([]);
  leave = signal<LeaveRequest[]>([]);
  payroll = signal<Payroll[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  demoAllowance = DEMO_ANNUAL_LEAVE_DAYS;

  // Badge color helpers (used by the template)
  employeeClass = employeeStatusClass;
  attendanceClass = attendanceStatusClass;
  leaveClass = leaveStatusClass;
  payrollClass = payrollStatusClass;

  // ----- Computed values -----
  attendanceCounts = computed(() => {
    const list = this.attendance();
    const count = (status: AttendanceStatus): number => list.filter((r) => r.status === status).length;
    return {
      total: list.length,
      present: count('Present'),
      late: count('Late'),
      halfDay: count('Half Day'),
      absent: count('Absent'),
    };
  });

  recentAttendance = computed(() =>
    [...this.attendance()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 5),
  );

  leaveHistory = computed(() =>
    [...this.leave()].sort((a, b) => b.appliedOn.localeCompare(a.appliedOn) || b.id - a.id),
  );

  leaveInfo = computed(() => leaveSummary(this.leave(), new Date().getFullYear()));

  payrollSorted = computed(() =>
    [...this.payroll()].sort((a, b) => b.salaryMonth.localeCompare(a.salaryMonth) || b.id - a.id),
  );

  recentPayroll = computed(() => this.payrollSorted().slice(0, 3));

  // The newest record that is not a Draft
  latestPayroll = computed(() => this.payrollSorted().find((p) => p.status !== 'Draft') ?? null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!Number.isInteger(this.profileId) || this.profileId < 1) {
      this.errorMessage.set('Invalid employee id.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      employee: this.employeeService.getById(this.profileId),
      // If a section is not allowed we do NOT call the API: of([]) returns an empty list at once
      attendance: this.canSeeAttendance
        ? this.attendanceService.getByEmployee(this.profileId)
        : of<Attendance[]>([]),
      leave: this.canSeeLeave
        ? this.leaveService.getByEmployee(this.profileId)
        : of<LeaveRequest[]>([]),
      payroll: this.canSeePayroll
        ? this.payrollService.getByEmployee(this.profileId)
        : of<Payroll[]>([]),
    })
      .pipe(
        // Now that we know the employee, load their department
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
          // Employees never see Draft payroll records
          this.payroll.set(this.canSeeDrafts ? payroll : payroll.filter((p) => p.status !== 'Draft'));
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(
            err.status === 404
              ? 'Employee not found.'
              : 'Could not load the profile. Is JSON Server running? (npm run api)',
          );
          this.loading.set(false);
        },
      });
  }

  // ----- Small helpers for the template -----
  days(request: LeaveRequest): number {
    return leaveDays(request.startDate, request.endDate);
  }

  hours(record: Attendance): string {
    return workedHours(record.checkIn, record.checkOut);
  }
}
