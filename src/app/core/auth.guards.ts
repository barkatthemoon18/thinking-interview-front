import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from './models';
import { SessionService } from './session.service';

export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.user() ? inject(Router).createUrlTree([session.homePath()]) : true;
};
export function roleGuard(role: Role): CanActivateFn {
  return () => {
    const session = inject(SessionService);
    if (session.user()?.role === role) return true;
    return inject(Router).createUrlTree([session.homePath()]);
  };
}
