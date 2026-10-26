import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../config/api.config';
import { Attendance, AttendanceLocation, TodayAttendance } from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private http = inject(HttpClient);
  private url = `${API_URL}/attendance`;

  // GET /attendance
  getAll(): Observable<Attendance[]> {
    return this.http.get<Attendance[]>(this.url);
  }

  // GET /attendance?employeeId=3  (used for the Employee role)
  getByEmployee(employeeId: number): Observable<Attendance[]> {
    return this.http.get<Attendance[]>(this.url, { params: { employeeId } });
  }

  // GET /attendance/today?employeeId=3  -> today's record by the SERVER date
  today(employeeId: number): Observable<TodayAttendance> {
    return this.http.get<TodayAttendance>(`${this.url}/today`, { params: { employeeId } });
  }

  // POST /attendance/punch-in
  // We send ONLY who is punching in (and the optional location). The server decides the
  // date, the time and the status, so they cannot be faked from the browser.
  punchIn(employeeId: number, location?: AttendanceLocation): Observable<Attendance> {
    return this.http.post<Attendance>(`${this.url}/punch-in`, location ? { employeeId, location } : { employeeId });
  }

  // POST /attendance
  create(record: Omit<Attendance, 'id'>): Observable<Attendance> {
    return this.http.post<Attendance>(this.url, record);
  }

  // PUT /attendance/5
  update(id: number, record: Attendance): Observable<Attendance> {
    return this.http.put<Attendance>(`${this.url}/${id}`, record);
  }

  // DELETE /attendance/5
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
