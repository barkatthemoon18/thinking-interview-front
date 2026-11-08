export type Role = 'reportante' | 'revisor';
export type EventStatus = 'reportado' | 'en_revision' | 'cerrado';
export type ActionStatus = 'pendiente' | 'completada';
export const AREAS = ['Planta Norte', 'Planta Sur', 'Bodega', 'Administración'] as const;
export type Area = (typeof AREAS)[number];
export interface TestUser {
  id: string;
  role: Role;
}
export const USERS: TestUser[] = [
  { id: 'reportante1', role: 'reportante' },
  { id: 'reportante2', role: 'reportante' },
  { id: 'revisor1', role: 'revisor' },
];
export interface CorrectiveAction {
  id: string;
  descripcion: string;
  responsable: string;
  fechaObjetivo: string;
  estado: ActionStatus;
}
export interface HistoryEntry {
  id: string;
  actor: string;
  fecha: string;
  cambio: string;
}
export interface EventSummary {
  id: string;
  titulo: string;
  fechaEvento: string;
  area: Area;
  estado: EventStatus;
  reportante: string;
}
export interface EventRecord extends EventSummary {
  descripcion: string;
  acciones: CorrectiveAction[];
  historial: HistoryEntry[];
}
export type CreateEvent = Pick<EventRecord, 'titulo' | 'descripcion' | 'fechaEvento' | 'area'>;
export type CreateAction = Pick<CorrectiveAction, 'descripcion' | 'responsable' | 'fechaObjetivo'>;
export const STATUS_LABELS: Record<EventStatus, string> = {
  reportado: 'Reportado',
  en_revision: 'En revisión',
  cerrado: 'Cerrado',
};
export function eventToday(): string {
  // La API compara la fecha del evento contra el día UTC.
  return new Date().toISOString().slice(0, 10);
}
