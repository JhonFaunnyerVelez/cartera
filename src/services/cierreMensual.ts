/**
 * Servicio de Cierre Mensual
 *
 * Ejecuta una transacción en lote (Batch Write) que:
 * 1. Lee todos los cobros_mensuales del mes actual
 * 2. Calcula totales (recaudado y mora)
 * 3. Guarda el resumen en cierres_historicos
 * 4. Lee todas las carteras activas
 * 5. Genera nuevos cobros_mensuales para el mes siguiente
 *
 * Usa writeBatch para garantizar atomicidad: si algo falla, nada se escribe.
 */

import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CobroMensual, Cartera } from '../types';

export interface CierreResult {
  totalRecaudado: number;
  totalMora: number;
  cantidadCarteras: number;
  mesActual: number;
  anioActual: number;
  mesSiguiente: number;
  anioSiguiente: number;
}

/**
 * Calcula el mes y año siguiente dado un mes y año actuales.
 */
function siguienteMes(mes: number, anio: number): { mes: number; anio: number } {
  return mes === 12 ? { mes: 1, anio: anio + 1 } : { mes: mes + 1, anio };
}

/**
 * Formatea el ID del cierre como "MM-YYYY".
 */
export function formatCierreId(mes: number, anio: number): string {
  return `${String(mes).padStart(2, '0')}-${anio}`;
}

/**
 * Calcula la fecha de vencimiento para el mes y año específicos,
 * manteniendo el día y hora de la fecha base.
 */
function calcularFechaVencimientoCobro(fechaBase: Timestamp | undefined, mes: number, anio: number): Timestamp | undefined {
  if (!fechaBase) return fechaBase;
  const dateBase = fechaBase.toDate();
  const nuevaFecha = new Date(anio, mes - 1, dateBase.getDate(), dateBase.getHours(), dateBase.getMinutes(), dateBase.getSeconds());
  return Timestamp.fromDate(nuevaFecha);
}

/**
 * Ejecuta el cierre mensual completo usando un Batch Write.
 * @param mesActual - Mes a cerrar (1-12)
 * @param anioActual - Año a cerrar
 * @param ejecutadoPor - Email del usuario que ejecuta el cierre
 */
export async function ejecutarCierreMensual(
  mesActual: number,
  anioActual: number,
  ejecutadoPor: string
): Promise<CierreResult> {
  const batch = writeBatch(db);

  // ─── PASO 1: Leer cobros del mes actual ──────────────────────────────────
  const cobrosQuery = query(
    collection(db, 'cobros_mensuales'),
    where('mes', '==', mesActual),
    where('anio', '==', anioActual)
  );
  const cobrosSnap = await getDocs(cobrosQuery);
  const cobros = cobrosSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CobroMensual));

  // ─── PASO 2: Calcular totales ─────────────────────────────────────────────
  let totalRecaudado = 0;
  let totalMora = 0;

  for (const cobro of cobros) {
    if (cobro.estado === 'Pagado') {
      totalRecaudado += cobro.valorCobro;
    } else {
      // Pendiente o Mora → deuda
      totalMora += cobro.valorCobro;
    }
  }

  // Marcar los cobros pendientes como 'Mora' al cerrar el mes
  for (const cobro of cobros) {
    if (cobro.estado === 'Pendiente') {
      const cobroRef = doc(db, 'cobros_mensuales', cobro.id);
      batch.update(cobroRef, { estado: 'Mora' });
    }
  }

  // ─── PASO 3: Guardar el cierre histórico ─────────────────────────────────
  const cierreId = formatCierreId(mesActual, anioActual);
  const cierreRef = doc(db, 'cierres_historicos', cierreId);
  batch.set(cierreRef, {
    mes: mesActual,
    anio: anioActual,
    totalRecaudado,
    totalMora,
    cantidadCarterasActivas: cobros.length,
    fechaEjecucionCierre: serverTimestamp(),
    ejecutadoPor,
  });

  // ─── PASO 4: Leer carteras activas (todas, sin importar estado) ───────────
  const carterasSnap = await getDocs(collection(db, 'carteras'));
  const carteras = carterasSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Cartera));

  // ─── PASO 5: Generar cobros para el mes siguiente ─────────────────────────
  const { mes: mesSig, anio: anioSig } = siguienteMes(mesActual, anioActual);

  // Verificar que no existan ya cobros para el mes siguiente (idempotencia)
  const cobrosExistQuery = query(
    collection(db, 'cobros_mensuales'),
    where('mes', '==', mesSig),
    where('anio', '==', anioSig)
  );
  const cobrosExistSnap = await getDocs(cobrosExistQuery);
  const carterasConCobro = new Set(cobrosExistSnap.docs.map((d) => d.data().carteraId));

  for (const cartera of carteras) {
    // Omitir carteras que ya tienen cobro generado para el mes siguiente
    if (carterasConCobro.has(cartera.id)) continue;

    const nuevoCobro: Omit<CobroMensual, 'id'> = {
      carteraId: cartera.id,
      carteraNombre: cartera.nombre || '',
      clienteId: cartera.clienteId,
      clienteNombre: cartera.clienteNombre || '',
      mes: mesSig,
      anio: anioSig,
      valorCobro: cartera.valorCartera,
      estado: 'Pendiente',
      fechaPago: null,
      fechaVencimiento: calcularFechaVencimientoCobro(cartera.fechaVencimientoMensual, mesSig, anioSig),
    };

    const nuevoCobroRef = doc(collection(db, 'cobros_mensuales'));
    batch.set(nuevoCobroRef, nuevoCobro);
  }

  // ─── COMMIT ATÓMICO ───────────────────────────────────────────────────────
  // Si alguna operación falla, NINGUNA se aplica.
  await batch.commit();

  return {
    totalRecaudado,
    totalMora,
    cantidadCarteras: cobros.length,
    mesActual,
    anioActual,
    mesSiguiente: mesSig,
    anioSiguiente: anioSig,
  };
}

/**
 * Genera los cobros_mensuales para el mes/año indicado a partir de las carteras activas.
 * Útil para inicializar el primer mes sin necesidad de cerrar uno anterior.
 */
export async function generarCobrosParaMes(mes: number, anio: number): Promise<number> {
  const batch = writeBatch(db);

  const carterasSnap = await getDocs(collection(db, 'carteras'));
  const carteras = carterasSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Cartera));

  // Verificar cuáles ya tienen cobro para este mes
  const existQuery = query(
    collection(db, 'cobros_mensuales'),
    where('mes', '==', mes),
    where('anio', '==', anio)
  );
  const existSnap = await getDocs(existQuery);
  const yaExisten = new Set(existSnap.docs.map((d) => d.data().carteraId));

  let count = 0;
  for (const cartera of carteras) {
    if (yaExisten.has(cartera.id)) continue;

    const ref = doc(collection(db, 'cobros_mensuales'));
    batch.set(ref, {
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
    });
    count++;
  }

  if (count > 0) await batch.commit();
  return count;
}
