import type { Aliado, Cartera, Cliente, CobroMensual, LiquidacionAliado } from '../types';
import { carteraCuentaEnMes, esCarteraActiva, esClienteActivo } from './activo';
import { esPagoAnticipado } from '../components/carteras/AdelantoIndicators';
import {
  calcularParticipacion,
  esLiquidacionPendienteHasta,
  mesDeFactura,
  resumenParticipacion,
} from './participacionAliado';

export type DesgloseReferidos = {
  referidos: number;
  carteras: number;
  total: number;
  facturado: number;
  porCobrar: number;
  otros: number;
  facturadoCantidad: number;
  porCobrarCantidad: number;
  otrosCantidad: number;
};

/** Portafolio referidos: valorCartera × % por cartera (facturado / otros / por cobrar). */
export function desgloseReferidosPortafolio(opts: {
  carteras: Cartera[];
  clientesMap: Map<string, Cliente>;
  cobrosDelMes: CobroMensual[];
  aliados: Aliado[];
  mes: number;
  anio: number;
  /** Si se pasa, solo ese aliado. */
  aliadoId?: string;
}): DesgloseReferidos {
  const { carteras, clientesMap, cobrosDelMes, aliados, mes, anio, aliadoId } = opts;
  const cobroPorCartera = new Map<string, CobroMensual>();
  for (const cobro of cobrosDelMes) cobroPorCartera.set(cobro.carteraId, cobro);

  const clientesIds = new Set<string>();
  let carterasCount = 0;
  let total = 0;
  let facturado = 0;
  let porCobrar = 0;
  let otros = 0;
  let facturadoCantidad = 0;
  let porCobrarCantidad = 0;
  let otrosCantidad = 0;

  for (const cartera of carteras) {
    if (!esCarteraActiva(cartera)) continue;
    if (!carteraCuentaEnMes(cartera, mes, anio)) continue;
    const cliente = clientesMap.get(cartera.clienteId);
    if (!cliente || !esClienteActivo(cliente)) continue;
    if (aliadoId && cliente.aliadoId !== aliadoId) continue;
    const info = resumenParticipacion(cliente, aliados);
    if (!info || !cliente.aliadoId) continue;
    const monto = calcularParticipacion(cartera.valorCartera, info.porcentaje);
    if (monto <= 0) continue;

    clientesIds.add(cliente.id);
    carterasCount += 1;
    total += monto;

    const cobro = cobroPorCartera.get(cartera.id);
    if (!cobro || cobro.esCortesia || esPagoAnticipado(cobro)) {
      otros += monto;
      otrosCantidad += 1;
    } else if (cobro.estado === 'Pagado') {
      facturado += monto;
      facturadoCantidad += 1;
    } else {
      porCobrar += monto;
      porCobrarCantidad += 1;
    }
  }

  return {
    referidos: clientesIds.size,
    carteras: carterasCount,
    total,
    facturado,
    porCobrar,
    otros,
    facturadoCantidad,
    porCobrarCantidad,
    otrosCantidad,
  };
}

/**
 * Por pagar: solo lo AÚN pendiente de transferir.
 * - Este mes: Facturado+Otros del portafolio, pero solo la parte no pagada al aliado.
 * - Anteriores: liquidaciones pendientes de meses previos.
 * Si ya se pagó en un mes anterior (p. ej. anticipo), no vuelve a contar el mes siguiente.
 */
export function porPagarDesdePortafolio(opts: {
  desglose: Pick<DesgloseReferidos, 'facturado' | 'otros'>;
  liquidaciones: LiquidacionAliado[];
  mes: number;
  anio: number;
  aliadoId?: string;
}) {
  const { desglose, liquidaciones, mes, anio, aliadoId } = opts;
  let anteriores = 0;
  let cantidadAnteriores = 0;
  let liqEsteMesTotal = 0;
  let liqEsteMesPendiente = 0;
  let cantidadEsteMesPendiente = 0;

  for (const l of liquidaciones) {
    if (aliadoId && l.aliadoId !== aliadoId) continue;
    if (l.estado === 'Pagado') continue;

    const f = mesDeFactura(l);
    const esEsteMes = f.mes === mes && f.anio === anio;

    if (esEsteMes) {
      liqEsteMesPendiente += l.montoParticipacion;
      cantidadEsteMesPendiente += 1;
      continue;
    }

    if (!esLiquidacionPendienteHasta(l, mes, anio)) continue;
    anteriores += l.montoParticipacion;
    cantidadAnteriores += 1;
  }

  // Total de liquidaciones del mes (pagadas + pendientes) para prorratear el portafolio.
  for (const l of liquidaciones) {
    if (aliadoId && l.aliadoId !== aliadoId) continue;
    const f = mesDeFactura(l);
    if (f.mes === mes && f.anio === anio) liqEsteMesTotal += l.montoParticipacion;
  }

  const portafolioEsteMes = desglose.facturado + desglose.otros;

  let esteMes = 0;
  if (liqEsteMesPendiente <= 0) {
    // Nada pendiente este mes (todo pagado o sin liquidaciones nuevas).
    esteMes = 0;
  } else if (liqEsteMesTotal > 0) {
    esteMes = Math.round(portafolioEsteMes * (liqEsteMesPendiente / liqEsteMesTotal));
  } else {
    esteMes = liqEsteMesPendiente;
  }

  return {
    esteMes,
    anteriores,
    total: esteMes + anteriores,
    cantidadAnteriores,
    cantidadEsteMesPendiente,
  };
}
