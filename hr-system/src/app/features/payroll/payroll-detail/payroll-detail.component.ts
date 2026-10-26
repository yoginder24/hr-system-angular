import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Payroll } from '../../../core/models/payroll.model';
import { EmployeeService } from '../../../core/services/employee.service';
import { PayrollService } from '../../../core/services/payroll.service';
import { payrollStatusClass } from '../../../core/utils/status.utils';

@Component({
  selector: 'app-payroll-detail',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './payroll-detail.component.html',
})
export class PayrollDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private payrollService = inject(PayrollService);
  private employeeService = inject(EmployeeService);

  record = signal<Payroll | null>(null);
  employeeName = signal('');
  loading = signal(true);
  errorMessage = signal('');

  statusClass = payrollStatusClass;

  canManage = this.auth.hasPermission('payroll.manage');
  private canViewAll = this.auth.hasPermission('payroll.viewAll');
  private ownEmployeeId = this.auth.currentUser()?.employeeId ?? 0;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isInteger(id) || id < 1) {
      this.errorMessage.set('Invalid payroll id.');
      this.loading.set(false);
      return;
    }

    this.payrollService
      .getById(id)
      .pipe(
        // After we have the record, load the employee's name
        switchMap((record) =>
          forkJoin({
            record: of(record),
            employee: this.employeeService.getById(record.employeeId).pipe(catchError(() => of(null))),
          }),
        ),
      )
      .subscribe({
        next: ({ record, employee }) => {
          // Ownership check: an Employee may open only their OWN record, and never a Draft
          if (!this.canViewAll && (record.employeeId !== this.ownEmployeeId || record.status === 'Draft')) {
            this.router.navigate(['/unauthorized']);
            return;
          }

          this.record.set(record);
          this.employeeName.set(
            employee
              ? `${employee.firstName} ${employee.lastName}`
              : record.employeeId === this.ownEmployeeId
                ? (this.auth.currentUser()?.name ?? 'Unknown')
                : 'Unknown',
          );
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(
            err.status === 404
              ? 'Payroll record not found.'
              : 'Could not load the record. Is JSON Server running?',
          );
          this.loading.set(false);
        },
      });
  }
}
