import type { Cliente, Cartera, CobroMensual } from '../types';

/** Carteras sin campo `activa` se consideran activas. Apagada si `activa` es falso o tiene fecha de baja. */
export function esCarteraActiva(cartera: Cartera): boolean {
  if (cartera.fechaInactivacion) return false;
  const marca = cartera.activa as unknown;
  if (marca === false || marca === 'false' || marca === 0) return false;
  return true;
}

/** Clientes sin campo `activo` se consideran activos. */
export function esClienteActivo(cliente: Cliente): boolean {
  if (cliente.fechaInactivacion) return false;
  const marca = cliente.activo as unknown;
  if (marca === false || marca === 'false' || marca === 0) return false;
  return true;
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

/** La cartera cuenta en ese mes solo desde su fecha de activación. */
export function carteraCuentaEnMes(cartera: Cartera, mes: number, anio: number): boolean {
  const finMes = new Date(anio, mes, 0, 23, 59, 59, 999);
  const activada = cartera.fechaActivacion?.toDate?.();
  if (activada) return activada.getTime() <= finMes.getTime();

  const creada = cartera.fechaCreacion?.toDate?.();
  if (!creada) return true;
  return creada.getTime() <= finMes.getTime();
}

/**
 * En Carteras no se muestra una cartera apagada ni la de un cliente apagado.
 * Una cartera activa solo entra desde su fecha de activación; lo ya pagado sí queda.
 */
export function cobroVisibleEnMes(
  cobro: CobroMensual,
  cartera: Cartera | undefined,
  cliente: Cliente | undefined,
): boolean {
  if (!cartera || !esCarteraActiva(cartera)) return false;
  if (!cliente || !esClienteActivo(cliente)) return false;
  if (cobro.estado !== 'Pagado' && !carteraCuentaEnMes(cartera, cobro.mes, cobro.anio)) return false;
  return true;
}
