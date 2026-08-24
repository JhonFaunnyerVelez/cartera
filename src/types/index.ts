import type { Timestamp } from 'firebase/firestore';

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
export interface Cliente {
  id: string;
  nombre: string;
  empresa: string;
  ruta: string;
  pais: string;
  whatsapp?: string;
  fechaCreacion: Timestamp;
  activo?: boolean;
  fechaInactivacion?: Timestamp | null;
}

// ─── CARTERAS ─────────────────────────────────────────────────────────────────
export type EstadoCartera = 'Al día' | 'Mora' | 'Próximo a vencer';

export interface Cartera {
  id: string;
  nombre: string;           // ← nombre descriptivo de la cartera
  clienteId: string;
  clienteNombre?: string;   // desnormalizado para consultas rápidas
  valorCartera: number;
  costoTotal?: number;
  fechaCreacion: Timestamp;
  fechaRenovacion?: Timestamp;
  fechaVencimientoMensual: Timestamp;
  estado: EstadoCartera;
  activa?: boolean;
  fechaInactivacion?: Timestamp | null;
}

export interface CarteraConCliente extends Cartera {
  cliente?: Cliente;
}

// ─── COBROS MENSUALES ─────────────────────────────────────────────────────────
// Representa la instancia de pago de una cartera para un mes/año específico.
export type EstadoCobro = 'Pendiente' | 'Pagado' | 'Mora';

export interface CobroMensual {
  id: string;
  carteraId: string;
  carteraNombre?: string;   // desnormalizado
  clienteId: string;
  clienteNombre?: string;   // desnormalizado
  mes: number;              // 1-12
  anio: number;             // ej. 2026
  valorCobro: number;
  estado: EstadoCobro;
  fechaPago: Timestamp | null;
  fechaVencimiento?: Timestamp;   // copia de fechaVencimientoMensual de la cartera
  // Campos para pago adelantado
  esPagoAdelantado?: boolean;   // true cuando este cobro fue pagado en un mes anterior
  mesRecibido?: number;          // mes en que se recibió el dinero realmente
  anioRecibido?: number;         // año en que se recibió el dinero realmente
  montoAdelantado?: number;      // dinero extra recibido HOY por meses futuros (se guarda en el cobro del mes actual)
  mesesAdelantados?: number;     // total de meses pagados en la operación (incluye el mes actual)
  cobrosAdelantadosIds?: string[]; // IDs de los cobros futuros generados para poder revertirlos
  esCortesia?: boolean;         // true si el pago fue perdonado ($0 recaudados)
}

// ─── CIERRES HISTÓRICOS ───────────────────────────────────────────────────────
// Resumen de lo que ocurrió en cada mes (cierre de caja).
export interface CierreHistorico {
  id: string;               // formato "MM-YYYY", ej. "05-2026"
  mes: number;
  anio: number;
  totalRecaudado: number;
  totalMora: number;
  cantidadCarterasActivas: number;
  fechaEjecucionCierre: Timestamp;
  ejecutadoPor: string;     // email del usuario que ejecutó el cierre
}

/** Caja registrada a mano para meses anteriores al uso de la app. */
export interface CajaManual {
  id: string;               // formato "MM-YYYY"
  mes: number;
  anio: number;
  totalCaja: number;
  notas?: string;
  fechaActualizacion: Timestamp;
}

// ─── PAGOS (legacy, opcional) ─────────────────────────────────────────────────
export interface Pago {
  id: string;
  carteraId: string;
  monto: number;
  fechaPago: Timestamp;
}

// ─── INVERSIÓN ORO ────────────────────────────────────────────────────────────
export type TipoMovimientoOro = 'ingreso' | 'gasto';

export interface MovimientoOro {
  id: string;
  tipo: TipoMovimientoOro;
  monto: number;
  descripcion: string;
  mes: number;
  anio: number;
  fecha: Timestamp;
  notas?: string;
  fechaCreacion: Timestamp;
}

export interface ResumenOroMensual {
  id: string;
  mes: number;
  anio: number;
  totalIngresos: number;
  totalGastos: number;
  balance: number;
  cantidadMovimientos: number;
  cantidadIngresos: number;
  cantidadGastos: number;
  esMesActual: boolean;
  esMesFuturo: boolean;
  esMesPasado: boolean;
}

// ─── SUELDO COSOLAR ───────────────────────────────────────────────────────────
export type TipoMovimientoCosolar = 'ingreso' | 'gasto';

export interface MovimientoCosolar {
  id: string;
  tipo: TipoMovimientoCosolar;
  monto: number;
  descripcion: string;
  mes: number;
  anio: number;
  fecha: Timestamp;
  notas?: string;
  fechaCreacion: Timestamp;
}

export interface ResumenCosolarMensual {
  id: string;
  mes: number;
  anio: number;
  totalIngresos: number;
  totalGastos: number;
  balance: number;
  cantidadMovimientos: number;
  cantidadIngresos: number;
  cantidadGastos: number;
  esMesActual: boolean;
  esMesFuturo: boolean;
  esMesPasado: boolean;
}

// ─── INVERSIONES CONFIGURABLES ──────────────────────────────────────────────────
export type InversionColorName =
  | 'amber' | 'sky' | 'emerald' | 'violet' | 'rose' | 'orange' | 'teal' | 'indigo';

export type TipoMovimientoInversion = 'ingreso' | 'gasto';

export interface InversionLabels {
  balanceNeto: string;
  ingresosTitulo: string;
  gastosTitulo: string;
  ingresoPlaceholder: string;
  gastoPlaceholder: string;
  ingresoFormLabel: string;
  movimientosSubtitulo: string;
  historicoSubtitulo: string;
  resumenSubtitulo: string;
}

export interface InversionConfig {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  color: InversionColorName;
  icon: string;
  orden: number;
  activo: boolean;
  labels: InversionLabels;
  coleccionLegacy?: string;
}

export interface MovimientoInversion {
  id: string;
  inversionId: string;
  tipo: TipoMovimientoInversion;
  monto: number;
  descripcion: string;
  mes: number;
  anio: number;
  fecha: Timestamp;
  notas?: string;
  fechaCreacion: Timestamp;
}

export interface ResumenInversionMensual {
  id: string;
  mes: number;
  anio: number;
  totalIngresos: number;
  totalGastos: number;
  balance: number;
  cantidadMovimientos: number;
  cantidadIngresos: number;
  cantidadGastos: number;
  esMesActual: boolean;
  esMesFuturo: boolean;
  esMesPasado: boolean;
}
