import type { Cartera, CobroMensual, InversionConfig, MovimientoInversion } from '../types';
import { esMesActual, formatPeriodoId } from './periodo';
import {
  buildResumenesAnio,
  buildResumenesHistoricos,
  sumarTotales,
  type CajaManualMap,
} from './resumenMensual';
import {
  buildResumenesInversionAnio,
  buildResumenesInversionHistoricos,
  sumarTotalesInversion,
} from './resumenInversion';

export interface ResumenGeneralMensual {
  id: string;
  mes: number;
  anio: number;
  gananciaCartera: number;
  gananciasInversion: Record<string, number>;
  totalGeneral: number;
  esMesActual: boolean;
}

export interface TotalesGeneral {
  gananciaCartera: number;
  gananciasInversion: Record<string, number>;
  totalGeneral: number;
  mesesConDatos: number;
}

function agruparMovimientosPorInversion(movimientos: MovimientoInversion[]): Record<string, MovimientoInversion[]> {
  const map: Record<string, MovimientoInversion[]> = {};
  for (const m of movimientos) {
    if (!map[m.inversionId]) map[m.inversionId] = [];
    map[m.inversionId].push(m);
  }
  return map;
}

export function buildResumenGeneralAnio(
  anio: number,
  cobros: CobroMensual[],
  carteras: Cartera[],
  inversiones: InversionConfig[],
  movimientos: MovimientoInversion[],
  cajaManual: CajaManualMap = {}
): ResumenGeneralMensual[] {
  const resCartera = buildResumenesAnio(anio, cobros, carteras, cajaManual);
  const porInversion = agruparMovimientosPorInversion(movimientos);

  const resInversiones = inversiones.map(inv => ({
    id: inv.id,
    resumenes: buildResumenesInversionAnio(anio, porInversion[inv.id] || []),
  }));

  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const gananciasInversion: Record<string, number> = {};
    let totalInv = 0;

    for (const { id, resumenes } of resInversiones) {
      const bal = resumenes[i].balance;
      gananciasInversion[id] = bal;
      totalInv += bal;
    }

    const gananciaCartera = resCartera[i].totalCaja;

    return {
      id: formatPeriodoId(mes, anio),
      mes,
      anio,
      gananciaCartera,
      gananciasInversion,
      totalGeneral: gananciaCartera + totalInv,
      esMesActual: esMesActual(mes, anio),
    };
  });
}

export function calcularTotalesGeneral(resumenes: ResumenGeneralMensual[]): TotalesGeneral {
  const gananciasInversion: Record<string, number> = {};

  const acum = resumenes.reduce(
    (acc, r) => {
      for (const [id, val] of Object.entries(r.gananciasInversion)) {
        gananciasInversion[id] = (gananciasInversion[id] || 0) + val;
      }
      return {
        gananciaCartera: acc.gananciaCartera + r.gananciaCartera,
        totalGeneral: acc.totalGeneral + r.totalGeneral,
        mesesConDatos: acc.mesesConDatos + (r.totalGeneral > 0 ? 1 : 0),
      };
    },
    { gananciaCartera: 0, totalGeneral: 0, mesesConDatos: 0 }
  );

  return { ...acum, gananciasInversion };
}

export function calcularTotalesGeneralHistoricos(
  cobros: CobroMensual[],
  carteras: Cartera[],
  inversiones: InversionConfig[],
  movimientos: MovimientoInversion[],
  cajaManual: CajaManualMap = {}
): TotalesGeneral {
  const cartera = sumarTotales(buildResumenesHistoricos(cobros, carteras, cajaManual));
  const porInversion = agruparMovimientosPorInversion(movimientos);

  const gananciasInversion: Record<string, number> = {};
  let totalInv = 0;

  for (const inv of inversiones) {
    const tot = sumarTotalesInversion(
      buildResumenesInversionHistoricos(porInversion[inv.id] || [])
    );
    gananciasInversion[inv.id] = tot.balance;
    totalInv += tot.balance;
  }

  return {
    gananciaCartera: cartera.totalCaja,
    gananciasInversion,
    totalGeneral: cartera.totalCaja + totalInv,
    mesesConDatos: 0,
  };
}

export function obtenerAniosDisponiblesGeneral(
  cobros: CobroMensual[],
  movimientos: MovimientoInversion[],
  cajaManual: CajaManualMap = {}
): number[] {
  const anios = new Set<number>([new Date().getFullYear()]);

  for (const c of cobros) anios.add(c.anio);
  for (const m of movimientos) anios.add(m.anio);
  for (const id of Object.keys(cajaManual)) {
    const anio = Number(id.split('-')[1]);
    if (!isNaN(anio)) anios.add(anio);
  }

  return [...anios].sort((a, b) => b - a);
}
