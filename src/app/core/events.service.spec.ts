import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiClient } from './api-client.service';
import { DEFAULT_API_SETTINGS } from './api.config';
import { EventsService } from './events.service';
import { SessionService } from './session.service';
import { SettingsService } from './settings.service';

const summary = {
  eventId: 5,
  title: 'Evento ficticio',
  date: '2026-11-01',
  area: 'Bodega',
  status: 'en revisión',
  reporter: 'reportante1',
};
const detail = {
  ...summary,
  description: 'Descripción ficticia',
  actions: [
    {
      actionId: 7,
      description: 'Corregir la condición',
      responsible: 'Persona QA',
      targetDate: '2026-11-15T00:00:00',
      status: 'pendiente',
    },
  ],
  history: [
    {
      changeHistoryId: 9,
      changeDate: '2026-11-08T15:00:00',
      actor: 'revisor1',
      description: 'Estado: reportado -> en revisión',
    },
  ],
};
const token = (username: string, role = 'reportante') =>
  btoa(JSON.stringify({ scheme: 'login', username, role }));

describe('Contrato HTTP con login explícito', () => {
  let api: EventsService;
  let client: ApiClient;
  let http: HttpTestingController;
  let session: SessionService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(EventsService);
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });
  async function login(username = 'reportante1', role = 'reportante') {
    const signing = client.login(username);
    const request = http.expectOne('/api/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ token: token(username, role) });
    await signing;
  }
  it('no consulta datos ni inicia sesión automáticamente antes del ingreso', async () => {
    await expect(api.list()).rejects.toThrow('Inicia sesión');
    http.expectNone('/api/login');
    http.expectNone('/api/events');
    expect(session.user()).toBeNull();
  });
  it('procesa el token del login y adapta los resúmenes sin acciones ni historial', async () => {
    await login('reportante2');
    const result = api.list();
    const request = http.expectOne('/api/events');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token('reportante2')}`);
    expect(request.request.headers.has('X-User-Id')).toBe(false);
    request.flush([{ ...summary, reporter: 'reportante2' }]);
    expect(await result).toEqual([
      {
        id: '5',
        titulo: 'Evento ficticio',
        fechaEvento: '2026-11-01',
        area: 'Bodega',
        estado: 'en_revision',
        reportante: 'reportante2',
      },
    ]);
    expect(session.user()).toEqual({ id: 'reportante2', role: 'reportante' });
    expect(
      api.requests().find((item) => item.operation === 'Iniciar sesión de prueba')?.response,
    ).toEqual({ token: '[oculto]' });
  });
  it('adapta el detalle, las acciones y el historial', async () => {
    await login();
    const result = api.get('5');
    http.expectOne('/api/events/5').flush(detail);
    const event = await result;
    expect(event.estado).toBe('en_revision');
    expect(event.acciones[0]).toEqual({
      id: '7',
      descripcion: 'Corregir la condición',
      responsable: 'Persona QA',
      fechaObjetivo: '2026-11-15',
      estado: 'pendiente',
    });
    expect(event.historial[0]).toEqual({
      id: '9',
      fecha: '2026-11-08T15:00:00',
      actor: 'revisor1',
      cambio: 'Estado: reportado -> en revisión',
    });
  });
  it('envía el DTO en inglés y admite la creación 201 en texto sin inventar un ID', async () => {
    await login();
    const result = api.create({
      titulo: 'Evento ficticio',
      descripcion: 'Descripción',
      fechaEvento: '2026-11-01',
      area: 'Bodega',
    });
    const request = http.expectOne('/api/create-event');
    expect(request.request.body).toEqual({
      title: 'Evento ficticio',
      description: 'Descripción',
      date: '2026-11-01',
      area: 'Bodega',
    });
    request.flush('Event created successfully', { status: 201, statusText: 'Created' });
    expect(await result).toBeNull();
  });
  it('envía el estado con espacio y acento y admite 204', async () => {
    await login('revisor1', 'revisor');
    const result = api.changeStatus('5', 'en_revision');
    const request = http.expectOne('/api/events/5/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'en revisión' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await result;
  });
  it('envía la fecha objetivo sin zona y completa sin cuerpo ni nuevos logins', async () => {
    await login('revisor1', 'revisor');
    const creating = api.createAction('5', {
      descripcion: 'Corregir la condición',
      responsable: 'Persona QA',
      fechaObjetivo: '2026-11-15',
    });
    const request = http.expectOne('/api/events/5/actions');
    expect(request.request.body).toEqual({
      description: 'Corregir la condición',
      responsible: 'Persona QA',
      targetDate: '2026-11-15T00:00:00',
    });
    request.flush(detail.actions[0], { status: 201, statusText: 'Created' });
    await creating;
    const completing = api.completeAction('5', '7');
    const completion = http.expectOne('/api/events/5/actions/7/complete');
    expect(completion.request.body).toBeNull();
    completion.flush(null, { status: 204, statusText: 'No Content' });
    await completing;
    http.expectNone('/api/login');
  });
  it('muestra el ProblemDetail de la API sin usar datos de demo', async () => {
    await login();
    const result = api.changeStatus('5', 'cerrado');
    const rejected = expect(result).rejects.toThrow('HTTP 409: Quedan acciones pendientes');
    http
      .expectOne('/api/events/5/status')
      .flush(
        {
          title: 'Conflict',
          status: 409,
          detail: 'Quedan acciones pendientes',
          instance: '/api/events/5/status',
        },
        { status: 409, statusText: 'Conflict' },
      );
    await rejected;
    expect(api.requests()[0].status).toBe(409);
  });
  it('permite modificar rutas y codifica parámetros', async () => {
    const config = TestBed.inject(SettingsService);
    const value = structuredClone(config.settings());
    value.endpoints.completeAction = {
      method: 'PUT',
      path: '/incidentes/:eventId/tareas/:actionId/lista',
    };
    config.save(value);
    await login();
    const result = api.completeAction('a/b', 'c d');
    const request = http.expectOne('/api/incidentes/a%2Fb/tareas/c%20d/lista');
    expect(request.request.method).toBe('PUT');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await result;
  });
  it('rechaza DTO incompletos y oculta detalles internos de errores 500', async () => {
    await login();
    const result = api.get('5');
    const rejected = expect(result).rejects.toThrow('actions e history');
    http.expectOne('/api/events/5').flush(summary);
    await rejected;
    const failure = api.get('5');
    const failed = expect(failure).rejects.toThrow('HTTP 500: La API tuvo un error interno');
    http
      .expectOne('/api/events/5')
      .flush({ detail: 'SQL stack interna' }, { status: 500, statusText: 'Error' });
    await failed;
  });
  it('descarta la sesión ante un 401 sin repetir la escritura ni reloguear', async () => {
    await login();
    const result = api.changeStatus('5', 'en_revision');
    const rejected = expect(result).rejects.toThrow('HTTP 401');
    http
      .expectOne('/api/events/5/status')
      .flush({ detail: 'Token inválido' }, { status: 401, statusText: 'Unauthorized' });
    await rejected;
    expect(session.user()).toBeNull();
    expect(session.notice()).toContain('Vuelve a ingresar');
    await expect(api.list()).rejects.toThrow('Inicia sesión');
    http.expectNone('/api/login');
    http.expectNone('/api/events');
  });
  it('un 401 atrasado no cierra la sesión de un usuario que ingresó después', async () => {
    await login();
    const old = api.list();
    const rejected = expect(old).rejects.toThrow('HTTP 401');
    const oldRequest = http.expectOne('/api/events');
    client.clearSessions();
    await login('revisor1', 'revisor');
    oldRequest.flush({ detail: 'Token anterior' }, { status: 401, statusText: 'Unauthorized' });
    await rejected;
    expect(session.user()?.id).toBe('revisor1');
    expect(api.requests()).toHaveLength(1);
  });
  it('cierra y limpia la sesión y cancela un login todavía pendiente', async () => {
    const signing = client.login('reportante1');
    const rejected = expect(signing).rejects.toThrow('se canceló');
    const request = http.expectOne('/api/login');
    client.clearSessions();
    request.flush({ token: token('reportante1') });
    await rejected;
    expect(session.user()).toBeNull();
    expect(api.requests()).toEqual([]);
  });
  it('no establece sesión si el login devuelve 401 o un rol inválido', async () => {
    const missing = client.login('inexistente');
    const rejected = expect(missing).rejects.toThrow('HTTP 401: Usuario inexistente');
    http
      .expectOne('/api/login')
      .flush({ detail: 'Usuario inexistente' }, { status: 401, statusText: 'Unauthorized' });
    await rejected;
    const invalid = client.login('reportante1');
    const invalidRole = expect(invalid).rejects.toThrow('rol válidos');
    http.expectOne('/api/login').flush({ token: token('reportante1', 'administrador') });
    await invalidRole;
    expect(session.user()).toBeNull();
    http.expectNone('/api/events');
  });
  it('invalida la sesión si cambia el destino de la API', async () => {
    await login();
    const config = TestBed.inject(SettingsService);
    config.save({ ...config.settings(), baseUrl: 'http://localhost:8081/api' });
    await expect(api.list()).rejects.toThrow('Cambió la conexión');
    expect(session.user()).toBeNull();
    http.expectNone('http://localhost:8081/api/events');
  });
  it('ignora la configuración anterior basada en X-User-Id', () => {
    localStorage.setItem(
      'thinking.api-settings.v1',
      JSON.stringify({
        mode: 'api',
        baseUrl: 'http://localhost:3000/api',
        userHeader: 'X-User-Id',
      }),
    );
    expect(TestBed.inject(SettingsService).settings()).toEqual(DEFAULT_API_SETTINGS);
  });
});
