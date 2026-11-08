import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EventsService, errorMessage } from '../core/events.service';
import { AREAS, Area, eventToday } from '../core/models';
import { SessionService } from '../core/session.service';
import { dateRule, trimmedLength } from '../core/validators';

@Component({
  selector: 'app-event-create',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './event-create.html',
})
export class EventCreate {
  readonly session = inject(SessionService);
  private readonly api = inject(EventsService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly areas = AREAS;
  readonly today = eventToday();
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    titulo: ['', [trimmedLength(5, 120)]],
    descripcion: ['', [trimmedLength(1, 2000)]],
    fechaEvento: ['', [Validators.required, dateRule(undefined, true)]],
    area: ['', Validators.required],
  });
  constructor() {
    effect(() => {
      this.session.user();
      this.form.reset();
      this.error.set('');
    });
  }
  invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || this.session.user()?.role !== 'reportante') return;
    const actor = this.session.requireUser().id;
    this.saving.set(true);
    this.error.set('');
    const input = this.form.getRawValue();
    try {
      const id = await this.api.create({
        ...input,
        titulo: input.titulo.trim(),
        descripcion: input.descripcion.trim(),
        area: input.area as Area,
      });
      if (actor === this.session.user()?.id) {
        if (id !== null) await this.router.navigate(['/eventos', id]);
        else
          await this.router.navigate(['/eventos'], {
            state: {
              notice:
                'Evento registrado correctamente. Ábrelo desde el listado para consultar su detalle.',
            },
          });
      }
    } catch (error) {
      if (actor === this.session.user()?.id) this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
