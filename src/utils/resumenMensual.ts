import type { Cartera, CobroMensual } from '../types';
import { sumaACajaMes } from '../components/carteras/AdelantoIndicators';
import { getMesAnioActual } from './activo';
import { combinarCobrosConVirtuales } from './cobrosVirtuales';
import { esMesActual, esMesFuturo, esMesPasado, formatPeriodoId } from './periodo';

export interface ResumenMensual {
  id: string;
  mes: number;
  anio: number;
  totalEsperado: number;
  totalCaja: number;
  totalPorCobrar: number;
  cantidadCobros: number;
  cantidadPagados: number;
  cantidadPendientes: number;
  pctRecaudo: number;
  esMesActual: boolean;
  esMesFuturo: boolean;
  esMesPasado: boolean;
}

export interface TotalesResumen {
  totalEsperado: number;
  totalCaja: number;
  totalPorCobrar: number;
  cantidadCobros: number;
  cantidadPagados: number;
  cantidadPendientes: number;
  pctRecaudo: number;
  mesesConDatos: number;
}

export function calcularResumenMes(cobros: CobroMensual[], mes: number, anio: number): ResumenMensual {
  let totalEsperado = 0;
  let totalCaja = 0;
  let totalPorCobrar = 0;
  let cantidadPagados = 0;
  let cantidadPendientes = 0;

  for (const cobro of cobros) {
    totalEsperado += cobro.valorCobro;
    if (cobro.estado === 'Pagado') {
      cantidadPagados++;
      totalCaja += sumaACajaMes(cobro);
    } else {
      cantidadPendientes++;
      totalPorCobrar += cobro.valorCobro;
    }
  }

  const pctRecaudo = totalEsperado > 0 ? Math.round((totalCaja / totalEsperado) * 100) : 0;

  return {
    id: formatPeriodoId(mes, anio),
    mes,
    anio,
    totalEsperado,
    totalCaja,
    totalPorCobrar,
    cantidadCobros: cobros.length,
    cantidadPagados,
    cantidadPendientes,
    pctRecaudo,
    esMesActual: esMesActual(mes, anio),
    esMesFuturo: esMesFuturo(mes, anio),
    esMesPasado: esMesPasado(mes, anio),
  };
}

export function sumarTotales(resumenes: ResumenMensual[]): TotalesResumen {
  const acum = resumenes.reduce(
    (acc, r) => ({
      totalEsperado: acc.totalEsperado + r.totalEsperado,
      totalCaja: acc.totalCaja + r.totalCaja,
      totalPorCobrar: acc.totalPorCobrar + r.totalPorCobrar,
      cantidadCobros: acc.cantidadCobros + r.cantidadCobros,
      cantidadPagados: acc.cantidadPagados + r.cantidadPagados,
      cantidadPendientes: acc.cantidadPendientes + r.cantidadPendientes,
      mesesConDatos: acc.mesesConDatos + (r.cantidadCobros > 0 ? 1 : 0),
    }),
    {
      totalEsperado: 0,
      totalCaja: 0,
      totalPorCobrar: 0,
      cantidadCobros: 0,
      cantidadPagados: 0,
      cantidadPendientes: 0,
      mesesConDatos: 0,
    }
  );

  return {
    ...acum,
    pctRecaudo: acum.totalEsperado > 0 ? Math.round((acum.totalCaja / acum.totalEsperado) * 100) : 0,
  };
}

function cobrosDelPeriodo(
  cobrosReales: CobroMensual[],
  carteras: Cartera[],
  mes: number,
  anio: number
): CobroMensual[] {
  const delMes = cobrosReales.filter(c => c.mes === mes && c.anio === anio);
  if (esMesPasado(mes, anio)) return delMes;
  return combinarCobrosConVirtuales(delMes, carteras, mes, anio);
}

/** Resúmenes de los 12 meses de un año (incluye proyección en mes actual/futuro). */
export function buildResumenesAnio(
  anio: number,
  cobrosReales: CobroMensual[],
  carteras: Cartera[]
): ResumenMensual[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const cobros = cobrosDelPeriodo(cobrosReales, carteras, mes, anio);
    return calcularResumenMes(cobros, mes, anio);
  });
}

/** Resúmenes de todos los meses que tienen cobros reales o proyección. */
export function buildResumenesHistoricos(
  cobrosReales: CobroMensual[],
  carteras: Cartera[]
): ResumenMensual[] {
  const periodos = new Set<string>();
  for (const c of cobrosReales) {
    periodos.add(formatPeriodoId(c.mes, c.anio));
  }

  const { mes: mesAct, anio: anioAct } = getMesAnioActual();
  periodos.add(formatPeriodoId(mesAct, anioAct));

  const resumenes: ResumenMensual[] = [];

  for (const id of periodos) {
    const [mm, yyyy] = id.split('-');
    const mes = Number(mm);
    const anio = Number(yyyy);
    const cobros = cobrosDelPeriodo(cobrosReales, carteras, mes, anio);
    if (cobros.length === 0) continue;
    resumenes.push(calcularResumenMes(cobros, mes, anio));
  }

  return resumenes.sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}

export function obtenerAniosDisponibles(cobros: CobroMensual[]): number[] {
  const anios = new Set<number>([new Date().getFullYear()]);
  for (const c of cobros) anios.add(c.anio);
  return [...anios].sort((a, b) => b - a);
}
