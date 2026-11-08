import { describe, expect, it } from 'vitest';
import { userFromToken } from './session.service';

describe('Identidad y rol del token de login', () => {
  it.each(['reportante', 'revisor'] as const)(
    'obtiene el rol %s sin depender de usuarios precargados',
    (role) => {
      const token = btoa(JSON.stringify({ scheme: 'login', username: 'persona.nueva', role }));
      expect(userFromToken(token, 'persona.nueva')).toEqual({ id: 'persona.nueva', role });
    },
  );
  it.each([
    'no-es-base64!',
    btoa('no es JSON'),
    btoa('null'),
    btoa(JSON.stringify({ scheme: 'otro', username: 'user', role: 'revisor' })),
    btoa(JSON.stringify({ scheme: 'login', username: 'otro', role: 'revisor' })),
    btoa(JSON.stringify({ scheme: 'login', username: 'user', role: 'admin' })),
  ])('rechaza un token inválido o de otra identidad (%#)', (token) => {
    expect(() => userFromToken(token, 'user')).toThrow('usuario y un rol válidos');
  });
});
