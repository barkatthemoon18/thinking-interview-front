import { Injectable, signal } from '@angular/core';
import { ApiSettings, DEFAULT_API_SETTINGS } from './api.config';

// El contrato anterior usaba rutas diferentes y no tenía login.
const STORAGE_KEY = 'thinking.api-settings.v2';
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<ApiSettings>(this.load());
  readonly storageWarning = signal('');
  save(value: ApiSettings): void {
    this.settings.set(structuredClone(value));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      this.storageWarning.set('');
    } catch {
      this.storageWarning.set(
        'La configuración se aplicó a esta sesión, pero el navegador no permite guardarla.',
      );
    }
  }
  private load(): ApiSettings {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (
        saved &&
        ['demo', 'api'].includes(saved.mode) &&
        typeof saved.baseUrl === 'string' &&
        Object.keys(DEFAULT_API_SETTINGS.endpoints).every((key) => {
          const endpoint = saved.endpoints?.[key];
          return (
            endpoint &&
            ['GET', 'POST', 'PATCH', 'PUT'].includes(endpoint.method) &&
            typeof endpoint.path === 'string'
          );
        })
      )
        return saved;
    } catch {
      /* Una configuración inválida o almacenamiento deshabilitado usa los valores iniciales. */
    }
    return structuredClone(DEFAULT_API_SETTINGS);
  }
}
