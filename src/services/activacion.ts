import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Cartera } from '../types';
import { getMesAnioActual, periodoEsActualOFuturo } from '../utils/activo';

function calcularFechaVencimientoCobro(
  fechaBase: Timestamp | undefined,
  mes: number,
  anio: number
): Timestamp | undefined {
  if (!fechaBase) return fechaBase;
  const dateBase = fechaBase.toDate();
  const nuevaFecha = new Date(
    anio,
    mes - 1,
    dateBase.getDate(),
    dateBase.getHours(),
    dateBase.getMinutes(),
    dateBase.getSeconds()
  );
  return Timestamp.fromDate(nuevaFecha);
}

/** Elimina cobros Pendiente del mes actual y futuros para una cartera. */
export async function eliminarCobrosPendientesDesdeActual(carteraId: string): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, 'cobros_mensuales'),
      where('carteraId', '==', carteraId),
      where('estado', '==', 'Pendiente')
    )
  );

  const batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    const { mes, anio } = d.data();
    if (periodoEsActualOFuturo(mes, anio)) {
      batch.delete(d.ref);
      count++;
    }
  }
  if (count > 0) await batch.commit();
  return count;
}

/** Crea cobro del mes actual si la cartera se reactiva y aún no existe. */
export async function generarCobroMesActualSiNecesario(cartera: Cartera): Promise<void> {
  const { mes, anio } = getMesAnioActual();

  const existSnap = await getDocs(
    query(
      collection(db, 'cobros_mensuales'),
      where('carteraId', '==', cartera.id),
      where('mes', '==', mes),
      where('anio', '==', anio)
    )
  );
  if (!existSnap.empty) return;

  const batch = writeBatch(db);
  const cobroRef = doc(collection(db, 'cobros_mensuales'));
  batch.set(cobroRef, {
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
  await batch.commit();
}

export async function setCarteraActiva(carteraId: string, activa: boolean): Promise<void> {
  const carteraRef = doc(db, 'carteras', carteraId);
  const batch = writeBatch(db);
  batch.update(carteraRef, {
    activa,
    fechaInactivacion: activa ? null : serverTimestamp(),
  });
  await batch.commit();

  if (!activa) {
    await eliminarCobrosPendientesDesdeActual(carteraId);
  } else {
    const carteraSnap = await getDoc(doc(db, 'carteras', carteraId));
    if (carteraSnap.exists()) {
      const cartera = { id: carteraSnap.id, ...carteraSnap.data() } as Cartera;
      await generarCobroMesActualSiNecesario(cartera);
    }
  }
}

export async function setClienteActivo(clienteId: string, activo: boolean): Promise<void> {
  const clienteRef = doc(db, 'clientes', clienteId);
  const batch = writeBatch(db);
  batch.update(clienteRef, {
    activo,
    fechaInactivacion: activo ? null : serverTimestamp(),
  });

  const carterasSnap = await getDocs(
    query(collection(db, 'carteras'), where('clienteId', '==', clienteId))
  );

  for (const d of carterasSnap.docs) {
    batch.update(d.ref, {
      activa: activo,
      fechaInactivacion: activo ? null : serverTimestamp(),
    });
  }
  await batch.commit();

  for (const d of carterasSnap.docs) {
    if (!activo) {
      await eliminarCobrosPendientesDesdeActual(d.id);
    } else {
      const cartera = { id: d.id, ...d.data() } as Cartera;
      await generarCobroMesActualSiNecesario(cartera);
    }
  }
}
