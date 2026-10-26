import { AttendanceStatus } from '../models/attendance.model';
import { EmploymentStatus } from '../models/employee.model';
import { LeaveStatus } from '../models/leave.model';
import { PayrollStatus } from '../models/payroll.model';

// Each function returns a Bootstrap badge color class for a status.

export function employeeStatusClass(status: EmploymentStatus): string {
  switch (status) {
    case 'Active':
      return 'text-bg-success';
    case 'On Leave':
      return 'text-bg-warning';
    default:
      return 'text-bg-secondary';
  }
}

export function attendanceStatusClass(status: AttendanceStatus): string {
  switch (status) {
    case 'Present':
      return 'text-bg-success';
    case 'Late':
      return 'text-bg-warning';
    case 'Half Day':
      return 'text-bg-info';
    default:
      return 'text-bg-danger';
  }
}

export function leaveStatusClass(status: LeaveStatus): string {
  switch (status) {
    case 'Approved':
      return 'text-bg-success';
    case 'Rejected':
      return 'text-bg-danger';
    default:
      return 'text-bg-warning';
  }
}

export function payrollStatusClass(status: PayrollStatus): string {
  switch (status) {
    case 'Paid':
      return 'text-bg-success';
    case 'Processed':
      return 'text-bg-primary';
    default:
      return 'text-bg-secondary';
  }
}
