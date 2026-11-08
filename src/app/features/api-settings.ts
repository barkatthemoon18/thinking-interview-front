import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiSettings, DEFAULT_API_SETTINGS, OPERATION_LABELS, Operation } from '../core/api.config';
import { EventsService } from '../core/events.service';
import { SettingsService } from '../core/settings.service';
import { connectionKey, SessionService } from '../core/session.service';

@Component({
  selector: 'app-api-settings',
  imports: [FormsModule, JsonPipe, DatePipe, RouterLink],
  templateUrl: './api-settings.html',
})
export class ApiSettingsPage {
  readonly config = inject(SettingsService);
  readonly api = inject(EventsService);
  readonly session = inject(SessionService);
  readonly labels = OPERATION_LABELS;
  readonly operations = Object.keys(OPERATION_LABELS) as Operation[];
  readonly methods = ['GET', 'POST', 'PATCH', 'PUT'];
  readonly message = signal('');
  readonly error = signal('');
  draft: ApiSettings = structuredClone(this.config.settings());
  save(): void {
    this.error.set('');
    this.message.set('');
    const value = structuredClone(this.draft);
    value.baseUrl = value.baseUrl.trim().replace(/\/$/, '');
    try {
      if (value.baseUrl.startsWith('/') && !value.baseUrl.startsWith('//')) {
        if (/[?#\s]/.test(value.baseUrl)) throw new Error();
      } else {
        const url = new URL(value.baseUrl);
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          throw new Error();
      }
    } catch {
      this.error.set(
        'Usa una URL http(s) sin credenciales, consultas ni fragmentos, o una ruta relativa como /api.',
      );
      return;
    }
    for (const operation of this.operations) {
      const endpoint = value.endpoints[operation];
      endpoint.path = endpoint.path.trim();
      if (
        !endpoint.path.startsWith('/') ||
        endpoint.path.startsWith('//') ||
        /[\s?#]/.test(endpoint.path)
      ) {
        this.error.set(
          `${this.labels[operation]}: usa una ruta que comience con /, sin espacios, consultas ni fragmentos.`,
        );
        return;
      }
      const parameters: string[] = endpoint.path.match(/:[a-zA-Z]\w*/g) ?? [];
      const required: string[] = ['login', 'listEvents', 'createEvent'].includes(operation)
        ? []
        : operation === 'completeAction'
          ? [':eventId', ':actionId']
          : [':eventId'];
      if (
        parameters.some((parameter) => !required.includes(parameter)) ||
        required.some((parameter) => !parameters.includes(parameter))
      ) {
        this.error.set(
          `${this.labels[operation]}: parámetros requeridos: ${required.join(', ') || 'ninguno'}.`,
        );
        return;
      }
    }
    const connectionChanged = connectionKey(this.config.settings()) !== connectionKey(value);
    this.config.save(value);
    this.draft = structuredClone(value);
    this.api.requests.set([]);
    if (connectionChanged) this.api.clearSessions();
    this.message.set(
      `Configuración guardada. Modo activo: ${value.mode === 'api' ? 'API real' : 'demo local'}.`,
    );
  }
  defaults(): void {
    this.draft = structuredClone(DEFAULT_API_SETTINGS);
    this.error.set('');
    this.message.set('Valores iniciales cargados en el formulario. Guarda para aplicarlos.');
  }
  resetDemo(): void {
    this.api.resetDemo();
    this.message.set('La demo recuperó sus cuatro eventos iniciales.');
  }
}
