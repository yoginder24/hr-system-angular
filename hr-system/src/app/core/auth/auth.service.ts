import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, switchMap } from 'rxjs';

import { API_URL } from '../config/api.config';
import { Employee } from '../models/employee.model';
import { SessionUser, User, UserRole } from '../models/user.model';
import { Permission, ROLE_PERMISSIONS } from './permissions';

const SESSION_KEY = 'hr_session';
const VALID_ROLES: UserRole[] = ['Admin', 'HR', 'Employee'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // The logged-in user (or null). Starts from localStorage so a page refresh keeps you logged in.
  private userSignal = signal<SessionUser | null>(this.loadSession());

  // Read-only copy for other classes. They can read it but not change it.
  currentUser = this.userSignal.asReadonly();

  // true when somebody is logged in. "computed" recalculates automatically.
  isLoggedIn = computed(() => this.userSignal() !== null);

  // ---------- LOGIN ----------
  login(email: string, password: string): Observable<SessionUser> {
    const cleanEmail = email.trim().toLowerCase();

    // GET http://localhost:3000/users?email=...
    return this.http.get<User[]>(`${API_URL}/users`, { params: { email: cleanEmail } }).pipe(
      // Step 1: find the user whose password matches
      map((users) => {
        const user = users.find((u) => u.password === password);
        if (!user) {
          throw new Error('Invalid email or password.');
        }
        return user;
      }),

      // Step 2: load the employee record, then build the session
      switchMap((user) =>
        this.http.get<Employee>(`${API_URL}/employees/${user.employeeId}`).pipe(
          map((employee) => {
            if (employee.employmentStatus === 'Inactive') {
              throw new Error('This account is inactive. Please contact HR.');
            }

            const session: SessionUser = {
              id: user.id,
              email: user.email,
              role: user.role,
              employeeId: user.employeeId,
              name: `${employee.firstName} ${employee.lastName}`,
            };

            this.saveSession(session);
            this.userSignal.set(session);
            return session;
          }),
        ),
      ),
    );
  }

  // ---------- LOGOUT ----------
  logout(): void {
    localStorage.removeItem(SESSION_KEY); // clear the saved session
    this.userSignal.set(null); // clear the in-memory user
    this.router.navigate(['/login']);
  }

  // ---------- PERMISSIONS ----------
  hasPermission(permission: Permission): boolean {
    const user = this.userSignal();
    if (!user) {
      return false;
    }
    return ROLE_PERMISSIONS[user.role].includes(permission);
  }

  // true if the user has AT LEAST ONE of the given permissions
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  // Where should a logged-in user land? All roles share one dashboard URL;
  // the dashboard page shows different content per role.
  homeRoute(): string {
    return this.userSignal() ? '/dashboard' : '/login';
  }

  // ---------- SESSION STORAGE ----------
  private saveSession(session: SessionUser): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Storage may be blocked (private mode). The app still works until refresh.
    }
  }

  private loadSession(): SessionUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }
      const data = JSON.parse(raw) as SessionUser;
      const looksValid =
        typeof data.id === 'number' &&
        typeof data.name === 'string' &&
        VALID_ROLES.includes(data.role);
      return looksValid ? data : null;
    } catch {
      return null; // broken JSON, treat as logged out
    }
  }
}
