import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

interface DemoAccount {
  role: string;
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  loading = signal(false);
  errorMessage = signal('');

  // DEMO ONLY: shown so beginners can try every role quickly.
  demoAccounts: DemoAccount[] = [
    { role: 'Admin', email: 'aarav.sharma@company.com', password: 'Admin@123' },
    { role: 'HR', email: 'priya.verma@company.com', password: 'Hr@12345' },
    { role: 'Employee', email: 'rohan.gupta@company.com', password: 'Emp@12345' },
  ];

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get email() {
    return this.loginForm.controls.email;
  }

  get password() {
    return this.loginForm.controls.password;
  }

  // Fills the form with a demo account
  useDemoAccount(account: DemoAccount) {
    this.loginForm.setValue({ email: account.email, password: account.password });
    this.errorMessage.set('');
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const { email, password } = this.loginForm.getRawValue();

    // Nothing is sent until we call subscribe()
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate([this.auth.homeRoute()]);
      },
      error: (err: unknown) => {
        this.loading.set(false);

        if (err instanceof HttpErrorResponse) {
          // The request itself failed (server off, wrong URL, ...)
          this.errorMessage.set('Cannot contact the server. Is JSON Server running? (npm run api)');
        } else if (err instanceof Error) {
          // Our own message, e.g. "Invalid email or password."
          this.errorMessage.set(err.message);
        } else {
          this.errorMessage.set('Something went wrong. Please try again.');
        }
      },
    });
  }
}
