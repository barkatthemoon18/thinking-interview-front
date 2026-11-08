import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EventsService, errorMessage } from '../core/events.service';
import { EventSummary } from '../core/models';
import { SessionService } from '../core/session.service';
import { SettingsService } from '../core/settings.service';
import { StatusBadge } from '../shared/status-badge';

@Component({
  selector: 'app-event-list',
  imports: [RouterLink, DatePipe, StatusBadge],
  templateUrl: './event-list.html',
})
export class EventList {
  readonly session = inject(SessionService);
  private readonly api = inject(EventsService);
  private readonly config = inject(SettingsService);
  readonly notice = signal<string>(
    inject(Router).currentNavigation()?.extras.state?.['notice'] ?? '',
  );
  readonly events = signal<EventSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  private sequence = 0;
  constructor() {
    effect(() => {
      const user = this.session.user();
      this.config.settings();
      if (user) void this.load();
      else {
        this.sequence++;
        this.events.set([]);
        this.error.set('');
        this.loading.set(false);
      }
    });
  }
  async load(): Promise<void> {
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    this.events.set([]);
    try {
      const items = await this.api.list();
      if (sequence === this.sequence) this.events.set(items);
    } catch (error) {
      if (sequence === this.sequence) this.error.set(errorMessage(error));
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
}
