import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, output, signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { AttendanceLocation, TodayAttendance } from '../../../core/models/attendance.model';
import { AttendanceService } from '../../../core/services/attendance.service';
import { NotificationService } from '../../../core/services/notification.service';
import { workedHours } from '../../../core/utils/date.utils';
import { attendanceStatusClass } from '../../../core/utils/status.utils';

// "Today's attendance" card with the Mark Present button.
// It is used on the Admin, HR and Employee dashboards, and always works for the
// logged-in user's OWN account.
@Component({
  selector: 'app-punch-card',
  imports: [DatePipe],
  templateUrl: './punch-card.component.html',
  host: { class: 'd-block h-100' },
})
export class PunchCardComponent implements OnInit {
  private auth = inject(AuthService);
  private attendanceService = inject(AttendanceService);
  private notify = inject(NotificationService);

  // Tells the dashboard "attendance changed" so it can refresh its own tables
  punched = output<void>();

  // The employee id always comes from the logged-in session, never from user input
  private employeeId = this.auth.currentUser()?.employeeId ?? 0;
  canMark = this.auth.hasPermission('attendance.markOwn');

  today = signal<TodayAttendance | null>(null);
  loading = signal(true);
  loadError = signal('');

  punching = signal(false);
  errorMessage = signal('');

  // Optional GPS. It is OFF until the person ticks the box, and the browser asks permission.
  readonly locationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  shareLocation = signal(false);

  statusClass = attendanceStatusClass;

  record = computed(() => this.today()?.record ?? null);
  serverDate = computed(() => this.today()?.date ?? '');
  locationRequired = computed(() => this.today()?.officeLocationRequired ?? false);
  hours = computed(() => {
    const r = this.record();
    return r ? workedHours(r.checkIn, r.checkOut) : '-';
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.employeeId < 1) {
      this.loadError.set('Your account is not linked to an employee record.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set('');

    this.attendanceService.today(this.employeeId).subscribe({
      next: (today) => {
        this.today.set(today);
        // When the office location is required, the box is ticked for the person
        this.shareLocation.set(today.officeLocationRequired && this.locationSupported);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadError.set(
          err.status === 404
            ? 'Attendance service not found. Start the API with "npm run api" (not "api:basic").'
            : 'Could not load attendance. Is JSON Server running? (npm run api)',
        );
        this.loading.set(false);
      },
    });
  }

  onLocationToggle(event: Event): void {
    this.shareLocation.set((event.target as HTMLInputElement).checked);
    this.errorMessage.set('');
  }

  async punchIn(): Promise<void> {
    // Guard against double clicks and against an already existing record
    if (this.punching() || this.record() || !this.canMark) {
      return;
    }

    this.errorMessage.set('');
    this.punching.set(true);

    // Only ask for GPS when the person ticked the box (the browser shows its own permission prompt)
    let location: AttendanceLocation | undefined;
    if (this.shareLocation()) {
      try {
        location = await this.readLocation();
      } catch (error) {
        this.errorMessage.set(error instanceof Error ? error.message : 'Could not read your location.');
        this.punching.set(false);
        return;
      }
    }

    this.attendanceService.punchIn(this.employeeId, location).subscribe({
      next: (record) => {
        // Show exactly what the server saved (the server decided the date and time)
        this.today.update((t) => ({
          date: record.date,
          record,
          officeLocationRequired: t?.officeLocationRequired ?? false,
        }));
        this.punching.set(false);
        this.notify.success(`Attendance marked. Checked in at ${record.checkIn}.`);
        this.punched.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.punching.set(false);

        if (err.status === 409 && err.error?.record) {
          // Already marked (for example in another tab): show the saved record instead
          this.today.update((t) => ({
            date: err.error.record.date,
            record: err.error.record,
            officeLocationRequired: t?.officeLocationRequired ?? false,
          }));
          this.notify.error('Attendance was already marked for today.');
          this.punched.emit();
          return;
        }

        this.errorMessage.set(this.messageFor(err));
      },
    });
  }

  // Reads the real GPS position from the browser. Nothing is invented or edited.
  private readLocation(): Promise<AttendanceLocation> {
    return new Promise((resolve, reject) => {
      if (!this.locationSupported) {
        reject(new Error('This browser does not support location. Untick "Share my location".'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        (error) =>
          reject(
            new Error(
              error.code === error.PERMISSION_DENIED
                ? 'Location permission was denied. Allow location access, or untick "Share my location".'
                : 'Could not get your location. Try again, or untick "Share my location".',
            ),
          ),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
      );
    });
  }

  private messageFor(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Cannot contact the server. Is JSON Server running? (npm run api)';
    }
    if (err.status === 404 && !err.error?.code) {
      return 'Punch-in service not found. Start the API with "npm run api" (not "api:basic").';
    }
    return err.error?.message ?? 'Could not mark attendance. Please try again.';
  }
}
