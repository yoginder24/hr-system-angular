import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Employee } from '../../../core/models/employee.model';
import { LeaveRequest, LeaveStatus } from '../../../core/models/leave.model';
import { EmployeeService } from '../../../core/services/employee.service';
import { LeaveService } from '../../../core/services/leave.service';
import { NotificationService } from '../../../core/services/notification.service';
import { leaveDays } from '../../../core/utils/date.utils';
import { leaveStatusClass } from '../../../core/utils/status.utils';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

// What the user is about to do (shown in the confirmation dialog)
interface PendingReview {
  request: LeaveRequest;
  status: 'Approved' | 'Rejected';
}

@Component({
  selector: 'app-leave-list',
  imports: [RouterLink, DatePipe, ConfirmDialogComponent],
  templateUrl: './leave-list.component.html',
})
export class LeaveListComponent implements OnInit {
  private leaveService = inject(LeaveService);
  private employeeService = inject(EmployeeService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  // ----- Data -----
  requests = signal<LeaveRequest[]>([]);
  employees = signal<Employee[]>([]); // only loaded for Admin / HR
  loading = signal(true);
  errorMessage = signal('');

  // ----- Filters -----
  employeeFilter = signal(0); // 0 = all employees
  statusFilter = signal<LeaveStatus | ''>(''); // '' = all statuses
  statuses: LeaveStatus[] = ['Pending', 'Approved', 'Rejected'];

  // ----- Approve / reject dialog -----
  pendingReview = signal<PendingReview | null>(null);
  processing = signal(false);

  // ----- What this user may do (the real check is still the route guard + service) -----
  canViewAll = this.auth.hasPermission('leave.viewAll');
  canApprove = this.auth.hasPermission('leave.approve');
  canApply = this.auth.hasPermission('leave.apply');
  private ownEmployeeId = this.auth.currentUser()?.employeeId ?? 0;

  statusClass = leaveStatusClass;

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

  // Safety net: an Employee never sees other people's requests
  private visibleRequests = computed(() =>
    this.canViewAll
      ? this.requests()
      : this.requests().filter((r) => r.employeeId === this.ownEmployeeId),
  );

  filteredRequests = computed(() => {
    const employeeId = this.employeeFilter();
    const status = this.statusFilter();

    return this.visibleRequests()
      .filter(
        (r) =>
          (employeeId === 0 || r.employeeId === employeeId) &&
          (status === '' || r.status === status),
      )
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn) || b.id - a.id); // newest first
  });

  // Counts for the three cards (based on ALL visible requests)
  counts = computed(() => {
    const list = this.visibleRequests();
    const count = (status: LeaveStatus) => list.filter((r) => r.status === status).length;
    return { pending: count('Pending'), approved: count('Approved'), rejected: count('Rejected') };
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
        requests: this.leaveService.getAll(),
        employees: this.employeeService.getAll(),
      }).subscribe({
        next: ({ requests, employees }) => {
          this.requests.set(requests);
          this.employees.set(employees);
          this.loading.set(false);
        },
        error: () => this.showLoadError(),
      });
    } else {
      // Employee: ask the API only for this person's requests
      this.leaveService.getByEmployee(user.employeeId).subscribe({
        next: (requests) => {
          this.requests.set(requests);
          this.loading.set(false);
        },
        error: () => this.showLoadError(),
      });
    }
  }

  private showLoadError(): void {
    this.errorMessage.set('Could not load leave requests. Is JSON Server running? (npm run api)');
    this.loading.set(false);
  }

  // ----- Filter events -----
  onEmployeeChange(event: Event): void {
    this.employeeFilter.set(Number((event.target as HTMLSelectElement).value));
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as LeaveStatus | '');
  }

  clearFilters(): void {
    this.employeeFilter.set(0);
    this.statusFilter.set('');
  }

  // ----- Approve / reject flow -----
  // Show buttons only for Pending requests of OTHER people (the service checks again)
  canReview(request: LeaveRequest): boolean {
    return this.canApprove && request.status === 'Pending' && request.employeeId !== this.ownEmployeeId;
  }

  askReview(request: LeaveRequest, status: 'Approved' | 'Rejected'): void {
    this.pendingReview.set({ request, status });
  }

  cancelReview(): void {
    this.pendingReview.set(null);
  }

  confirmReview(): void {
    const action = this.pendingReview();
    if (!action) {
      return;
    }

    this.processing.set(true);

    this.leaveService.review(action.request.id, action.status).subscribe({
      next: (updated) => {
        // Replace the old request with the updated one -> the screen refreshes by itself
        this.requests.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        this.processing.set(false);
        this.pendingReview.set(null);
        this.notify.success(`Leave request ${updated.status.toLowerCase()}.`);
      },
      error: (err: unknown) => {
        this.processing.set(false);
        this.pendingReview.set(null);
        this.notify.error(
          err instanceof Error ? err.message : 'Could not update the request. Please try again.',
        );
        this.loadData(); // our screen may have been out of date
      },
    });
  }

  // ----- Small helpers for the template -----
  employeeName(id: number): string {
    return this.names().get(id) ?? 'Unknown';
  }

  days(request: LeaveRequest): number {
    return leaveDays(request.startDate, request.endDate);
  }

  reviewMessage(action: PendingReview): string {
    const r = action.request;
    const verb = action.status === 'Approved' ? 'Approve' : 'Reject';
    return `${verb} the ${r.leaveType} leave of ${this.employeeName(r.employeeId)} (${r.startDate} to ${r.endDate}, ${this.days(r)} day(s))?`;
  }
}
