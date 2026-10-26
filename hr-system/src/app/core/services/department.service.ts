import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_URL } from '../config/api.config';
import { Department } from '../models/department.model';
import { Employee } from '../models/employee.model';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private http = inject(HttpClient);
  private url = `${API_URL}/departments`;

  // GET /departments
  getAll(): Observable<Department[]> {
    return this.http.get<Department[]>(this.url);
  }

  // GET /departments/2
  getById(id: number): Observable<Department> {
    return this.http.get<Department>(`${this.url}/${id}`);
  }

  // POST /departments
  create(department: Omit<Department, 'id'>): Observable<Department> {
    return this.http.post<Department>(this.url, department);
  }

  // PUT /departments/2
  update(id: number, department: Department): Observable<Department> {
    return this.http.put<Department>(`${this.url}/${id}`, department);
  }

  // DELETE /departments/2
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  // GET /employees?departmentId=2  -> how many employees are in this department RIGHT NOW?
  countEmployees(departmentId: number): Observable<number> {
    return this.http
      .get<Employee[]>(`${API_URL}/employees`, { params: { departmentId } })
      .pipe(map((employees) => employees.length));
  }
}
