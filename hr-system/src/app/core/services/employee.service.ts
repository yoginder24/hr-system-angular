import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../config/api.config';
import { Employee } from '../models/employee.model';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private http = inject(HttpClient);
  private url = `${API_URL}/employees`;

  // GET /employees
  getAll(): Observable<Employee[]> {
    return this.http.get<Employee[]>(this.url);
  }

  // GET /employees/3
  getById(id: number): Observable<Employee> {
    return this.http.get<Employee>(`${this.url}/${id}`);
  }

  // POST /employees  (the server creates the id)
  // Omit<Employee, 'id'> means "an Employee without the id field"
  create(employee: Omit<Employee, 'id'>): Observable<Employee> {
    return this.http.post<Employee>(this.url, employee);
  }

  // PUT /employees/3  (replaces the whole record)
  update(id: number, employee: Employee): Observable<Employee> {
    return this.http.put<Employee>(`${this.url}/${id}`, employee);
  }

  // DELETE /employees/3?_dependent=users
  // "_dependent=users" also deletes the login account that belongs to this employee.
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { params: { _dependent: 'users' } });
  }
}
