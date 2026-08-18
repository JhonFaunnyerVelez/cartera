import type { Cliente, Cartera, CobroMensual } from '../types';

/** Carteras sin campo `activa` se consideran activas (compatibilidad con datos existentes). */
export function esCarteraActiva(cartera: Cartera): boolean {
  return cartera.activa !== false;
}

/** Clientes sin campo `activo` se consideran activos. */
export function esClienteActivo(cliente: Cliente): boolean {
  return cliente.activo !== false;
}

export function getMesAnioActual(): { mes: number; anio: number } {
  const hoy = new Date();
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };
}

/** true si el período mes/anio es el mes actual o uno futuro */
export function periodoEsActualOFuturo(mes: number, anio: number): boolean {
  const { mes: mesAct, anio: anioAct } = getMesAnioActual();
  return anio > anioAct || (anio === anioAct && mes >= mesAct);
}

/**
 * Determina si un cobro debe mostrarse en la vista de un mes.
 * - Meses cerrados: siempre mostrar (historial / deuda).
 * - Cobros Pagado o Mora: siempre mostrar.
 * - Pendiente de cartera inactiva: ocultar solo en mes actual o futuros.
 *   Los meses pasados (aunque no estén cerrados) siguen visibles como deuda.
 */
export function cobroVisibleEnMes(
  cobro: CobroMensual,
  cartera: Cartera | undefined,
  esMesPasado: boolean
): boolean {
  if (esMesPasado) return true;
  if (cobro.estado === 'Pagado' || cobro.estado === 'Mora') return true;
  if (cartera && !esCarteraActiva(cartera) && periodoEsActualOFuturo(cobro.mes, cobro.anio)) {
    return false;
  }
  return true;
}
