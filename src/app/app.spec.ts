import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { appConfig } from './app.config';
import { SessionService } from './core/session.service';
import { SettingsService } from './core/settings.service';
import { DEFAULT_API_SETTINGS } from './core/api.config';
import { EventCreate } from './features/event-create';
import { EventDetail } from './features/event-detail';
import { Login } from './features/login';

const token = (username: string, role: string) =>
  btoa(JSON.stringify({ scheme: 'login', username, role }));
const summary = {
  eventId: 10,
  title: 'Evento creado por API',
  date: '2026-01-01',
  area: 'Bodega',
  status: 'reportado',
  reporter: 'reportante1',
};
describe('Login, portales y navegación por rol', () => {
  afterEach(() => localStorage.clear());
  async function setup(mode: 'api' | 'demo' = 'demo') {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [...appConfig.providers, provideHttpClientTesting()],
    }).compileComponents();
    TestBed.inject(SettingsService).save({ ...structuredClone(DEFAULT_API_SETTINGS), mode });
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionService);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();
    const component = <T>(type: new (...args: never[]) => T): T =>
      fixture.debugElement.query((node) => node.componentInstance instanceof type)
        .componentInstance;
    async function demoLogin(username: string) {
      const login = component(Login);
      login.form.controls.username.setValue(username);
      await login.submit();
      await fixture.whenStable();
      fixture.detectChanges();
    }
    async function logout() {
      fixture.componentInstance.logout();
      await fixture.whenStable();
      fixture.detectChanges();
    }
    return { fixture, router, http, session, component, demoLogin, logout };
  }
  it('abre una landing de login y rechaza username vacío sin llamar a la API', async () => {
    const { fixture, router, http, component } = await setup('api');
    expect(router.url).toBe('/login');
    expect(fixture.nativeElement.querySelector('#username')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sidebar')).toBeNull();
    await component(Login).submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Escribe tu nombre de usuario');
    http.expectNone('/api/login');
    http.expectNone('/api/events');
    http.verify();
  });
  it.each([
    ['reportante', '/eventos', 'Mis eventos'],
    ['revisor', '/revisiones', 'Portal de revisiones'],
  ])('redirige el rol %s que devuelve la API a su portal', async (role, path, heading) => {
    const { fixture, router, http, session, component } = await setup('api');
    const login = component(Login);
    login.form.controls.username.setValue('persona.nueva');
    const signing = login.submit();
    const request = http.expectOne('/api/login');
    expect(request.request.body).toEqual({ username: 'persona.nueva' });
    request.flush({ token: token('persona.nueva', role) });
    const list = await vi.waitFor(() => http.expectOne('/api/events'));
    expect(list.request.headers.get('Authorization')).toBe(
      `Bearer ${token('persona.nueva', role)}`,
    );
    list.flush([]);
    await signing;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe(path);
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe(heading);
    expect(session.user()?.role).toBe(role);
    expect(
      fixture.nativeElement.querySelector('select[aria-label="Usuario de prueba"]'),
    ).toBeNull();
    http.verify();
  });
  it('protege las rutas sin sesión y permite configurar la conexión desde el login', async () => {
    const { router, http } = await setup('api');
    for (const path of [
      '/eventos',
      '/eventos/nuevo',
      '/eventos/1',
      '/revisiones',
      '/revisiones/1',
    ]) {
      await router.navigateByUrl(path);
      expect(router.url).toBe('/login');
    }
    await router.navigateByUrl('/conexion');
    expect(router.url).toBe('/conexion');
    http.verify();
  });
  it('separa los portales incluso al navegar directamente y cierra la sesión', async () => {
    const { fixture, router, session, demoLogin, logout } = await setup();
    await demoLogin('reportante1');
    expect(router.url).toBe('/eventos');
    await router.navigateByUrl('/revisiones/1');
    expect(router.url).toBe('/eventos');
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
    await logout();
    expect(router.url).toBe('/login');
    expect(session.user()).toBeNull();
    await router.navigateByUrl('/eventos');
    expect(router.url).toBe('/login');
    await demoLogin('revisor1');
    expect(router.url).toBe('/revisiones');
    await router.navigateByUrl('/eventos/nuevo');
    expect(router.url).toBe('/revisiones');
    await router.navigateByUrl('/login');
    expect(router.url).toBe('/revisiones');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(fixture.nativeElement.textContent).not.toContain('Registrar evento');
  });
  it('muestra el error de login y mantiene cerrada la sesión', async () => {
    const { fixture, router, http, session, component } = await setup('api');
    const login = component(Login);
    login.form.controls.username.setValue('inexistente');
    const signing = login.submit();
    http
      .expectOne('/api/login')
      .flush({ detail: 'Usuario inexistente' }, { status: 401, statusText: 'Unauthorized' });
    await signing;
    fixture.detectChanges();
    expect(router.url).toBe('/login');
    expect(session.user()).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Usuario inexistente',
    );
    http.expectNone('/api/events');
    http.verify();
  });
  it('vuelve al login ante una sesión rechazada por el servidor', async () => {
    const { fixture, router, http, component } = await setup('api');
    const login = component(Login);
    login.form.controls.username.setValue('reportante1');
    const signing = login.submit();
    http.expectOne('/api/login').flush({ token: token('reportante1', 'reportante') });
    (await vi.waitFor(() => http.expectOne('/api/events'))).flush(
      { detail: 'Token inválido' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await signing;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(router.url).toBe('/login');
    });
    expect(fixture.nativeElement.textContent).toContain('Vuelve a ingresar');
    http.expectNone('/api/login');
    http.verify();
  });
  it('mantiene el flujo de eventos y acciones pasando de un portal al otro mediante login', async () => {
    const { fixture, router, component, demoLogin, logout } = await setup();
    await demoLogin('reportante1');
    await router.navigateByUrl('/eventos/nuevo');
    await fixture.whenStable();
    fixture.detectChanges();
    const create = component(EventCreate);
    create.form.setValue({
      titulo: 'Registro ficticio de prueba',
      descripcion: 'Descripción del evento',
      fechaEvento: '2026-01-01',
      area: 'Bodega',
    });
    await create.submit();
    await fixture.whenStable();
    fixture.detectChanges();
    const id = router.url.split('/').pop()!;
    await logout();
    await demoLogin('revisor1');
    await router.navigateByUrl(`/revisiones/${id}`);
    await fixture.whenStable();
    fixture.detectChanges();
    const detail = component(EventDetail);
    await detail.transition('en_revision');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(detail.event()?.estado).toBe('en_revision');
    detail.actionForm.controls.responsable.setValue('R'.repeat(31));
    expect(detail.actionForm.controls.responsable.invalid).toBe(true);
    detail.actionForm.setValue({
      descripcion: 'Corregir la condición registrada',
      responsable: 'Persona Ficticia',
      fechaObjetivo: '2026-01-02',
    });
    await detail.addAction();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(detail.pending()).toBe(1);
    const close = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Cerrar evento',
    );
    expect(close?.disabled).toBe(true);
    await detail.complete(detail.event()!.acciones[0].id);
    await detail.transition('cerrado');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(detail.event()?.estado).toBe('cerrado');
    expect(detail.event()?.historial).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.back-link').getAttribute('href')).toBe(
      '/revisiones',
    );
  });
  it('confirma el alta API en texto y vuelve al listado del reportante', async () => {
    const { fixture, router, http, component } = await setup('api');
    const login = component(Login);
    login.form.controls.username.setValue('reportante1');
    const signing = login.submit();
    http.expectOne('/api/login').flush({ token: token('reportante1', 'reportante') });
    (await vi.waitFor(() => http.expectOne('/api/events'))).flush([]);
    await signing;
    await router.navigateByUrl('/eventos/nuevo');
    await fixture.whenStable();
    fixture.detectChanges();
    const create = component(EventCreate);
    create.form.setValue({
      titulo: summary.title,
      descripcion: 'Descripción ficticia',
      fechaEvento: summary.date,
      area: 'Bodega',
    });
    const submitting = create.submit();
    http
      .expectOne('/api/create-event')
      .flush('Event created successfully', { status: 201, statusText: 'Created' });
    (await vi.waitFor(() => http.expectOne('/api/events'))).flush([summary]);
    await submitting;
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('tbody tr')?.textContent).toContain(summary.title);
    });
    expect(router.url).toBe('/eventos');
    expect(fixture.nativeElement.textContent).toContain('Evento registrado correctamente.');
    expect(fixture.nativeElement.querySelector('tbody a').getAttribute('href')).toBe('/eventos/10');
    http.verify();
  });
});
