import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';
import { fromApiEvent, fromApiSummary, toApiAction, toApiEvent, toApiStatus } from './api.adapter';
import { DemoStore } from './demo.store';
import { CreateAction, CreateEvent, EventRecord, EventStatus, EventSummary } from './models';
import { SessionService } from './session.service';
import { SettingsService } from './settings.service';

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No se pudo realizar la operación. Intenta nuevamente.';
}
@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly client = inject(ApiClient);
  private readonly session = inject(SessionService);
  private readonly config = inject(SettingsService);
  private readonly demo = inject(DemoStore);
  readonly requests = this.client.requests;
  async list(): Promise<EventSummary[]> {
    if (this.isDemo()) return this.demo.list(this.session.requireUser());
    const response = await this.client.request('listEvents');
    if (!Array.isArray(response))
      throw new Error('La API debe devolver un arreglo de resúmenes de eventos.');
    return response.map(fromApiSummary);
  }
  async get(id: string): Promise<EventRecord> {
    if (this.isDemo()) return this.demo.get(id, this.session.requireUser());
    return fromApiEvent(await this.client.request('getEvent', { eventId: id }));
  }
  async create(input: CreateEvent): Promise<string | null> {
    if (this.isDemo()) return this.demo.create(input, this.session.requireUser()).id;
    await this.client.request('createEvent', {}, toApiEvent(input));
    // create-event devuelve texto sin ID. Volver al listado evita confundir títulos duplicados.
    return null;
  }
  async changeStatus(id: string, estado: EventStatus): Promise<void> {
    if (this.isDemo()) return this.demo.transition(id, estado, this.session.requireUser());
    await this.client.request('changeStatus', { eventId: id }, toApiStatus(estado));
  }
  async createAction(id: string, input: CreateAction): Promise<void> {
    if (this.isDemo()) return this.demo.addAction(id, input, this.session.requireUser());
    await this.client.request('createAction', { eventId: id }, toApiAction(input));
  }
  async completeAction(id: string, actionId: string): Promise<void> {
    if (this.isDemo()) return this.demo.complete(id, actionId, this.session.requireUser());
    await this.client.request('completeAction', { eventId: id, actionId });
  }
  clearSessions(): void {
    this.client.clearSessions();
  }
  resetDemo(): void {
    this.demo.reset();
  }
  private isDemo(): boolean {
    return this.config.settings().mode === 'demo';
  }
}
