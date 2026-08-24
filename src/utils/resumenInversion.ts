import type { MovimientoInversion, ResumenInversionMensual } from '../types';
import { getMesAnioActual } from './activo';
import { esMesActual, esMesFuturo, esMesPasado, formatPeriodoId } from './periodo';

export interface TotalesResumenInversion {
  totalIngresos: number;
  totalGastos: number;
  balance: number;
  cantidadMovimientos: number;
  cantidadIngresos: number;
  cantidadGastos: number;
  mesesConDatos: number;
}

export function calcularResumenInversionMes(
  movimientos: MovimientoInversion[],
  mes: number,
  anio: number
): ResumenInversionMensual {
  let totalIngresos = 0;
  let totalGastos = 0;
  let cantidadIngresos = 0;
  let cantidadGastos = 0;

  for (const mov of movimientos) {
    if (mov.tipo === 'ingreso') {
      totalIngresos += mov.monto;
      cantidadIngresos++;
    } else {
      totalGastos += mov.monto;
      cantidadGastos++;
    }
  }

  return {
    id: formatPeriodoId(mes, anio),
    mes,
    anio,
    totalIngresos,
    totalGastos,
    balance: totalIngresos - totalGastos,
    cantidadMovimientos: movimientos.length,
    cantidadIngresos,
    cantidadGastos,
    esMesActual: esMesActual(mes, anio),
    esMesFuturo: esMesFuturo(mes, anio),
    esMesPasado: esMesPasado(mes, anio),
  };
}

export function sumarTotalesInversion(resumenes: ResumenInversionMensual[]): TotalesResumenInversion {
  return resumenes.reduce(
    (acc, r) => ({
      totalIngresos: acc.totalIngresos + r.totalIngresos,
      totalGastos: acc.totalGastos + r.totalGastos,
      balance: acc.balance + r.balance,
      cantidadMovimientos: acc.cantidadMovimientos + r.cantidadMovimientos,
      cantidadIngresos: acc.cantidadIngresos + r.cantidadIngresos,
      cantidadGastos: acc.cantidadGastos + r.cantidadGastos,
      mesesConDatos: acc.mesesConDatos + (r.cantidadMovimientos > 0 ? 1 : 0),
    }),
    {
      totalIngresos: 0,
      totalGastos: 0,
      balance: 0,
      cantidadMovimientos: 0,
      cantidadIngresos: 0,
      cantidadGastos: 0,
      mesesConDatos: 0,
    }
  );
}

export function buildResumenesInversionAnio(anio: number, movimientos: MovimientoInversion[]): ResumenInversionMensual[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const delMes = movimientos.filter(m => m.mes === mes && m.anio === anio);
    return calcularResumenInversionMes(delMes, mes, anio);
  });
}

export function buildResumenesInversionHistoricos(movimientos: MovimientoInversion[]): ResumenInversionMensual[] {
  const periodos = new Set<string>();
  for (const m of movimientos) {
    periodos.add(formatPeriodoId(m.mes, m.anio));
  }

  const { mes: mesAct, anio: anioAct } = getMesAnioActual();
  periodos.add(formatPeriodoId(mesAct, anioAct));

  const resumenes: ResumenInversionMensual[] = [];

  for (const id of periodos) {
    const [mm, yyyy] = id.split('-');
    const mes = Number(mm);
    const anio = Number(yyyy);
    const delMes = movimientos.filter(m => m.mes === mes && m.anio === anio);
    if (delMes.length === 0) continue;
    resumenes.push(calcularResumenInversionMes(delMes, mes, anio));
  }

  return resumenes.sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}

export function obtenerAniosDisponiblesInversion(movimientos: MovimientoInversion[]): number[] {
  const anios = new Set<number>([new Date().getFullYear()]);
  for (const m of movimientos) anios.add(m.anio);
  return [...anios].sort((a, b) => b - a);
}
