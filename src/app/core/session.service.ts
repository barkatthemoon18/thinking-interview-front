import { Injectable, computed, signal } from '@angular/core';
import { ApiSettings } from './api.config';
import { TestUser, USERS } from './models';

export interface AuthSession {
  user: TestUser;
  token: string | null;
  connection: string;
}
export function connectionKey(config: ApiSettings): string {
  return JSON.stringify([config.mode, config.baseUrl, config.endpoints.login]);
}
export function userFromToken(token: string, expectedUsername: string): TestUser {
  try {
    const bytes = Uint8Array.from(atob(token), (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (
      payload?.scheme !== 'login' ||
      payload.username !== expectedUsername ||
      !['reportante', 'revisor'].includes(payload.role)
    )
      throw new Error();
    return { id: payload.username, role: payload.role };
  } catch {
    throw new Error(
      'El token de la API no contiene un usuario y un rol válidos para este ingreso.',
    );
  }
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly state = signal<AuthSession | null>(null);
  readonly auth = this.state.asReadonly();
  readonly user = computed(() => this.state()?.user ?? null);
  readonly homePath = computed(() =>
    this.user()?.role === 'revisor' ? '/revisiones' : this.user() ? '/eventos' : '/login',
  );
  readonly notice = signal('');

  startApi(token: string, username: string, config: ApiSettings): TestUser {
    const user = userFromToken(token, username);
    this.state.set({ user, token, connection: connectionKey(config) });
    this.notice.set('');
    return user;
  }
  startDemo(username: string, config: ApiSettings): TestUser {
    const user = USERS.find((item) => item.id === username);
    if (!user)
      throw new Error('Usuario de demo no encontrado. Usa reportante1, reportante2 o revisor1.');
    this.state.set({ user: { ...user }, token: null, connection: connectionKey(config) });
    this.notice.set('');
    return user;
  }
  requireUser(): TestUser {
    const user = this.user();
    if (!user) throw new Error('Inicia sesión para continuar.');
    return user;
  }
  clear(notice = ''): void {
    this.state.set(null);
    this.notice.set(notice);
  }
}
