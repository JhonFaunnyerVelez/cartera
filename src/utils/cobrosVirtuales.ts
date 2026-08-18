import { addDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { calcularFechaVencimientoCobro } from '../services/cierreMensual';
import type { Cartera, CobroMensual } from '../types';
import { esCarteraActiva, periodoEsActualOFuturo } from './activo';
import { esMesPasado } from './periodo';

export const VIRTUAL_COBO_PREFIX = 'virtual:';

export function esCobroVirtual(cobroId: string): boolean {
  return cobroId.startsWith(VIRTUAL_COBO_PREFIX);
}

function idCobroVirtual(carteraId: string): string {
  return `${VIRTUAL_COBO_PREFIX}${carteraId}`;
}

export function crearCobroVirtual(cartera: Cartera, mes: number, anio: number): CobroMensual {
  return {
    id: idCobroVirtual(cartera.id),
    carteraId: cartera.id,
    carteraNombre: cartera.nombre || '',
    clienteId: cartera.clienteId,
    clienteNombre: cartera.clienteNombre || '',
    mes,
    anio,
    valorCobro: cartera.valorCartera,
    estado: 'Pendiente',
    fechaPago: null,
    fechaVencimiento: calcularFechaVencimientoCobro(cartera.fechaVencimientoMensual, mes, anio),
  };
}

/**
 * Mes actual/futuro: cobros no pagados reflejan la configuración vigente de la cartera.
 * Los pagados conservan el valor histórico.
 */
export function alinearCobroConCartera(
  cobro: CobroMensual,
  cartera: Cartera | undefined,
  mes: number,
  anio: number
): CobroMensual {
  if (!cartera || esMesPasado(mes, anio) || cobro.estado === 'Pagado') return cobro;

  return {
    ...cobro,
    carteraNombre: cartera.nombre || cobro.carteraNombre,
    clienteNombre: cartera.clienteNombre || cobro.clienteNombre,
    valorCobro: cartera.valorCartera,
    fechaVencimiento:
      calcularFechaVencimientoCobro(cartera.fechaVencimientoMensual, mes, anio) ?? cobro.fechaVencimiento,
  };
}

/** Persiste en Firestore el precio/fecha actual en cobros abiertos del mes actual y futuros. */
export async function sincronizarCobrosPendientesCartera(cartera: Cartera): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'cobros_mensuales'),
      where('carteraId', '==', cartera.id),
      where('estado', 'in', ['Pendiente', 'Mora'])
    )
  );

  const batch = writeBatch(db);
  let count = 0;

  for (const d of snap.docs) {
    const { mes, anio } = d.data();
    if (!periodoEsActualOFuturo(mes, anio)) continue;

    batch.update(d.ref, {
      carteraNombre: cartera.nombre || '',
      clienteNombre: cartera.clienteNombre || '',
      valorCobro: cartera.valorCartera,
      fechaVencimiento: calcularFechaVencimientoCobro(cartera.fechaVencimientoMensual, mes, anio) ?? null,
    });
    count++;
  }

  if (count > 0) await batch.commit();
}

/** Completa cobros reales con proyecciones de carteras activas que aún no tienen documento. */
export function combinarCobrosConVirtuales(
  cobrosReales: CobroMensual[],
  carteras: Cartera[],
  mes: number,
  anio: number
): CobroMensual[] {
  const carterasMap = new Map(carteras.map(c => [c.id, c]));
  const alineados = cobrosReales.map(c =>
    alinearCobroConCartera(c, carterasMap.get(c.carteraId), mes, anio)
  );
  const carterasConCobro = new Set(alineados.map(c => c.carteraId));
  const virtuales: CobroMensual[] = [];

  for (const cartera of carteras) {
    if (!esCarteraActiva(cartera)) continue;
    if (carterasConCobro.has(cartera.id)) continue;
    virtuales.push(crearCobroVirtual(cartera, mes, anio));
  }

  return [...alineados, ...virtuales];
}

/** Persiste un cobro proyectado antes de registrar pago u otra acción. */
export async function materializarCobroVirtual(cobro: CobroMensual): Promise<string> {
  if (!esCobroVirtual(cobro.id)) return cobro.id;

  const { id: _id, ...data } = cobro;
  const ref = await addDoc(collection(db, 'cobros_mensuales'), {
    ...data,
    estado: 'Pendiente',
    fechaPago: null,
  });
  return ref.id;
}
