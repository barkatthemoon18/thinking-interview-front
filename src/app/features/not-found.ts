import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../core/session.service';
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template:
    '<div class="panel empty"><span class="eyebrow">404</span><h1>Página no encontrada</h1><p>La dirección no corresponde a una sección del proyecto.</p><a class="button primary" [routerLink]="session.homePath()">Volver al inicio</a></div>',
})
export class NotFound {
  readonly session = inject(SessionService);
}
