import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Attendance } from '../../../core/models/attendance.model';
import { Department } from '../../../core/models/department.model';
import { Employee } from '../../../core/models/employee.model';
import { LeaveRequest } from '../../../core/models/leave.model';
import { Payroll } from '../../../core/models/payroll.model';
import { AttendanceService } from '../../../core/services/attendance.service';
import { DepartmentService } from '../../../core/services/department.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { LeaveService } from '../../../core/services/leave.service';
import { PayrollService } from '../../../core/services/payroll.service';
import { todayString } from '../../../core/utils/date.utils';
import { employeeStatusClass, leaveStatusClass } from '../../../core/utils/status.utils';
import { PunchCardComponent } from '../../../shared/components/punch-card/punch-card.component';
import {
  StatCard,
  countOnLeaveToday,
  latestDayAttendance,
} from '../../../core/utils/summary.utils';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, DatePipe, CurrencyPipe, PunchCardComponent],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private attendanceService = inject(AttendanceService);
  private leaveService = inject(LeaveService);
  private payrollService = inject(PayrollService);

  // ----- Data -----
  employees = signal<Employee[]>([]);
  departments = signal<Department[]>([]);
  attendance = signal<Attendance[]>([]);
  leaveRequests = signal<LeaveRequest[]>([]);
  payroll = signal<Payroll[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  employeeClass = employeeStatusClass;
  leaveClass = leaveStatusClass;

  // ----- Computed values (they recalculate by themselves when the data changes) -----
  private employeeNames = computed(
    () => new Map(this.employees().map((e) => [e.id, `${e.firstName} ${e.lastName}`] as const)),
  );

  private departmentNames = computed(
    () => new Map(this.departments().map((d) => [d.id, d.name] as const)),
  );

  cards = computed<StatCard[]>(() => {
    const employees = this.employees();
    const pending = this.leaveRequests().filter((r) => r.status === 'Pending').length;

    return [
      {
        title: 'Total Employees',
        icon: 'bi-people',
        color: 'primary',
        value: String(employees.length),
        hint: 'All records',
      },
      {
        title: 'Active Employees',
        icon: 'bi-person-check',
        color: 'success',
        value: String(employees.filter((e) => e.employmentStatus === 'Active').length),
        hint: 'Status: Active',
      },
      {
        title: 'Departments',
        icon: 'bi-diagram-3',
        color: 'info',
        value: String(this.departments().length),
        hint: 'Total departments',
      },
      {
        title: 'On Leave Today',
        icon: 'bi-airplane',
        color: 'secondary',
        value: String(countOnLeaveToday(this.leaveRequests(), todayString())),
        hint: 'Approved leave covers today',
      },
      {
        title: 'Pending Leaves',
        icon: 'bi-calendar-check',
        color: 'warning',
        value: String(pending),
        hint: 'Waiting for a decision',
      },
    ];
  });

  recentEmployees = computed(() =>
    [...this.employees()]
      .sort((a, b) => b.joiningDate.localeCompare(a.joiningDate) || b.id - a.id)
      .slice(0, 5),
  );

  recentLeaves = computed(() =>
    [...this.leaveRequests()]
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn) || b.id - a.id)
      .slice(0, 5),
  );

  attendanceOverview = computed(() => latestDayAttendance(this.attendance()));

  // Payroll summary of the newest salary month that has records
  payrollOverview = computed(() => {
    const records = this.payroll();
    if (records.length === 0) {
      return null;
    }

    const latestMonth = records.reduce((max, r) => (r.salaryMonth > max ? r.salaryMonth : max), '');
    const month = records.filter((r) => r.salaryMonth === latestMonth);

    return {
      month: latestMonth,
      count: month.length,
      totalNet: month.reduce((sum, r) => sum + r.netSalary, 0),
      paid: month.filter((r) => r.status === 'Paid').length,
      processed: month.filter((r) => r.status === 'Processed').length,
      draft: month.filter((r) => r.status === 'Draft').length,
    };
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      employees: this.employeeService.getAll(),
      departments: this.departmentService.getAll(),
      attendance: this.attendanceService.getAll(),
      leaveRequests: this.leaveService.getAll(),
      payroll: this.payrollService.getAll(),
    }).subscribe({
      next: (data) => {
        this.employees.set(data.employees);
        this.departments.set(data.departments);
        this.attendance.set(data.attendance);
        this.leaveRequests.set(data.leaveRequests);
        this.payroll.set(data.payroll);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load the dashboard. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  // Called after "Mark Present": reload only the attendance numbers (no full-page spinner)
  reloadAttendance(): void {
    this.attendanceService.getAll().subscribe({
      next: (records) => this.attendance.set(records),
    });
  }

  // ----- Small helpers for the template -----
  employeeName(id: number): string {
    return this.employeeNames().get(id) ?? 'Unknown';
  }

  departmentName(id: number): string {
    return this.departmentNames().get(id) ?? 'Unknown';
  }
}
