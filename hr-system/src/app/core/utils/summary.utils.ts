import { Attendance, AttendanceStatus } from '../models/attendance.model';
import { LeaveRequest, LeaveStatus } from '../models/leave.model';
import { leaveDays } from './date.utils';

// DEMO VALUE: not a real leave policy.
export const DEMO_ANNUAL_LEAVE_DAYS = 18;

// One dashboard card
export interface StatCard {
  title: string;
  icon: string;
  color: string; // Bootstrap color name: primary, success, info, warning...
  value: string;
  hint: string;
}

export interface LeaveSummary {
  allowance: number;
  used: number;
  pending: number;
  remaining: number;
}

// Demo leave summary for one person.
// Counts Casual, Sick and Annual leave that STARTS in the given year.
// (A leave that crosses New Year is counted in the year it starts. This is a simplification.)
export function leaveSummary(requests: LeaveRequest[], year: number): LeaveSummary {
  const thisYear = requests.filter(
    (r) => r.leaveType !== 'Unpaid' && r.startDate.startsWith(`${year}-`),
  );

  const daysWithStatus = (status: LeaveStatus): number =>
    thisYear
      .filter((r) => r.status === status)
      .reduce((sum, r) => sum + leaveDays(r.startDate, r.endDate), 0);

  const used = daysWithStatus('Approved');
  const pending = daysWithStatus('Pending');

  return {
    allowance: DEMO_ANNUAL_LEAVE_DAYS,
    used,
    pending,
    remaining: Math.max(0, DEMO_ANNUAL_LEAVE_DAYS - used),
  };
}

export interface DayAttendanceSummary {
  date: string;
  total: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
}

// Attendance counts for the most recent date that has records.
// Returns null when there are no records at all.
export function latestDayAttendance(records: Attendance[]): DayAttendanceSummary | null {
  if (records.length === 0) {
    return null;
  }

  // "YYYY-MM-DD" strings can be compared as plain text
  const latest = records.reduce((max, r) => (r.date > max ? r.date : max), '');
  const day = records.filter((r) => r.date === latest);
  const count = (status: AttendanceStatus): number => day.filter((r) => r.status === status).length;

  return {
    date: latest,
    total: day.length,
    present: count('Present'),
    late: count('Late'),
    halfDay: count('Half Day'),
    absent: count('Absent'),
  };
}

// How many different employees have an APPROVED leave that covers today?
export function countOnLeaveToday(requests: LeaveRequest[], today: string): number {
  const ids = new Set(
    requests
      .filter((r) => r.status === 'Approved' && r.startDate <= today && today <= r.endDate)
      .map((r) => r.employeeId),
  );
  return ids.size;
}
