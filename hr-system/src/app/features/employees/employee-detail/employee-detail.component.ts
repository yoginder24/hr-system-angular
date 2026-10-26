import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Employee } from '../../../core/models/employee.model';
import { DepartmentService } from '../../../core/services/department.service';
import { EmployeeService } from '../../../core/services/employee.service';

@Component({
  selector: 'app-employee-detail',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './employee-detail.component.html',
})
export class EmployeeDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);

  employee = signal<Employee | null>(null);
  departmentName = signal('');
  loading = signal(true);
  errorMessage = signal('');

  canEdit = this.auth.hasPermission('employees.edit');
  canSeeSalary = this.auth.hasPermission('payroll.viewAll');
  canViewProfile = this.auth.hasPermission('profile.viewAny');

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isInteger(id) || id < 1) {
      this.errorMessage.set('Invalid employee id.');
      this.loading.set(false);
      return;
    }

    forkJoin({
      employee: this.employeeService.getById(id),
      departments: this.departmentService.getAll(),
    }).subscribe({
      next: ({ employee, departments }) => {
        this.employee.set(employee);
        this.departmentName.set(
          departments.find((d) => d.id === employee.departmentId)?.name ?? 'Unknown',
        );
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(
          err.status === 404 ? 'Employee not found.' : 'Could not load the employee. Is JSON Server running?',
        );
        this.loading.set(false);
      },
    });
  }
}
