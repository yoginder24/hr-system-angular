import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
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

import { Attendance, AttendanceStatus } from '../../../core/models/attendance.model';
import { Employee } from '../../../core/models/employee.model';
import { AttendanceService } from '../../../core/services/attendance.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { todayString } from '../../../core/utils/date.utils';

// Field validator: the date must not be after today.
// "YYYY-MM-DD" strings can be compared directly as text.
function notInFuture(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  if (!value) {
    return null; // "required" handles empty values
  }
  return value <= todayString() ? null : { futureDate: true };
}

// Group validator: looks at several fields at once.
const timesValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const status = group.get('status')?.value as AttendanceStatus;
  const checkIn = group.get('checkIn')?.value as string;
  const checkOut = group.get('checkOut')?.value as string;

  if (status === 'Absent') {
    return null; // no times needed
  }

  const errors: ValidationErrors = {};
  if (!checkIn) {
    errors['checkInRequired'] = true;
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    errors['checkOutNotLater'] = true;
  }
  return Object.keys(errors).length > 0 ? errors : null;
};

@Component({
  selector: 'app-attendance-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './attendance-form.component.html',
})
export class AttendanceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private attendanceService = inject(AttendanceService);
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
  isAbsent = signal(false); // hides the time fields

  today = todayString(); // used as the "max" of the date picker
  statuses: AttendanceStatus[] = ['Present', 'Late', 'Half Day', 'Absent'];

  // Used for the duplicate check on save
  private allRecords: Attendance[] = [];

  // The record being edited. A PUT replaces the whole record, so we keep its extra fields
  // (employee name, server timestamp, location, source) instead of losing them.
  private existingRecord: Attendance | null = null;

  form = this.fb.nonNullable.group(
    {
      employeeId: [0, [Validators.min(1)]], // 0 = nothing selected yet
      date: ['', [Validators.required, notInFuture]],
      status: ['Present' as AttendanceStatus, Validators.required],
      checkIn: [''],
      checkOut: [''],
    },
    { validators: timesValidator },
  );

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.editId = idParam ? Number(idParam) : null;

    forkJoin({
      employees: this.employeeService.getAll(),
      records: this.attendanceService.getAll(),
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
            this.loadError.set('Attendance record not found.');
            this.loading.set(false);
            return;
          }
          this.existingRecord = record;
          this.form.patchValue({
            employeeId: record.employeeId,
            date: record.date,
            status: record.status,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
          });
          this.isAbsent.set(record.status === 'Absent');
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load data. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  // Called when the status dropdown changes
  onStatusChange(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as AttendanceStatus;
    this.isAbsent.set(status === 'Absent');

    if (status === 'Absent') {
      this.form.patchValue({ checkIn: '', checkOut: '' });
    }
  }

  errorOf(control: AbstractControl, label: string): string {
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.hasError('required')) return `${label} is required.`;
    if (control.hasError('min')) return `Please select an ${label.toLowerCase()}.`;
    if (control.hasError('futureDate')) return 'Date cannot be in the future.';
    return `${label} is not valid.`;
  }

  isInvalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  // Show the group-level (time) errors only after the user has interacted
  showTimeErrors(): boolean {
    return this.submitted() || this.f.checkIn.touched || this.f.checkOut.touched;
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const employee = this.employees().find((e) => e.id === v.employeeId);
    const payload: Omit<Attendance, 'id'> = {
      employeeId: v.employeeId,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
      date: v.date,
      status: v.status,
      checkIn: v.status === 'Absent' ? '' : v.checkIn,
      checkOut: v.status === 'Absent' ? '' : v.checkOut,
    };

    // One record per employee per date (ignore the record we are editing)
    const duplicate = this.allRecords.some(
      (r) => r.id !== this.editId && r.employeeId === payload.employeeId && r.date === payload.date,
    );
    if (duplicate) {
      this.formError.set('This employee already has a record for this date. Edit that record instead.');
      return;
    }

    this.formError.set('');
    this.saving.set(true);

    const request$ =
      this.editId === null
        ? this.attendanceService.create({ ...payload, source: 'manual' }) // POST
        : this.attendanceService.update(this.editId, { ...this.existingRecord, id: this.editId, ...payload }); // PUT

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(
          this.editId === null ? 'Attendance record added.' : 'Attendance record updated.',
        );
        this.router.navigate(['/attendance']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(
          err.status === 409
            ? (err.error?.message ?? 'This employee already has a record for this date.')
            : 'Could not save. Check that JSON Server is running and try again.',
        );
      },
    });
  }
}
