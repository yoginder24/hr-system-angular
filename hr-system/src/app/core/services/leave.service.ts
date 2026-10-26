import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { API_URL } from '../config/api.config';
import { LeaveRequest } from '../models/leave.model';
import { todayString } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private url = `${API_URL}/leaveRequests`;

  // GET /leaveRequests
  getAll(): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(this.url);
  }

  // GET /leaveRequests?employeeId=3  (used for the Employee role)
  getByEmployee(employeeId: number): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(this.url, { params: { employeeId } });
  }

  // GET /leaveRequests/1
  getById(id: number): Observable<LeaveRequest> {
    return this.http.get<LeaveRequest>(`${this.url}/${id}`);
  }

  // POST /leaveRequests
  create(request: Omit<LeaveRequest, 'id'>): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(this.url, request);
  }

  // Approve or reject a request. All the rules are checked here, in ONE place.
  // PATCH /leaveRequests/1  with only the fields that change.
  review(id: number, status: 'Approved' | 'Rejected'): Observable<LeaveRequest> {
    const reviewer = this.auth.currentUser();

    // Rule 1: only users with the "leave.approve" permission
    if (!reviewer || !this.auth.hasPermission('leave.approve')) {
      return throwError(() => new Error('You are not allowed to approve or reject leave requests.'));
    }

    // Fetch the LATEST version from the server, then check the other rules
    return this.getById(id).pipe(
      switchMap((request) => {
        // Rule 2: nobody reviews their own request
        if (request.employeeId === reviewer.employeeId) {
          return throwError(() => new Error('You cannot approve or reject your own leave request.'));
        }

        // Rule 3: only Pending requests can be reviewed
        if (request.status !== 'Pending') {
          return throwError(() => new Error(`This request is already ${request.status.toLowerCase()}.`));
        }

        return this.http.patch<LeaveRequest>(`${this.url}/${id}`, {
          status,
          reviewedBy: reviewer.employeeId,
          reviewedOn: todayString(),
        });
      }),
    );
  }
}
