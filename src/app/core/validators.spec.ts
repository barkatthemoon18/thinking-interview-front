import { FormControl } from '@angular/forms';
import { describe, expect, it, vi } from 'vitest';
import { dateRule, trimmedLength } from './validators';

describe('Validaciones de formularios', () => {
  it('compara el día actual de los eventos contra UTC, como el servidor', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-09T01:30:00Z'));
      expect(dateRule(undefined, true)(new FormControl('2026-11-09'))).toBeNull();
      expect(dateRule(undefined, true)(new FormControl('2026-11-10'))).toEqual({ future: true });
    } finally {
      vi.useRealTimers();
    }
  });
  it('rechaza espacios, títulos cortos y descripciones largas', () => {
    expect(trimmedLength(5, 120)(new FormControl('     '))).not.toBeNull();
    expect(trimmedLength(5, 120)(new FormControl('abcd'))).not.toBeNull();
    expect(trimmedLength(1, 2000)(new FormControl('a'.repeat(2001)))).not.toBeNull();
    expect(trimmedLength(5, 120)(new FormControl('  Título válido  '))).toBeNull();
  });
  it('rechaza fechas imposibles, futuras y anteriores al evento', () => {
    expect(dateRule()(new FormControl('2026-02-30'))).toEqual({ date: true });
    expect(dateRule(undefined, true)(new FormControl('2999-01-01'))).toEqual({ future: true });
    expect(dateRule(() => '2026-10-30')(new FormControl('2026-10-29'))).toEqual({
      beforeEvent: true,
    });
    expect(dateRule(() => '2026-10-30')(new FormControl('2026-10-30'))).toBeNull();
  });
});
