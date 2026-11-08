import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiClient } from '../core/api-client.service';
import { errorMessage } from '../core/events.service';
import { SessionService } from '../core/session.service';
import { SettingsService } from '../core/settings.service';
import { trimmedLength } from '../core/validators';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly client = inject(ApiClient);
  private readonly router = inject(Router);
  readonly session = inject(SessionService);
  readonly config = inject(SettingsService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', trimmedLength(1, Number.MAX_SAFE_INTEGER)],
  });
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.loading() && !this.session.user()) this.client.clearSessions();
    });
  }
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.client.login(this.form.controls.username.value);
      await this.router.navigate([this.session.homePath()], { replaceUrl: true });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
