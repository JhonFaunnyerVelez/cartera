import type { Aliado, Cliente } from '../types';

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

/** El aliado se paga entre el día 1 y el 5 del mes siguiente al cobro recibido. */
export function periodoLiquidacionAliado(desde = new Date()) {
  const inicio = new Date(desde.getFullYear(), desde.getMonth() + 1, 1);
  const fechaLimite = new Date(inicio.getFullYear(), inicio.getMonth(), 5, 23, 59, 59);
  return {
    mes: inicio.getMonth() + 1,
    anio: inicio.getFullYear(),
    fechaLimite,
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
export function mesDeFactura(l: { mesFacturado?: number; anioFacturado?: number; mesPago: number; anioPago: number }) {
  if (l.mesFacturado && l.anioFacturado) return { mes: l.mesFacturado, anio: l.anioFacturado };
  return sumarMes(l.mesPago, l.anioPago, -1);
}

export function etiquetaMes(mes: number, anio: number) {
  return `${MESES[mes - 1] ?? mes} ${anio}`;
}
