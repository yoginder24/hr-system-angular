import { Component, inject } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { EmployeeDashboardComponent } from './employee-dashboard/employee-dashboard.component';
import { HrDashboardComponent } from './hr-dashboard/hr-dashboard.component';

@Component({
  selector: 'app-dashboard',
  imports: [AdminDashboardComponent, HrDashboardComponent, EmployeeDashboardComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private auth = inject(AuthService);

  // The logged-in user (a signal)
  user = this.auth.currentUser;
}
