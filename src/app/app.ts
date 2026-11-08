import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from './core/session.service';
import { SettingsService } from './core/settings.service';
import { ApiClient } from './core/api-client.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  readonly session = inject(SessionService);
  readonly config = inject(SettingsService);
  private readonly client = inject(ApiClient);
  private readonly router = inject(Router);
  constructor() {
    let hadSession = false;
    effect(() => {
      if (this.session.user()) hadSession = true;
      else if (hadSession) {
        hadSession = false;
        void this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }
  logout(): void {
    this.client.clearSessions();
    void this.router.navigate(['/login'], { replaceUrl: true });
  }
}
