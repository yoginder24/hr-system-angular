import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { LeaveRequest, LeaveType } from '../../../core/models/leave.model';
import { LeaveService } from '../../../core/services/leave.service';
import { NotificationService } from '../../../core/services/notification.service';
import { leaveDays, todayString } from '../../../core/utils/date.utils';

// Field validator: the start date cannot be before today.
function notInPast(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  if (!value) {
    return null; // "required" handles empty values
  }
  return value >= todayString() ? null : { pastDate: true };
}

// Group validator: the end date cannot be earlier than the start date.
const dateRangeValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const start = group.get('startDate')?.value as string;
  const end = group.get('endDate')?.value as string;
  return start && end && end < start ? { endBeforeStart: true } : null;
};

@Component({
  selector: 'app-leave-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './leave-form.component.html',
})
export class LeaveFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private leaveService = inject(LeaveService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  leaveTypes: LeaveType[] = ['Casual', 'Sick', 'Annual', 'Unpaid'];
  today = todayString();

  loading = signal(true);
  saving = signal(false);
  loadError = signal('');
  formError = signal('');
  submitted = signal(false);

  // This person's existing requests, used for the overlap check
  private myRequests: LeaveRequest[] = [];
  private ownEmployeeId = this.auth.currentUser()?.employeeId ?? 0;

  form = this.fb.nonNullable.group(
    {
      leaveType: ['Casual' as LeaveType, Validators.required],
      startDate: ['', [Validators.required, notInPast]],
      endDate: ['', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
    },
    { validators: dateRangeValidator },
  );

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.leaveService.getByEmployee(this.ownEmployeeId).subscribe({
      next: (requests) => {
        this.myRequests = requests;
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load data. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  // Live total shown under the dates (0 while a date is missing or the range is wrong)
  totalDays(): number {
    const v = this.form.getRawValue();
    return leaveDays(v.startDate, v.endDate);
  }

  errorOf(control: AbstractControl, label: string): string {
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.hasError('required')) return `${label} is required.`;
    if (control.hasError('pastDate')) return 'Start date cannot be in the past.';
    if (control.hasError('minlength')) {
      return `${label} must be at least ${control.getError('minlength').requiredLength} characters.`;
    }
    if (control.hasError('maxlength')) {
      return `${label} must be at most ${control.getError('maxlength').requiredLength} characters.`;
    }
    return `${label} is not valid.`;
  }

  isInvalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  // Show the "end before start" error only after the user interacted
  showRangeError(): boolean {
    return (this.submitted() || this.f.endDate.touched) && this.form.hasError('endBeforeStart');
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    // Overlap check: ignore rejected requests
    const overlapping = this.myRequests.find(
      (r) =>
        (r.status === 'Pending' || r.status === 'Approved') &&
        r.startDate <= v.endDate &&
        v.startDate <= r.endDate,
    );
    if (overlapping) {
      this.formError.set(
        `These dates overlap with your ${overlapping.status.toLowerCase()} request (${overlapping.startDate} to ${overlapping.endDate}).`,
      );
      return;
    }

    const payload: Omit<LeaveRequest, 'id'> = {
      employeeId: this.ownEmployeeId, // always the logged-in person
      leaveType: v.leaveType,
      startDate: v.startDate,
      endDate: v.endDate,
      reason: v.reason.trim(),
      status: 'Pending', // every new request starts as Pending
      appliedOn: todayString(),
      reviewedBy: null,
    };

    this.formError.set('');
    this.saving.set(true);

    this.leaveService.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success('Leave request submitted. It is now pending approval.');
        this.router.navigate(['/leave']);
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Could not submit. Check that JSON Server is running and try again.');
      },
    });
  }
}
