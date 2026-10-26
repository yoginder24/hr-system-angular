// A union type: the value can only be one of these three strings.
export type UserRole = 'Admin' | 'HR' | 'Employee';

// Shape of one record in db.json -> "users"
export interface User {
  id: number;
  email: string;
  password: string; // DEMO ONLY. Real systems never store plain passwords.
  role: UserRole;
  employeeId: number; // links to employees.id
}

// What we keep in the browser after login. Notice: NO password.
export interface SessionUser {
  id: number;
  email: string;
  role: UserRole;
  employeeId: number;
  name: string;
}
