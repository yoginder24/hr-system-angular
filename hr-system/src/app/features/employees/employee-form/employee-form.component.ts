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

import { Department } from '../../../core/models/department.model';
import {
  Employee,
  EmploymentStatus,
  EmploymentType,
  Gender,
} from '../../../core/models/employee.model';
import { DepartmentService } from '../../../core/services/department.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';

// A custom validator: returns null when the value is OK, or an error object when it is not.
function minimumAge(minYears: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) {
      return null; // "required" already handles empty values
    }
    const limit = new Date();
    limit.setFullYear(limit.getFullYear() - minYears);
    return new Date(value) <= limit ? null : { minimumAge: true };
  };
}

@Component({
  selector: 'app-employee-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './employee-form.component.html',
})
export class EmployeeFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private notify = inject(NotificationService);

  // null = we are adding. A number = we are editing that employee.
  editId: number | null = null;

  departments = signal<Department[]>([]);
  loading = signal(true);
  saving = signal(false);
  loadError = signal('');
  formError = signal('');

  // Used for the duplicate check on save
  private allEmployees: Employee[] = [];

  // Options for the dropdowns
  genders: Gender[] = ['Male', 'Female', 'Other'];
  employmentTypes: EmploymentType[] = ['Full-time', 'Part-time', 'Contract', 'Intern'];
  statuses: EmploymentStatus[] = ['Active', 'On Leave', 'Inactive'];

  form = this.fb.nonNullable.group({
    employeeCode: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{3,15}$/)]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s]{10,15}$/)]],
    gender: ['Male' as Gender, Validators.required],
    dateOfBirth: ['', [Validators.required, minimumAge(18)]],
    departmentId: [0, [Validators.min(1)]], // 0 = nothing selected yet
    designation: ['', [Validators.required, Validators.minLength(2)]],
    joiningDate: ['', Validators.required],
    employmentType: ['Full-time' as EmploymentType, Validators.required],
    salary: [0, [Validators.required, Validators.min(1)]],
    employmentStatus: ['Active' as EmploymentStatus, Validators.required],
    address: ['', [Validators.required, Validators.minLength(5)]],
    profileImageUrl: ['', Validators.pattern(/^(https?:\/\/\S+)?$/)], // optional
  });

  // Shortcut: f.firstName instead of form.controls.firstName
  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.editId = idParam ? Number(idParam) : null;

    forkJoin({
      departments: this.departmentService.getAll(),
      employees: this.employeeService.getAll(),
    }).subscribe({
      next: ({ departments, employees }) => {
        this.departments.set(departments);
        this.allEmployees = employees;

        if (this.editId !== null) {
          const employee = employees.find((e) => e.id === this.editId);
          if (!employee) {
            this.loadError.set('Employee not found.');
            this.loading.set(false);
            return;
          }
          // Fill the form with the existing values
          this.form.patchValue({ ...employee, profileImageUrl: employee.profileImageUrl ?? '' });
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load data. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  // Turns validation errors into a readable message (empty string = no error to show)
  errorOf(control: AbstractControl, label: string): string {
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.hasError('required')) return `${label} is required.`;
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('minlength')) return `${label} is too short.`;
    if (control.hasError('pattern')) return `${label} format is not valid.`;
    if (control.hasError('min')) return `Please choose or enter a valid ${label.toLowerCase()}.`;
    if (control.hasError('minimumAge')) return 'Employee must be at least 18 years old.';
    return `${label} is not valid.`;
  }

  isInvalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // show every error
      return;
    }

    const v = this.form.getRawValue();
    const payload: Omit<Employee, 'id'> = {
      ...v,
      employeeCode: v.employeeCode.trim().toUpperCase(),
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim().toLowerCase(),
      phone: v.phone.trim(),
      designation: v.designation.trim(),
      address: v.address.trim(),
      profileImageUrl: v.profileImageUrl.trim(),
    };

    // Duplicate check (ignore the employee we are editing)
    const others = this.allEmployees.filter((e) => e.id !== this.editId);
    if (others.some((e) => e.employeeCode === payload.employeeCode)) {
      this.formError.set('Another employee already uses this employee code.');
      return;
    }
    if (others.some((e) => e.email.toLowerCase() === payload.email)) {
      this.formError.set('Another employee already uses this email address.');
      return;
    }

    this.formError.set('');
    this.saving.set(true);

    const request$ =
      this.editId === null
        ? this.employeeService.create(payload) // POST
        : this.employeeService.update(this.editId, { id: this.editId, ...payload }); // PUT

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(
          this.editId === null ? 'Employee added successfully.' : 'Employee updated successfully.',
        );
        this.router.navigate(['/employees']);
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Could not save. Check that JSON Server is running and try again.');
      },
    });
  }
}
