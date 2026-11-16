import type { Aliado, Cliente, LiquidacionAliado } from '../types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Parte del aliado, redondeada al mil más cercano (10.002 → 10.000). */
export function calcularParticipacion(montoRecibido: number, porcentaje: number): number {
  if (!porcentaje || porcentaje <= 0 || montoRecibido <= 0) return 0;
  const exacto = montoRecibido * porcentaje / 100;
  const miles = Math.round(exacto / 1000) * 1000;
  if (miles === 0) return Math.round(exacto);
  return miles;
}

/** El aliado se paga en el mismo mes en que se factura (límite día 5). */
export function periodoLiquidacionAliado(desde = new Date()) {
  const mes = desde.getMonth() + 1;
  const anio = desde.getFullYear();
  const fechaLimite = new Date(anio, desde.getMonth(), 5, 23, 59, 59);
  // Si ya pasó el día 5, el límite es el fin de ese mes.
  const finMes = new Date(anio, desde.getMonth() + 1, 0, 23, 59, 59);
  return {
    mes,
    anio,
    fechaLimite: desde.getDate() > 5 ? finMes : fechaLimite,
  };
}

export function resumenParticipacion(cliente: Cliente | undefined, aliados: Aliado[]) {
  if (!cliente?.aliadoId || !(cliente.porcentajeParticipacion && cliente.porcentajeParticipacion > 0)) return null;
  const aliado = aliados.find(a => a.id === cliente.aliadoId);
  if (!aliado || aliado.activo === false) return null;
  return {
    porcentaje: cliente.porcentajeParticipacion,
    aliadoNombre: aliado.nombre,
    aliadoCodigo: aliado.codigo,
    banco: [aliado.bancoNombre, aliado.tipoCuenta, aliado.numeroCuenta].filter(Boolean).join(' · '),
  };
}

export function sumarMes(mes: number, anio: number, delta: number) {
  const d = new Date(anio, mes - 1 + delta, 1);
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
}

/** Mes en que se facturó al aliado (cuando el cliente pagó la membresía). */
export function mesDeFactura(l: {
  mesFacturado?: number;
  anioFacturado?: number;
  mesPago: number;
  anioPago: number;
  mesCobro?: number;
  anioCobro?: number;
}) {
  if (l.mesFacturado && l.anioFacturado) return { mes: l.mesFacturado, anio: l.anioFacturado };
  if (l.mesCobro && l.anioCobro) return { mes: l.mesCobro, anio: l.anioCobro };
  // Legado: mesPago era el mes siguiente al cobro.
  return sumarMes(l.mesPago, l.anioPago, -1);
}

export function etiquetaMes(mes: number, anio: number) {
  return `${MESES[mes - 1] ?? mes} ${anio}`;
}

function periodoHasta(mes: number, anio: number, mesRef: number, anioRef: number) {
  return anio < anioRef || (anio === anioRef && mes <= mesRef);
}

/** Liquidación facturada en el mes seleccionado. */
export function esLiquidacionDelMes(
  l: Pick<LiquidacionAliado, 'mesFacturado' | 'anioFacturado' | 'mesPago' | 'anioPago' | 'mesCobro' | 'anioCobro'>,
  mes: number,
  anio: number,
) {
  const f = mesDeFactura(l);
  return f.mes === mes && f.anio === anio;
}

/**
 * Se puede marcar/pagar en este mes: facturado este mes,
 * o legado programado al mes siguiente (mesPago) aún no migrado.
 */
export function esLiquidacionPagableEnMes(
  l: Pick<LiquidacionAliado, 'mesFacturado' | 'anioFacturado' | 'mesPago' | 'anioPago' | 'mesCobro' | 'anioCobro'>,
  mes: number,
  anio: number,
) {
  if (esLiquidacionDelMes(l, mes, anio)) return true;
  return l.mesPago === mes && l.anioPago === anio;
}

/** Pendiente por transferir hasta el mes seleccionado (incluye meses anteriores). */
export function esLiquidacionPendienteHasta(
  l: Pick<LiquidacionAliado, 'estado' | 'mesFacturado' | 'anioFacturado' | 'mesPago' | 'anioPago' | 'mesCobro' | 'anioCobro'>,
  mes: number,
  anio: number,
) {
  if (l.estado === 'Pagado') return false;
  const f = mesDeFactura(l);
  if (periodoHasta(f.mes, f.anio, mes, anio)) return true;
  if (l.mesPago && l.anioPago && periodoHasta(l.mesPago, l.anioPago, mes, anio)) return true;
  return false;
}
