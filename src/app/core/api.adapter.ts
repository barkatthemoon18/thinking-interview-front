import {
  Area,
  AREAS,
  CorrectiveAction,
  CreateAction,
  CreateEvent,
  EventRecord,
  EventStatus,
  EventSummary,
  HistoryEntry,
} from './models';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('La respuesta de la API no coincide con el contrato documentado.');
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`La API devolvió un campo ${field} inválido.`);
  return value;
}
function id(value: unknown): string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)
    throw new Error('La API debe devolver identificadores numéricos positivos.');
  return String(value);
}
function date(value: unknown): string {
  const result = text(value, 'fecha');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)))
    throw new Error('La API devolvió una fecha inválida.');
  return result;
}
function status(value: unknown): EventStatus {
  if (value === 'en revisión') return 'en_revision';
  if (value === 'reportado' || value === 'cerrado') return value;
  throw new Error('La API devolvió un estado de evento desconocido.');
}
export function fromApiSummary(value: unknown): EventSummary {
  const item = object(value);
  if (!AREAS.includes(item['area'] as Area))
    throw new Error('La API devolvió un área desconocida.');
  return {
    id: id(item['eventId']),
    titulo: text(item['title'], 'title'),
    fechaEvento: date(item['date']),
    area: item['area'] as Area,
    estado: status(item['status']),
    reportante: text(item['reporter'], 'reporter'),
  };
}
function fromApiAction(value: unknown): CorrectiveAction {
  const item = object(value);
  if (!['pendiente', 'completada'].includes(item['status'] as string))
    throw new Error('La API devolvió un estado de acción desconocido.');
  const target = text(item['targetDate'], 'targetDate');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(target))
    throw new Error('targetDate debe ser una fecha y hora sin zona.');
  return {
    id: id(item['actionId']),
    descripcion: text(item['description'], 'description'),
    responsable: text(item['responsible'], 'responsible'),
    fechaObjetivo: date(target.slice(0, 10)),
    estado: item['status'] as CorrectiveAction['estado'],
  };
}
function fromApiHistory(value: unknown): HistoryEntry {
  const item = object(value);
  const timestamp = text(item['changeDate'], 'changeDate');
  if (!Number.isFinite(Date.parse(timestamp)))
    throw new Error('La API devolvió una fecha de historial inválida.');
  return {
    id: id(item['changeHistoryId']),
    actor: text(item['actor'], 'actor'),
    fecha: timestamp,
    cambio: text(item['description'], 'description'),
  };
}
export function fromApiEvent(value: unknown): EventRecord {
  const item = object(value);
  if (!Array.isArray(item['actions']) || !Array.isArray(item['history']))
    throw new Error('El detalle de la API debe incluir actions e history como arreglos.');
  return {
    ...fromApiSummary(item),
    descripcion: text(item['description'], 'description'),
    acciones: item['actions'].map(fromApiAction),
    historial: item['history'].map(fromApiHistory),
  };
}
export const toApiEvent = (value: CreateEvent) => ({
  title: value.titulo,
  description: value.descripcion,
  date: value.fechaEvento,
  area: value.area,
});
export const toApiAction = (value: CreateAction) => ({
  description: value.descripcion,
  responsible: value.responsable,
  targetDate: `${value.fechaObjetivo}T00:00:00`,
});
export const toApiStatus = (value: EventStatus) => ({
  status: value === 'en_revision' ? 'en revisión' : value,
});
