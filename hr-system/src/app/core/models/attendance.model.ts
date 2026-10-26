export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day';

// Optional GPS reading, saved only when the employee chose to share their location.
export interface AttendanceLocation {
  lat: number;
  lng: number;
  accuracy: number; // metres
}

// Shape of one record in db.json -> "attendance"
export interface Attendance {
  id: number;
  employeeId: number; // links to employees.id
  employeeName?: string; // saved at punch-in time (older records do not have it)
  date: string; // "YYYY-MM-DD"
  checkIn: string; // "HH:MM" (24-hour), or "" when absent
  checkOut: string; // "HH:MM", or "" when not entered yet
  status: AttendanceStatus;
  checkedInAt?: string; // exact server timestamp (ISO) of a self punch-in
  source?: 'self' | 'manual'; // 'self' = employee used "Mark Present"; 'manual' = typed by HR/Admin
  location?: AttendanceLocation;
}

// Answer of GET /attendance/today
export interface TodayAttendance {
  date: string; // today's date according to the SERVER
  record: Attendance | null;
  officeLocationRequired: boolean;
}
