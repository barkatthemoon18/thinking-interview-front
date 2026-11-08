import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { eventToday } from './models';

export function trimmedLength(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = String(control.value ?? '').trim().length;
    return length >= min && length <= max ? null : { trimmedLength: true };
  };
}
export function dateRule(min?: () => string, noFuture = false): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: true };
    const parsed = new Date(`${value}T12:00:00`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.getFullYear() !== Number(value.slice(0, 4)) ||
      parsed.getMonth() + 1 !== Number(value.slice(5, 7)) ||
      parsed.getDate() !== Number(value.slice(8, 10))
    )
      return { date: true };
    if (noFuture && value > eventToday()) return { future: true };
    if (min && value < min()) return { beforeEvent: true };
    return null;
  };
}
