import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/auth.guards';
import { SessionService } from './core/session.service';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: () => inject(SessionService).homePath() },
  {
    path: 'login',
    title: 'Ingresar · Thinking',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login').then((m) => m.Login),
  },
  {
    path: 'eventos',
    canActivate: [roleGuard('reportante')],
    title: 'Eventos · Thinking',
    loadComponent: () => import('./features/event-list').then((m) => m.EventList),
  },
  {
    path: 'eventos/nuevo',
    canActivate: [roleGuard('reportante')],
    title: 'Registrar evento · Thinking',
    loadComponent: () => import('./features/event-create').then((m) => m.EventCreate),
  },
  {
    path: 'eventos/:id',
    canActivate: [roleGuard('reportante')],
    title: 'Detalle del evento · Thinking',
    loadComponent: () => import('./features/event-detail').then((m) => m.EventDetail),
  },
  {
    path: 'revisiones',
    title: 'Portal de revisiones · Thinking',
    canActivate: [roleGuard('revisor')],
    loadComponent: () => import('./features/event-list').then((m) => m.EventList),
  },
  {
    path: 'revisiones/:id',
    title: 'Revisar evento · Thinking',
    canActivate: [roleGuard('revisor')],
    loadComponent: () => import('./features/event-detail').then((m) => m.EventDetail),
  },
  {
    path: 'conexion',
    title: 'Conexión API · Thinking',
    loadComponent: () => import('./features/api-settings').then((m) => m.ApiSettingsPage),
  },
  { path: '**', loadComponent: () => import('./features/not-found').then((m) => m.NotFound) },
];
