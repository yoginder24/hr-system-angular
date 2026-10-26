// Today as "YYYY-MM-DD" in the user's local time zone.
export function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Time between two "HH:MM" strings, like "8h 57m".
// Returns "-" if either time is missing or check-out is not later than check-in.
export function workedHours(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) {
    return '-';
  }

  const [inHour, inMinute] = checkIn.split(':').map(Number);
  const [outHour, outMinute] = checkOut.split(':').map(Number);
  const minutes = outHour * 60 + outMinute - (inHour * 60 + inMinute);

  if (Number.isNaN(minutes) || minutes <= 0) {
    return '-';
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// Number of calendar days from start to end, counting BOTH days.
// Example: 2026-10-20 to 2026-10-21 = 2 days. Returns 0 if a date is missing or the range is wrong.
export function leaveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) {
    return 0;
  }

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  // Date.UTC avoids daylight-saving surprises
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }
  return Math.round((end - start) / 86_400_000) + 1; // milliseconds in one day
}
