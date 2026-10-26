import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { LeaveRequest } from '../../../core/models/leave.model';
import { EmployeeService } from '../../../core/services/employee.service';
import { LeaveService } from '../../../core/services/leave.service';
import { NotificationService } from '../../../core/services/notification.service';
import { leaveDays } from '../../../core/utils/date.utils';
import { leaveStatusClass } from '../../../core/utils/status.utils';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-leave-detail',
  imports: [RouterLink, DatePipe, ConfirmDialogComponent],
  templateUrl: './leave-detail.component.html',
})
export class LeaveDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private leaveService = inject(LeaveService);
  private employeeService = inject(EmployeeService);
  private notify = inject(NotificationService);

  request = signal<LeaveRequest | null>(null);
  employeeName = signal('');
  reviewerName = signal('');
  loading = signal(true);
  errorMessage = signal('');

  // Approve / reject dialog
  pendingStatus = signal<'Approved' | 'Rejected' | null>(null);
  processing = signal(false);

  statusClass = leaveStatusClass;

  private canViewAll = this.auth.hasPermission('leave.viewAll');
  private ownEmployeeId = this.auth.currentUser()?.employeeId ?? 0;

  days = computed(() => {
    const r = this.request();
    return r ? leaveDays(r.startDate, r.endDate) : 0;
  });

  // Buttons show only for Pending requests of OTHER people (the service checks again)
  canReview = computed(() => {
    const r = this.request();
    return (
      r !== null &&
      this.auth.hasPermission('leave.approve') &&
      r.status === 'Pending' &&
      r.employeeId !== this.ownEmployeeId
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isInteger(id) || id < 1) {
      this.errorMessage.set('Invalid leave request id.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.leaveService
      .getById(id)
      .pipe(
        // After we have the request, load the employee and the reviewer together
        switchMap((request) =>
          forkJoin({
            request: of(request),
            employee: this.employeeService.getById(request.employeeId).pipe(catchError(() => of(null))),
            reviewer:
              request.reviewedBy === null
                ? of(null)
                : this.employeeService.getById(request.reviewedBy).pipe(catchError(() => of(null))),
          }),
        ),
      )
      .subscribe({
        next: ({ request, employee, reviewer }) => {
          // Ownership check: an Employee may open only their own request
          if (!this.canViewAll && request.employeeId !== this.ownEmployeeId) {
            this.router.navigate(['/unauthorized']);
            return;
          }

          this.request.set(request);
          this.employeeName.set(employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown');
          this.reviewerName.set(reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : '');
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(
            err.status === 404
              ? 'Leave request not found.'
              : 'Could not load the request. Is JSON Server running?',
          );
          this.loading.set(false);
        },
      });
  }

  // ----- Approve / reject flow -----
  askReview(status: 'Approved' | 'Rejected'): void {
    this.pendingStatus.set(status);
  }

  cancelReview(): void {
    this.pendingStatus.set(null);
  }

  confirmReview(): void {
    const request = this.request();
    const status = this.pendingStatus();
    if (!request || !status) {
      return;
    }

    this.processing.set(true);

    this.leaveService.review(request.id, status).subscribe({
      next: (updated) => {
        this.request.set(updated);
        this.reviewerName.set(this.auth.currentUser()?.name ?? '');
        this.processing.set(false);
        this.pendingStatus.set(null);
        this.notify.success(`Leave request ${updated.status.toLowerCase()}.`);
      },
      error: (err: unknown) => {
        this.processing.set(false);
        this.pendingStatus.set(null);
        this.notify.error(
          err instanceof Error ? err.message : 'Could not update the request. Please try again.',
        );
        this.load(); // show the latest data
      },
    });
  }
}
