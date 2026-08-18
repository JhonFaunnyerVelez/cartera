import { getMesAnioActual } from './activo';

export function esMesActual(mes: number, anio: number): boolean {
  const { mes: m, anio: a } = getMesAnioActual();
  return mes === m && anio === a;
}

export function esMesFuturo(mes: number, anio: number): boolean {
  const { mes: m, anio: a } = getMesAnioActual();
  return anio > a || (anio === a && mes > m);
}

/** Período anterior al mes en curso (ya finalizó por calendario). */
export function esMesPasado(mes: number, anio: number): boolean {
  const { mes: m, anio: a } = getMesAnioActual();
  return anio < a || (anio === a && mes < m);
}

export function formatPeriodoId(mes: number, anio: number): string {
  return `${String(mes).padStart(2, '0')}-${anio}`;
}
