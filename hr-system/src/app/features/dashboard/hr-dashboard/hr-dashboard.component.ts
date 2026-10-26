import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Attendance } from '../../../core/models/attendance.model';
import { Department } from '../../../core/models/department.model';
import { Employee } from '../../../core/models/employee.model';
import { LeaveRequest } from '../../../core/models/leave.model';
import { AttendanceService } from '../../../core/services/attendance.service';
import { DepartmentService } from '../../../core/services/department.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { LeaveService } from '../../../core/services/leave.service';
import { leaveStatusClass } from '../../../core/utils/status.utils';
import { PunchCardComponent } from '../../../shared/components/punch-card/punch-card.component';
import { StatCard, latestDayAttendance } from '../../../core/utils/summary.utils';

@Component({
  selector: 'app-hr-dashboard',
  imports: [RouterLink, DatePipe, PunchCardComponent],
  templateUrl: './hr-dashboard.component.html',
})
export class HrDashboardComponent implements OnInit {
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private attendanceService = inject(AttendanceService);
  private leaveService = inject(LeaveService);

  // ----- Data -----
  employees = signal<Employee[]>([]);
  departments = signal<Department[]>([]);
  attendance = signal<Attendance[]>([]);
  leaveRequests = signal<LeaveRequest[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  leaveClass = leaveStatusClass;

  // ----- Computed values -----
  private employeeNames = computed(
    () => new Map(this.employees().map((e) => [e.id, `${e.firstName} ${e.lastName}`] as const)),
  );

  cards = computed<StatCard[]>(() => {
    const employees = this.employees();
    const active = employees.filter((e) => e.employmentStatus === 'Active').length;
    const pending = this.leaveRequests().filter((r) => r.status === 'Pending').length;

    return [
      {
        title: 'Employees',
        icon: 'bi-people',
        color: 'primary',
        value: String(employees.length),
        hint: `${active} active`,
      },
      {
        title: 'Departments',
        icon: 'bi-diagram-3',
        color: 'info',
        value: String(this.departments().length),
        hint: 'Total departments',
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

  // Employees per department, with a percentage for the progress bar
  departmentSummary = computed(() => {
    const total = this.employees().length;
    const counts = new Map<number, number>();
    for (const e of this.employees()) {
      counts.set(e.departmentId, (counts.get(e.departmentId) ?? 0) + 1);
    }

    return this.departments()
      .map((d) => {
        const count = counts.get(d.id) ?? 0;
        return {
          id: d.id,
          name: d.name,
          count,
          percent: total === 0 ? 0 : Math.round((count / total) * 100),
        };
      })
      .sort((a, b) => b.count - a.count);
  });

  attendanceOverview = computed(() => latestDayAttendance(this.attendance()));

  // Oldest pending requests first (they have waited the longest)
  pendingList = computed(() =>
    this.leaveRequests()
      .filter((r) => r.status === 'Pending')
      .sort((a, b) => a.appliedOn.localeCompare(b.appliedOn) || a.id - b.id)
      .slice(0, 5),
  );

  // "Recent HR activity" = the latest leave decisions. The demo has no real activity log.
  recentDecisions = computed(() =>
    this.leaveRequests()
      .filter((r) => r.status !== 'Pending')
      .sort((a, b) => (b.reviewedOn ?? b.appliedOn).localeCompare(a.reviewedOn ?? a.appliedOn))
      .slice(0, 5),
  );

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
    }).subscribe({
      next: (data) => {
        this.employees.set(data.employees);
        this.departments.set(data.departments);
        this.attendance.set(data.attendance);
        this.leaveRequests.set(data.leaveRequests);
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

  reviewerName(request: LeaveRequest): string {
    return request.reviewedBy === null ? 'Unknown' : this.employeeName(request.reviewedBy);
  }
}
