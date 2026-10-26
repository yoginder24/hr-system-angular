import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Department } from '../../../core/models/department.model';
import { Employee } from '../../../core/models/employee.model';
import { DepartmentService } from '../../../core/services/department.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-department-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './department-form.component.html',
})
export class DepartmentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private departmentService = inject(DepartmentService);
  private employeeService = inject(EmployeeService);
  private notify = inject(NotificationService);

  // null = adding. A number = editing that department.
  editId: number | null = null;

  employees = signal<Employee[]>([]);
  loading = signal(true);
  saving = signal(false);
  loadError = signal('');
  formError = signal('');

  // Used for the duplicate-name check
  private allDepartments: Department[] = [];

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
    managerId: [0], // 0 means "no manager"
  });

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
        this.allDepartments = departments;

        // Sort the manager dropdown by name
        this.employees.set(
          [...employees].sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
          ),
        );

        if (this.editId !== null) {
          const department = departments.find((d) => d.id === this.editId);
          if (!department) {
            this.loadError.set('Department not found.');
            this.loading.set(false);
            return;
          }
          this.form.patchValue({
            name: department.name,
            description: department.description,
            managerId: department.managerId ?? 0,
          });
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load data. Is JSON Server running? (npm run api)');
        this.loading.set(false);
      },
    });
  }

  errorOf(control: AbstractControl, label: string): string {
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.hasError('required')) return `${label} is required.`;
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

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: Omit<Department, 'id'> = {
      name: v.name.trim(),
      description: v.description.trim(),
      managerId: v.managerId === 0 ? null : v.managerId,
    };

    // Duplicate-name check (ignore the department we are editing)
    const duplicate = this.allDepartments.some(
      (d) => d.id !== this.editId && d.name.toLowerCase() === payload.name.toLowerCase(),
    );
    if (duplicate) {
      this.formError.set('A department with this name already exists.');
      return;
    }

    this.formError.set('');
    this.saving.set(true);

    const request$ =
      this.editId === null
        ? this.departmentService.create(payload) // POST
        : this.departmentService.update(this.editId, { id: this.editId, ...payload }); // PUT

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(
          this.editId === null ? 'Department added successfully.' : 'Department updated successfully.',
        );
        this.router.navigate(['/departments']);
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Could not save. Check that JSON Server is running and try again.');
      },
    });
  }
}
