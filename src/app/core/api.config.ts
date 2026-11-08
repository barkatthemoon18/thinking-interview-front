// Edita estos valores o usa la pantalla «Conexión API» sin recompilar.
export type Operation =
  | 'login'
  | 'listEvents'
  | 'createEvent'
  | 'getEvent'
  | 'changeStatus'
  | 'createAction'
  | 'completeAction';
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT';
export interface Endpoint {
  method: HttpMethod;
  path: string;
}
export interface ApiSettings {
  mode: 'demo' | 'api';
  baseUrl: string;
  endpoints: Record<Operation, Endpoint>;
}
export const OPERATION_LABELS: Record<Operation, string> = {
  login: 'Iniciar sesión de prueba',
  listEvents: 'Listar eventos',
  createEvent: 'Crear evento',
  getEvent: 'Detalle del evento',
  changeStatus: 'Cambiar estado',
  createAction: 'Crear acción',
  completeAction: 'Completar acción',
};
export const DEFAULT_API_SETTINGS: ApiSettings = {
  mode: 'api',
  baseUrl: '/api',
  endpoints: {
    login: { method: 'POST', path: '/login' },
    listEvents: { method: 'GET', path: '/events' },
    createEvent: { method: 'POST', path: '/create-event' },
    getEvent: { method: 'GET', path: '/events/:eventId' },
    changeStatus: { method: 'PATCH', path: '/events/:eventId/status' },
    createAction: { method: 'POST', path: '/events/:eventId/actions' },
    completeAction: { method: 'PATCH', path: '/events/:eventId/actions/:actionId/complete' },
  },
};
export const LOCAL_API_BASE_URL = 'http://localhost:8080/api';
