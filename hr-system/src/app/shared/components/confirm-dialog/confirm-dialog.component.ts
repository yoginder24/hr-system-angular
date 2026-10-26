import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  title = input('Please confirm');
  message = input.required<string>(); // the parent MUST provide this
  confirmText = input('Confirm');
  confirmClass = input('btn-danger'); // Bootstrap button color class
  busy = input(false); // true while the request is running

  confirmed = output<void>();
  cancelled = output<void>();
}
