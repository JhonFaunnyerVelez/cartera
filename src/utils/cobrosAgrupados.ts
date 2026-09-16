import type { Cliente, CobroMensual } from '../types';
import { esPagoAnticipado, tieneAdelantoRecibido } from '../components/carteras/AdelantoIndicators';

export type EstadoVisualCobro = 'pagado' | 'al-dia' | 'vencido';

export type EstadoTotalGrupo = 'pagado' | 'vencido' | 'al-dia' | 'adelanto';

export interface GrupoEmpresaCobros {
  empresa: string;
  cobros: CobroMensual[];
  cantidad: number;
  total: number;
  estadoTotal: EstadoTotalGrupo;
}

export function getEstadoVisualCobro(cobro: CobroMensual): EstadoVisualCobro {
  if (cobro.estado === 'Pagado') return 'pagado';
  if (cobro.estado === 'Mora') return 'vencido';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = cobro.fechaVencimiento?.toDate?.();
  if (!venc) return 'al-dia';
  venc.setHours(0, 0, 0, 0);
  if (venc.getTime() <= hoy.getTime()) return 'vencido';
  return 'al-dia';
}

export function calcularEstadoTotalGrupo(cobros: CobroMensual[]): EstadoTotalGrupo {
  const estados = cobros.map(getEstadoVisualCobro);
  if (estados.some(e => e === 'vencido')) return 'vencido';
  if (estados.every(e => e === 'pagado')) {
    if (cobros.some(c => esPagoAnticipado(c) || tieneAdelantoRecibido(c))) return 'adelanto';
    return 'pagado';
  }
  return 'al-dia';
}

export interface BloqueDiaCobros {
  key: string;
  dia: number;
  empresas: GrupoEmpresaCobros[];
}

function fechaKey(cobro: CobroMensual): string {
  const fecha = cobro.fechaVencimiento?.toDate?.();
  if (!fecha) return 'sin-fecha';
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function sortCobros(cobros: CobroMensual[]): CobroMensual[] {
  return [...cobros].sort((a, b) => {
    const da = a.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
    const db = b.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
    if (da !== db) return da - db;
    const cmpCartera = (a.carteraNombre || '').localeCompare(b.carteraNombre || '', 'es');
    if (cmpCartera !== 0) return cmpCartera;
    return (a.clienteNombre || '').localeCompare(b.clienteNombre || '', 'es');
  });
}

/** Orden por día (como antes) y, dentro de cada día, agrupado por empresa. */
export function agruparCobrosPorDiaYEmpresa(
  cobros: CobroMensual[],
  clientesMap: Map<string, Cliente>
): BloqueDiaCobros[] {
  const ordenados = sortCobros(cobros);
  const bloques: BloqueDiaCobros[] = [];

  let bloqueActual: BloqueDiaCobros | null = null;

  for (const cobro of ordenados) {
    const key = fechaKey(cobro);
    const dia = cobro.fechaVencimiento?.toDate?.()?.getDate() ?? 0;
    const empresa = clientesMap.get(cobro.clienteId)?.empresa?.trim() || 'Sin empresa';

    if (!bloqueActual || bloqueActual.key !== key) {
      bloqueActual = { key, dia, empresas: [] };
      bloques.push(bloqueActual);
    }

    let grupoEmp = bloqueActual.empresas.find(g => g.empresa === empresa);
    if (!grupoEmp) {
      grupoEmp = { empresa, cobros: [], cantidad: 0, total: 0, estadoTotal: 'al-dia' };
      bloqueActual.empresas.push(grupoEmp);
    }

    grupoEmp.cobros.push(cobro);
    grupoEmp.cantidad++;
    grupoEmp.total += cobro.valorCobro;
    grupoEmp.estadoTotal = calcularEstadoTotalGrupo(grupoEmp.cobros);
  }

  for (const bloque of bloques) {
    bloque.empresas.sort((a, b) => {
      const aPagada = a.estadoTotal === 'pagado' || a.estadoTotal === 'adelanto';
      const bPagada = b.estadoTotal === 'pagado' || b.estadoTotal === 'adelanto';
      if (aPagada !== bPagada) return aPagada ? -1 : 1;
      return a.empresa.localeCompare(b.empresa, 'es');
    });
  }

  return bloques;
}
