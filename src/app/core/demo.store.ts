import { Injectable } from '@angular/core';
import { CreateAction, CreateEvent, EventRecord, EventStatus, TestUser } from './models';

function seed(): EventRecord[] {
  return [
    {
      id: '1',
      titulo: 'Derrame menor de aceite en patio de bodega',
      descripcion:
        'Se detectó una pequeña mancha de aceite junto a la zona de carga. Se señalizó el sector.',
      fechaEvento: '2026-10-28',
      area: 'Bodega',
      estado: 'reportado',
      reportante: 'reportante1',
      acciones: [],
      historial: [
        {
          id: 'h1',
          actor: 'reportante1',
          fecha: '2026-10-28T14:00:00Z',
          cambio: 'Evento registrado en estado reportado.',
        },
      ],
    },
    {
      id: '2',
      titulo: 'Extintor con fecha de inspección vencida',
      descripcion: 'El extintor del acceso principal requiere una nueva inspección.',
      fechaEvento: '2026-10-30',
      area: 'Planta Norte',
      estado: 'en_revision',
      reportante: 'reportante2',
      acciones: [
        {
          id: 'a1',
          descripcion: 'Coordinar la inspección y actualizar la etiqueta del extintor.',
          responsable: 'Alex Ejemplo',
          fechaObjetivo: '2026-11-10',
          estado: 'pendiente',
        },
      ],
      historial: [
        {
          id: 'h2',
          actor: 'reportante2',
          fecha: '2026-10-30T12:00:00Z',
          cambio: 'Evento registrado en estado reportado.',
        },
        {
          id: 'h3',
          actor: 'revisor1',
          fecha: '2026-10-30T15:00:00Z',
          cambio: 'Estado: reportado → en revisión.',
        },
        {
          id: 'h4',
          actor: 'revisor1',
          fecha: '2026-10-30T15:05:00Z',
          cambio: 'Acción creada: coordinar la inspección del extintor.',
        },
      ],
    },
    {
      id: '3',
      titulo: 'Cable de extensión cruzando pasillo',
      descripcion: 'Una extensión eléctrica cruzaba la circulación peatonal de Administración.',
      fechaEvento: '2026-10-22',
      area: 'Administración',
      estado: 'cerrado',
      reportante: 'reportante1',
      acciones: [
        {
          id: 'a2',
          descripcion: 'Retirar la extensión del pasillo y ordenar el tendido.',
          responsable: 'Sam Ficticio',
          fechaObjetivo: '2026-10-23',
          estado: 'completada',
        },
      ],
      historial: [
        {
          id: 'h5',
          actor: 'reportante1',
          fecha: '2026-10-22T12:00:00Z',
          cambio: 'Evento registrado en estado reportado.',
        },
        {
          id: 'h6',
          actor: 'revisor1',
          fecha: '2026-10-22T14:00:00Z',
          cambio: 'Estado: reportado → en revisión.',
        },
        {
          id: 'h7',
          actor: 'revisor1',
          fecha: '2026-10-22T14:10:00Z',
          cambio: 'Acción creada: retirar la extensión del pasillo.',
        },
        {
          id: 'h8',
          actor: 'revisor1',
          fecha: '2026-10-23T13:00:00Z',
          cambio: 'Acción completada: retirar la extensión del pasillo.',
        },
        {
          id: 'h9',
          actor: 'revisor1',
          fecha: '2026-10-23T13:05:00Z',
          cambio: 'Estado: en revisión → cerrado.',
        },
      ],
    },
    {
      id: '4',
      titulo: 'Baranda suelta en plataforma de acceso',
      descripcion: 'Se observa movimiento en una de las fijaciones de la baranda de acceso.',
      fechaEvento: '2026-11-02',
      area: 'Planta Sur',
      estado: 'reportado',
      reportante: 'reportante2',
      acciones: [],
      historial: [
        {
          id: 'h10',
          actor: 'reportante2',
          fecha: '2026-11-02T13:00:00Z',
          cambio: 'Evento registrado en estado reportado.',
        },
      ],
    },
  ];
}

// Simulación en memoria. No es una API ni constituye un control de seguridad.
@Injectable({ providedIn: 'root' })
export class DemoStore {
  private events = seed();
  reset(): void {
    this.events = seed();
  }
  list(user: TestUser): EventRecord[] {
    return structuredClone(
      this.events.filter((item) => user.role === 'revisor' || item.reportante === user.id),
    );
  }
  get(id: string, user: TestUser): EventRecord {
    return structuredClone(this.record(id, user));
  }
  create(input: CreateEvent, user: TestUser): EventRecord {
    if (user.role !== 'reportante') throw new Error('Solo un reportante puede registrar eventos.');
    const event: EventRecord = {
      ...input,
      id: crypto.randomUUID(),
      estado: 'reportado',
      reportante: user.id,
      acciones: [],
      historial: [],
    };
    this.history(event, user, 'Evento registrado en estado reportado.');
    this.events.unshift(event);
    return structuredClone(event);
  }
  transition(id: string, next: EventStatus, user: TestUser): void {
    this.reviewer(user);
    const event = this.record(id, user);
    if (!(
      (event.estado === 'reportado' && next === 'en_revision') ||
      (event.estado === 'en_revision' && next === 'cerrado')
    )) {
      throw new Error('La transición de estado no está permitida.');
    }
    if (next === 'cerrado' && event.acciones.some((item) => item.estado === 'pendiente')) {
      throw new Error('No se puede cerrar el evento: todavía hay acciones pendientes.');
    }
    this.history(event, user, `Estado: ${event.estado} → ${next}.`);
    event.estado = next;
  }
  addAction(id: string, input: CreateAction, user: TestUser): void {
    const event = this.reviewRecord(id, user);
    if (input.fechaObjetivo < event.fechaEvento)
      throw new Error('La fecha objetivo no puede ser anterior a la fecha del evento.');
    event.acciones.push({ ...input, id: crypto.randomUUID(), estado: 'pendiente' });
    this.history(event, user, `Acción creada: ${input.descripcion}`);
  }
  complete(id: string, actionId: string, user: TestUser): void {
    const event = this.reviewRecord(id, user);
    const action = event.acciones.find((item) => String(item.id) === actionId);
    if (!action) throw new Error('La acción no existe.');
    if (action.estado !== 'pendiente') throw new Error('La acción ya está completada.');
    action.estado = 'completada';
    this.history(event, user, `Acción completada: ${action.descripcion}`);
  }
  private record(id: string, user: TestUser): EventRecord {
    const event = this.events.find((item) => String(item.id) === id);
    if (!event || (user.role !== 'revisor' && event.reportante !== user.id))
      throw new Error('Evento no encontrado o sin permiso de acceso.');
    return event;
  }
  private reviewer(user: TestUser): void {
    if (user.role !== 'revisor') throw new Error('Solo el revisor puede realizar esta operación.');
  }
  private reviewRecord(id: string, user: TestUser): EventRecord {
    this.reviewer(user);
    const event = this.record(id, user);
    if (event.estado !== 'en_revision')
      throw new Error('Las acciones solo se gestionan mientras el evento está en revisión.');
    return event;
  }
  private history(event: EventRecord, user: TestUser, cambio: string): void {
    event.historial.push({
      id: crypto.randomUUID(),
      actor: user.id,
      fecha: new Date().toISOString(),
      cambio,
    });
  }
}
