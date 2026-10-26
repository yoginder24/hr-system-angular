export type Gender = 'Male' | 'Female' | 'Other';
export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Intern';
export type EmploymentStatus = 'Active' | 'On Leave' | 'Inactive';

// Shape of one record in db.json -> "employees"
export interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: Gender;
  dateOfBirth: string; // "YYYY-MM-DD"
  departmentId: number;
  designation: string;
  joiningDate: string; // "YYYY-MM-DD"
  employmentType: EmploymentType;
  salary: number;
  employmentStatus: EmploymentStatus;
  address: string;
  profileImageUrl?: string; // the "?" means optional
}
