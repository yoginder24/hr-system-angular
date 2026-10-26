import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../config/api.config';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private url = `${API_URL}/users`;

  // GET /users
  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.url);
  }

  // POST /users
  create(user: Omit<User, 'id'>): Observable<User> {
    return this.http.post<User>(this.url, user);
  }

  // PUT /users/5  (replaces the whole record)
  update(id: number, user: User): Observable<User> {
    return this.http.put<User>(`${this.url}/${id}`, user);
  }

  // DELETE /users/5
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
