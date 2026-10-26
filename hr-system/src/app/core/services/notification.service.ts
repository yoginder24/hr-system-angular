import { Injectable, signal } from '@angular/core';

export interface Notice {
  type: 'success' | 'danger'; // Bootstrap color names
  text: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private noticeSignal = signal<Notice | null>(null);
  notice = this.noticeSignal.asReadonly();

  private timerId: ReturnType<typeof setTimeout> | undefined;

  success(text: string): void {
    this.show('success', text);
  }

  error(text: string): void {
    this.show('danger', text);
  }

  clear(): void {
    clearTimeout(this.timerId);
    this.noticeSignal.set(null);
  }

  private show(type: Notice['type'], text: string): void {
    clearTimeout(this.timerId);
    this.noticeSignal.set({ type, text });
    // Hide automatically after 4 seconds
    this.timerId = setTimeout(() => this.noticeSignal.set(null), 4000);
  }
}
