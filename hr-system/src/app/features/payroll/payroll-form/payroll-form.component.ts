import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Employee } from '../../../core/models/employee.model';
import { Payroll, PayrollStatus } from '../../../core/models/payroll.model';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PayrollService } from '../../../core/services/payroll.service';
import { todayString } from '../../../core/utils/date.utils';
import { calculateNetSalary } from '../../../core/utils/payroll.utils';

// Group validator: deductions cannot be more than basic + allowances.
const deductionsValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const basic = Number(group.get('basicSalary')?.value) || 0;
  const allowances = Number(group.get('allowances')?.value) || 0;
  const deductions = Number(group.get('deductions')?.value) || 0;
  return deductions > basic + allowances ? { deductionsTooHigh: true } : null;
};

@Component({
  selector: 'app-payroll-form',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe],
  templateUrl: './payroll-form.component.html',
})
export class PayrollFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private payrollService = inject(PayrollService);
  private employeeService = inject(EmployeeService);
  private notify = inject(NotificationService);

  // null = adding. A number = editing that record.
  editId: number | null = null;

  employees = signal<Employee[]>([]);
  loading = signal(true);
  saving = signal(false);
  loadError = signal('');
  formError = signal('');
  submitted = signal(false);

  statuses: PayrollStatus[] = ['Draft', 'Processed', 'Paid'];

  // Used for the duplicate check on save
  private allRecords: Payroll[] = [];

  form = this.fb.nonNullable.group(
    {
      employeeId: [0, [Validators.min(1)]], // 0 = nothing selected yet
      salaryMonth: [
        todayString().slice(0, 7), // the current month, "YYYY-MM"
        [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)],
      ],
      basicSalary: [0, [Validators.required, Validators.min(1), Validators.max(10_000_000)]],
      allowances: [0, [Validators.required, Validators.min(0), Validators.max(10_000_000)]],
      deductions: [0, [Validators.required, Validators.min(0), Validators.max(10_000_000)]],
      status: ['Draft' as PayrollStatus, Validators.required],
    },
    { validators: deductionsValidator },
  );

  get f() {
    return this.form.controls;
  }

  constructor() {
    // When an employee is picked (Add mode only), start with their current salary.
    // takeUntilDestroyed() stops listening automatically when the component is destroyed.
    this.form.controls.employeeId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      if (this.editId !== null) {
        return;
      }
      const employee = this.employees().find((e) => e.id === id);
      if (employee) {
        this.form.patchValue({ basicSalary: employee.salary });
      }
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.editId = idParam ? Number(idParam) : null;

    forkJoin({
      employees: this.employeeService.getAll(),
      records: this.payrollService.getAll(),
    }).subscribe({
      next: ({ employees, records }) => {
        this.allRecords = records;
        this.employees.set(
          [...employees].sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
          ),
        );

        if (this.editId !== null) {
          const record = records.find((r) => r.id === this.editId);
          if (!record) {
            this.loadError.set('Payroll record not found.');
            this.loading.set(false);
            return;
          }
          if (record.status === 'Paid') {
            this.loadError.set('Paid payroll records are locked and cannot be edited.');
            this.loading.set(false);
            return;
          }

          this.form.patchValue({
            employeeId: record.employeeId,
            salaryMonth: record.salaryMonth,
            basicSalary: record.basicSalary,
            allowances: record.allowances,
            deductions: record.deductions,
            status: record.status,
          });

          // The employee and the month cannot change when editing
          this.form.controls.employeeId.disable();
          this.form.controls.salaryMonth.disable();
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load data. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  // Live net salary shown on the form
  netSalary(): number {
    const v = this.form.getRawValue();
    return calculateNetSalary(
      Number(v.basicSalary) || 0,
      Number(v.allowances) || 0,
      Number(v.deductions) || 0,
    );
  }

  errorOf(control: AbstractControl, label: string): string {
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.hasError('required')) return `${label} is required.`;
    if (control.hasError('pattern')) return 'Choose a valid month.';
    if (control.hasError('min')) {
      return control.getError('min').min === 0
        ? `${label} cannot be negative.`
        : `${label} must be greater than 0.`;
    }
    if (control.hasError('max')) return `${label} is too large.`;
    return `${label} is not valid.`;
  }

  isInvalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  // Show the "deductions too high" error only after the user interacted
  showDeductionError(): boolean {
    return (this.submitted() || this.f.deductions.touched) && this.form.hasError('deductionsTooHigh');
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // getRawValue() also includes the disabled controls (employee and month in Edit mode)
    const v = this.form.getRawValue();
    const payload: Omit<Payroll, 'id'> = {
      employeeId: v.employeeId,
      salaryMonth: v.salaryMonth,
      basicSalary: v.basicSalary,
      allowances: v.allowances,
      deductions: v.deductions,
      netSalary: calculateNetSalary(v.basicSalary, v.allowances, v.deductions),
      status: v.status,
    };

    // One payroll record per employee per month (ignore the record we are editing)
    const duplicate = this.allRecords.some(
      (r) =>
        r.id !== this.editId &&
        r.employeeId === payload.employeeId &&
        r.salaryMonth === payload.salaryMonth,
    );
    if (duplicate) {
      this.formError.set('This employee already has a payroll record for this month.');
      return;
    }

    this.formError.set('');
    this.saving.set(true);

    const request$ =
      this.editId === null
        ? this.payrollService.create(payload) // POST
        : this.payrollService.update(this.editId, { id: this.editId, ...payload }); // PUT

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(
          this.editId === null ? 'Payroll record added.' : 'Payroll record updated.',
        );
        this.router.navigate(['/payroll']);
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Could not save. Check that JSON Server is running and try again.');
      },
    });
  }
}
