import type { InversionConfig } from '../types';

export const INVERSIONES_DEFAULT: InversionConfig[] = [
  {
    id: 'oro',
    slug: 'oro',
    nombre: 'Inversión Oro',
    descripcion: 'Control de gastos e ingresos del oro',
    color: 'amber',
    icon: 'Coins',
    orden: 1,
    activo: true,
    coleccionLegacy: 'movimientos_oro',
    labels: {
      balanceNeto: 'Ganancia neta',
      ingresosTitulo: 'Ingresos — ganancias',
      gastosTitulo: 'Gastos — plata que toca dar',
      ingresoPlaceholder: 'Ej. Venta de gramos',
      gastoPlaceholder: 'Ej. Compra de material',
      ingresoFormLabel: 'Ingreso / Ganancia',
      movimientosSubtitulo: 'Registra gastos e ingresos del periodo seleccionado.',
      historicoSubtitulo: 'Total acumulado de esta inversión, sin filtro de año.',
      resumenSubtitulo: 'Ganancias y gastos — filtra por año.',
    },
  },
  {
    id: 'cosolar',
    slug: 'cosolar',
    nombre: 'Sueldo Cosolar',
    descripcion: 'Control de sueldos e ingresos de Cosolar',
    color: 'sky',
    icon: 'Sun',
    orden: 2,
    activo: true,
    coleccionLegacy: 'movimientos_cosolar',
    labels: {
      balanceNeto: 'Ingreso neto',
      ingresosTitulo: 'Ingresos — sueldo Cosolar',
      gastosTitulo: 'Gastos — deducciones y salidas',
      ingresoPlaceholder: 'Ej. Sueldo quincena',
      gastoPlaceholder: 'Ej. Deducción / gasto',
      ingresoFormLabel: 'Ingreso / Sueldo',
      movimientosSubtitulo: 'Registra sueldos e ingresos del periodo seleccionado.',
      historicoSubtitulo: 'Total acumulado de Cosolar, sin filtro de año.',
      resumenSubtitulo: 'Ingresos y gastos — filtra por año.',
    },
  },
];

export const INVERSION_ICON_OPTIONS = [
  'Coins', 'Sun', 'TrendingUp', 'Briefcase', 'DollarSign', 'Gem',
  'Building', 'Wallet', 'PiggyBank', 'BarChart3', 'Landmark', 'Sparkles',
] as const;

export const DEFAULT_INVERSION_LABELS: InversionConfig['labels'] = {
  balanceNeto: 'Balance neto',
  ingresosTitulo: 'Ingresos',
  gastosTitulo: 'Gastos',
  ingresoPlaceholder: 'Ej. Ingreso del mes',
  gastoPlaceholder: 'Ej. Gasto del mes',
  ingresoFormLabel: 'Ingreso',
  movimientosSubtitulo: 'Registra gastos e ingresos del periodo seleccionado.',
  historicoSubtitulo: 'Total acumulado de esta inversión, sin filtro de año.',
  resumenSubtitulo: 'Resumen anual — filtra por año.',
};
