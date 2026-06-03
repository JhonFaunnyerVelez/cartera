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
}

// ─── CARTERAS ─────────────────────────────────────────────────────────────────
export type EstadoCartera = 'Al día' | 'Mora' | 'Próximo a vencer';

export interface Cartera {
  id: string;
  nombre: string;           // ← nombre descriptivo de la cartera
  clienteId: string;
  clienteNombre?: string;   // desnormalizado para consultas rápidas
  valorCartera: number;
  costoTotal: number;
  fechaCreacion: Timestamp;
  fechaRenovacion: Timestamp;
  fechaVencimientoMensual: Timestamp;
  estado: EstadoCartera;
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

// ─── PAGOS (legacy, opcional) ─────────────────────────────────────────────────
export interface Pago {
  id: string;
  carteraId: string;
  monto: number;
  fechaPago: Timestamp;
}
