export type LeaveType = 'Casual' | 'Sick' | 'Annual' | 'Unpaid';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

// Shape of one record in db.json -> "leaveRequests"
export interface LeaveRequest {
  id: number;
  employeeId: number; // who applied (links to employees.id)
  leaveType: LeaveType;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  reason: string;
  status: LeaveStatus;
  appliedOn: string; // "YYYY-MM-DD"
  reviewedBy: number | null; // employee id of the Admin/HR who decided, or null
  reviewedOn?: string; // optional: date of the decision
}
