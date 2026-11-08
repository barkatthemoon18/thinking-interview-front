import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiSettings, Operation, OPERATION_LABELS } from './api.config';
import { connectionKey, SessionService } from './session.service';
import { TestUser } from './models';
import { SettingsService } from './settings.service';

export interface RequestLog {
  operation: string;
  method: string;
  url: string;
  actor: string;
  status: number;
  duration: number;
  date: string;
  request: unknown;
  response: unknown;
}
function parseBody(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly settings = inject(SettingsService);
  private generation = 0;
  readonly requests = signal<RequestLog[]>([]);
  clearSessions(): void {
    this.generation++;
    this.requests.set([]);
    this.session.clear();
  }
  async login(username: string): Promise<TestUser> {
    this.clearSessions();
    const attempt = this.generation;
    const config = this.settings.settings();
    const name = username.trim();
    if (!name) throw new Error('Escribe tu nombre de usuario.');
    if (config.mode === 'demo') return this.session.startDemo(name, config);
    const response = await this.send('login', config, name, {}, { username: name });
    if (
      attempt !== this.generation ||
      connectionKey(config) !== connectionKey(this.settings.settings())
    ) {
      throw new Error('El ingreso se canceló o cambió la conexión. Intenta nuevamente.');
    }
    if (
      !response ||
      typeof response !== 'object' ||
      !('token' in response) ||
      typeof response.token !== 'string' ||
      !response.token
    ) {
      throw new Error('El login de la API debe devolver { "token": "..." }.');
    }
    return this.session.startApi(response.token, name, config);
  }
  async request(
    operation: Exclude<Operation, 'login'>,
    params: Record<string, string> = {},
    body?: unknown,
  ): Promise<unknown> {
    const config = this.settings.settings();
    const auth = this.session.auth();
    if (!auth?.token) throw new Error('Inicia sesión para continuar.');
    if (auth.connection !== connectionKey(config)) {
      this.clearSessions();
      throw new Error('Cambió la conexión de la API. Inicia sesión nuevamente.');
    }
    try {
      return await this.send(operation, config, auth.user.id, params, body, auth.token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && this.session.auth() === auth) {
        this.clearSessions();
        this.session.notice.set('Tu sesión ya no es válida. Vuelve a ingresar.');
      }
      throw error;
    }
  }
  private async send(
    operation: Operation,
    config: ApiSettings,
    actor: string,
    params: Record<string, string>,
    body?: unknown,
    token?: string,
  ): Promise<unknown> {
    const endpoint = config.endpoints[operation];
    const path = endpoint.path.replace(/:(eventId|actionId)\b/g, (match, key: string) => {
      if (params[key] === undefined) throw new Error(`Falta el parámetro ${match} en el endpoint.`);
      return encodeURIComponent(params[key]);
    });
    const url = `${config.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const started = performance.now();
    const generation = this.generation;
    const log = (status: number, response: unknown): void => {
      if (generation !== this.generation) return;
      this.requests.update((items) =>
        [
          {
            operation: OPERATION_LABELS[operation],
            method: endpoint.method,
            url,
            actor,
            status,
            duration: Math.round(performance.now() - started),
            date: new Date().toISOString(),
            request: body ?? null,
            response:
              operation === 'login' && status >= 200 && status < 300
                ? { token: '[oculto]' }
                : response,
          },
          ...items,
        ].slice(0, 12),
      );
    };
    let response;
    try {
      response = await firstValueFrom(
        this.http
          .request(endpoint.method, url, {
            body,
            headers: {
              Accept: 'application/json, application/problem+json, text/plain',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            observe: 'response',
            responseType: 'text',
          })
          .pipe(timeout(15000)),
      );
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      const data = parseBody(error instanceof HttpErrorResponse ? error.error : null);
      log(status, data);
      if (error instanceof HttpErrorResponse) {
        if (status === 0)
          throw new ApiError(
            0,
            'No se pudo conectar con la API. Inicia tu servidor H2 en localhost:8080 y revisa la URL o el proxy.',
          );
        const detail =
          data && typeof data === 'object'
            ? 'detail' in data
              ? data.detail
              : 'message' in data
                ? data.message
                : undefined
            : undefined;
        const fallback =
          status === 401
            ? 'La sesión no es válida. Vuelve a ingresar.'
            : status === 403
              ? 'No tienes permiso para realizar esta operación.'
              : status === 404
                ? 'El recurso no existe o no tienes acceso.'
                : status >= 500
                  ? 'La API tuvo un error interno. Revisa sus registros.'
                  : 'La API rechazó la solicitud.';
        throw new ApiError(
          status,
          `HTTP ${status}: ${status < 500 && typeof detail === 'string' ? detail.slice(0, 500) : fallback}`,
        );
      }
      throw new ApiError(
        0,
        'La API no respondió antes de 15 segundos. Comprueba el resultado antes de repetir una escritura.',
      );
    }
    const data = operation === 'createEvent' ? response.body : parseBody(response.body);
    log(response.status, data);
    return data;
  }
}
class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
