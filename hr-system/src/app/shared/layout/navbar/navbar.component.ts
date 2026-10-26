import { Component, inject, output } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  private auth = inject(AuthService);

  // The logged-in user (a signal). The template reads it as user()
  user = this.auth.currentUser;

  menuClick = output<void>();

  logout() {
    this.auth.logout();
  }
}
