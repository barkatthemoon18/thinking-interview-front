import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EventsService, errorMessage } from '../core/events.service';
import { EventRecord, EventStatus } from '../core/models';
import { SessionService } from '../core/session.service';
import { SettingsService } from '../core/settings.service';
import { dateRule, trimmedLength } from '../core/validators';
import { StatusBadge } from '../shared/status-badge';

@Component({
  selector: 'app-event-detail',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, StatusBadge],
  templateUrl: './event-detail.html',
})
export class EventDetail {
  readonly id = input.required<string>();
  readonly session = inject(SessionService);
  private readonly api = inject(EventsService);
  private readonly config = inject(SettingsService);
  private readonly fb = inject(FormBuilder);
  readonly event = signal<EventRecord | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly pending = computed(
    () => this.event()?.acciones.filter((item) => item.estado === 'pendiente').length ?? 0,
  );
  readonly history = computed(() =>
    [...(this.event()?.historial ?? [])]
      .reverse()
      .sort((first, second) => Date.parse(second.fecha) - Date.parse(first.fecha)),
  );
  readonly actionForm = this.fb.nonNullable.group({
    descripcion: ['', trimmedLength(5, 500)],
    responsable: ['', [Validators.required, trimmedLength(1, 30)]],
    fechaObjetivo: ['', [Validators.required, dateRule(() => this.event()?.fechaEvento ?? '')]],
  });
  private sequence = 0;
  constructor() {
    effect(() => {
      this.id();
      const user = this.session.user();
      this.config.settings();
      this.event.set(null);
      this.error.set('');
      this.success.set('');
      this.actionForm.reset();
      if (user) void this.load();
      else {
        this.sequence++;
        this.loading.set(false);
      }
    });
  }
  invalid(field: keyof typeof this.actionForm.controls): boolean {
    const control = this.actionForm.controls[field];
    return control.touched && control.invalid;
  }
  async load(): Promise<void> {
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    try {
      const event = await this.api.get(this.id());
      if (sequence === this.sequence) this.event.set(event);
    } catch (error) {
      if (sequence === this.sequence) this.error.set(errorMessage(error));
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
  transition(next: EventStatus): Promise<void> {
    const id = this.id();
    return this.mutate(
      () => this.api.changeStatus(id, next),
      next === 'cerrado' ? 'Evento cerrado correctamente.' : 'El evento está en revisión.',
    );
  }
  async addAction(): Promise<void> {
    this.actionForm.markAllAsTouched();
    if (this.actionForm.invalid) return;
    const id = this.id();
    const value = this.actionForm.getRawValue();
    await this.mutate(async () => {
      await this.api.createAction(id, {
        ...value,
        descripcion: value.descripcion.trim(),
        responsable: value.responsable.trim(),
      });
      if (this.id() === id) this.actionForm.reset();
    }, 'Acción correctiva creada.');
  }
  complete(actionId: string): Promise<void> {
    const id = this.id();
    return this.mutate(
      () => this.api.completeAction(id, String(actionId)),
      'Acción marcada como completada.',
    );
  }
  private async mutate(operation: () => Promise<void>, message: string): Promise<void> {
    if (this.busy()) return;
    const actor = this.session.requireUser().id;
    const id = this.id();
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await operation();
      if (actor === this.session.user()?.id && id === this.id()) {
        this.success.set(message);
        await this.load();
      }
    } catch (error) {
      if (actor === this.session.user()?.id && id === this.id())
        this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
