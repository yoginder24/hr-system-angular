import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NotificationService } from '../../../core/services/notification.service';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent {
  private notifications = inject(NotificationService);

  // The current success/error message (or null)
  notice = this.notifications.notice;

  // Is the sidebar open on mobile?
  sidebarOpen = signal(false);

  toggleSidebar() {
    this.sidebarOpen.update((isOpen) => !isOpen); // flip true <-> false
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }

  dismissNotice() {
    this.notifications.clear();
  }
}
