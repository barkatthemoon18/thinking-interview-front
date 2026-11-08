import { describe, expect, it } from 'vitest';
import { DemoStore } from './demo.store';
import { USERS } from './models';

describe('Flujo simulado (no verifica seguridad del servidor)', () => {
  const [reportante1, reportante2, revisor] = USERS;
  it('separa los registros de los dos reportantes y rechaza el detalle ajeno', () => {
    const store = new DemoStore();
    expect(store.list(reportante1).map((item) => item.id)).toEqual(['1', '3']);
    expect(store.list(reportante2).map((item) => item.id)).toEqual(['2', '4']);
    expect(() => store.get('2', reportante1)).toThrow('sin permiso');
    expect(store.list(revisor)).toHaveLength(4);
  });
  it('impide cerrar con acciones pendientes y permite cerrar tras completarlas', () => {
    const store = new DemoStore();
    expect(() => store.transition('2', 'cerrado', revisor)).toThrow('acciones pendientes');
    expect(store.get('2', revisor).estado).toBe('en_revision');
    store.complete('2', 'a1', revisor);
    store.transition('2', 'cerrado', revisor);
    const event = store.get('2', revisor);
    expect(event.estado).toBe('cerrado');
    expect(
      event.historial
        .slice(-2)
        .every((entry) => entry.actor === 'revisor1' && Number.isFinite(Date.parse(entry.fecha))),
    ).toBe(true);
  });
  it('rechaza restricciones de rol, saltos de estado y acciones fuera de revisión', () => {
    const store = new DemoStore();
    expect(() => store.transition('1', 'en_revision', reportante1)).toThrow('Solo el revisor');
    expect(() => store.transition('1', 'cerrado', revisor)).toThrow('transición');
    expect(() => store.complete('3', 'a2', revisor)).toThrow('en revisión');
    expect(() =>
      store.create(
        {
          titulo: 'Evento ficticio',
          descripcion: 'Prueba',
          fechaEvento: '2026-01-01',
          area: 'Bodega',
        },
        revisor,
      ),
    ).toThrow('Solo un reportante');
  });
  it('no permite acciones con fecha anterior al evento', () => {
    const store = new DemoStore();
    expect(() =>
      store.addAction(
        '2',
        {
          descripcion: 'Inspeccionar extintor',
          responsable: 'Persona Ficticia',
          fechaObjetivo: '2026-10-29',
        },
        revisor,
      ),
    ).toThrow('anterior');
  });
});
