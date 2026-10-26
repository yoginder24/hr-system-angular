import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../config/api.config';
import { Payroll } from '../models/payroll.model';

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private http = inject(HttpClient);
  private url = `${API_URL}/payroll`;

  // GET /payroll
  getAll(): Observable<Payroll[]> {
    return this.http.get<Payroll[]>(this.url);
  }

  // GET /payroll?employeeId=3  (used for the Employee role)
  getByEmployee(employeeId: number): Observable<Payroll[]> {
    return this.http.get<Payroll[]>(this.url, { params: { employeeId } });
  }

  // GET /payroll/1
  getById(id: number): Observable<Payroll> {
    return this.http.get<Payroll>(`${this.url}/${id}`);
  }

  // POST /payroll
  create(record: Omit<Payroll, 'id'>): Observable<Payroll> {
    return this.http.post<Payroll>(this.url, record);
  }

  // PUT /payroll/1
  update(id: number, record: Payroll): Observable<Payroll> {
    return this.http.put<Payroll>(`${this.url}/${id}`, record);
  }

  // DELETE /payroll/1
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
