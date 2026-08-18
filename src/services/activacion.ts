import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { periodoEsActualOFuturo } from '../utils/activo';

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

  if (!activo) {
    for (const d of carterasSnap.docs) {
      await eliminarCobrosPendientesDesdeActual(d.id);
    }
  }
}
