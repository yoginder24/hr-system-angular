import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

import { AuthService } from '../../../core/auth/auth.service';
import { Employee } from '../../../core/models/employee.model';
import { User, UserRole } from '../../../core/models/user.model';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UserService } from '../../../core/services/user.service';

// At least 8 characters, with at least one letter and one number.
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// Group validator: password and confirm password must be the same.
const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return password !== confirm ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private employeeService = inject(EmployeeService);
  private notify = inject(NotificationService);

  // null = adding. A number = editing that user account.
  editId: number | null = null;
  isOwnAccount = false;

  employees = signal<Employee[]>([]);
  loading = signal(true);
  saving = signal(false);
  loadError = signal('');
  formError = signal('');
  submitted = signal(false);
  showPassword = signal(false);

  roles: UserRole[] = ['Admin', 'HR', 'Employee'];

  private allUsers: User[] = [];
  private existingUser: User | null = null;

  // When ADDING: only employees that do not have an account yet.
  // When EDITING: the employee cannot be changed, so we show just that one.
  employeeOptions = computed(() => {
    const takenIds = new Set(this.allUsers.map((u) => u.employeeId));
    return this.employees()
      .filter((e) => (this.editId === null ? !takenIds.has(e.id) : e.id === this.existingUser?.employeeId))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  });

  form = this.fb.nonNullable.group(
    {
      employeeId: [0, [Validators.min(1)]], // 0 = nothing selected yet
      email: ['', [Validators.required, Validators.email]],
      role: ['Employee' as UserRole, Validators.required],
      password: [''],
      confirmPassword: [''],
    },
    { validators: passwordsMatch },
  );

  get f() {
    return this.form.controls;
  }

  constructor() {
    // When an employee is picked (Add mode), suggest their work email as the login email.
    // We do not overwrite the email if the admin already typed something.
    this.form.controls.employeeId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      if (this.editId !== null || this.form.controls.email.dirty) {
        return;
      }
      const employee = this.employees().find((e) => e.id === id);
      if (employee) {
        this.form.patchValue({ email: employee.email.toLowerCase() });
      }
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.editId = idParam ? Number(idParam) : null;

    forkJoin({
      users: this.userService.getAll(),
      employees: this.employeeService.getAll(),
    }).subscribe({
      next: ({ users, employees }) => {
        this.allUsers = users;
        this.employees.set(employees);

        if (this.editId === null) {
          // New account: the password is required
          this.f.password.setValidators([Validators.required, Validators.pattern(PASSWORD_PATTERN)]);
          this.f.confirmPassword.setValidators([Validators.required]);
        } else {
          const user = users.find((u) => u.id === this.editId);
          if (!user) {
            this.loadError.set('User account not found.');
            this.loading.set(false);
            return;
          }

          this.existingUser = user;
          this.isOwnAccount = user.id === this.auth.currentUser()?.id;

          // Edit account: the password is optional (leave it empty to keep the old one)
          this.f.password.setValidators([Validators.pattern(PASSWORD_PATTERN)]);

          this.form.patchValue({ employeeId: user.employeeId, email: user.email, role: user.role });

          // The employee cannot change. Nobody can change their OWN role (it would lock them out).
          this.f.employeeId.disable();
          if (this.isOwnAccount) {
            this.f.role.disable();
          }
        }

        this.f.password.updateValueAndValidity();
        this.f.confirmPassword.updateValueAndValidity();
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load data. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  toggleShowPassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  errorOf(control: AbstractControl, label: string): string {
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.hasError('required')) return `${label} is required.`;
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('pattern')) return 'Use at least 8 characters with a letter and a number.';
    if (control.hasError('min')) return 'Please select an employee.';
    return `${label} is not valid.`;
  }

  isInvalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  showMismatch(): boolean {
    return (this.submitted() || this.f.confirmPassword.touched) && this.form.hasError('passwordMismatch');
  }

  employeeLabel(): string {
    const e = this.employeeOptions()[0];
    return e ? `${e.firstName} ${e.lastName} (${e.employeeCode})` : '';
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // getRawValue() also includes disabled controls (employee, and role of your own account)
    const v = this.form.getRawValue();
    const email = v.email.trim().toLowerCase();

    const others = this.allUsers.filter((u) => u.id !== this.editId);
    if (others.some((u) => u.email.toLowerCase() === email)) {
      this.formError.set('Another account already uses this email.');
      return;
    }
    if (others.some((u) => u.employeeId === v.employeeId)) {
      this.formError.set('This employee already has a user account.');
      return;
    }

    // Do not remove the last Admin
    if (this.existingUser?.role === 'Admin' && v.role !== 'Admin') {
      const admins = this.allUsers.filter((u) => u.role === 'Admin').length;
      if (admins <= 1) {
        this.formError.set('At least one Admin account must remain.');
        return;
      }
    }

    const payload: Omit<User, 'id'> = {
      email,
      // Edit: an empty password field means "keep the current password"
      password: v.password !== '' ? v.password : (this.existingUser?.password ?? ''),
      role: v.role,
      employeeId: v.employeeId,
    };

    this.formError.set('');
    this.saving.set(true);

    const request$ =
      this.editId === null
        ? this.userService.create(payload) // POST
        : this.userService.update(this.editId, { id: this.editId, ...payload }); // PUT

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(
          this.editId === null ? 'User account created.' : 'User account updated.',
        );
        this.router.navigate(['/users']);
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Could not save. Check that JSON Server is running and try again.');
      },
    });
  }
}
