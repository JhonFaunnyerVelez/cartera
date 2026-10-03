import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  updateDoc,
  Timestamp,
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

/** Quita deudas no pagadas de meses anteriores a la reactivación. */
async function eliminarDeudasAnteriores(carteraId: string, desde: Timestamp): Promise<void> {
  const limite = desde.toDate();
  const mesLimite = limite.getMonth() + 1;
  const anioLimite = limite.getFullYear();
  const snap = await getDocs(
    query(collection(db, 'cobros_mensuales'), where('carteraId', '==', carteraId))
  );

  const batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.estado === 'Pagado') continue;
    const anterior = data.anio < anioLimite || (data.anio === anioLimite && data.mes < mesLimite);
    if (!anterior) continue;
    batch.delete(d.ref);
    count++;
  }
  if (count > 0) await batch.commit();
}

export async function setCarteraActiva(carteraId: string, activa: boolean): Promise<void> {
  const ahora = Timestamp.now();
  const carteraRef = doc(db, 'carteras', carteraId);
  await updateDoc(carteraRef, {
    activa,
    fechaInactivacion: activa ? null : ahora,
    ...(activa ? { fechaActivacion: ahora } : {}),
  });

  if (!activa) {
    await eliminarCobrosPendientesDesdeActual(carteraId);
    return;
  }
  await eliminarDeudasAnteriores(carteraId, ahora);
}

export async function setClienteActivo(clienteId: string, activo: boolean): Promise<void> {
  const ahora = Timestamp.now();
  const clienteRef = doc(db, 'clientes', clienteId);
  await updateDoc(clienteRef, {
    activo,
    fechaInactivacion: activo ? null : ahora,
  });

  const carterasSnap = await getDocs(
    query(collection(db, 'carteras'), where('clienteId', '==', clienteId))
  );

  const batch = writeBatch(db);
  carterasSnap.docs.forEach(d => {
    batch.update(d.ref, {
      activa: activo,
      fechaInactivacion: activo ? null : ahora,
      ...(activo ? { fechaActivacion: ahora } : {}),
    });
  });
  if (carterasSnap.docs.length > 0) await batch.commit();

  for (const d of carterasSnap.docs) {
    if (!activo) await eliminarCobrosPendientesDesdeActual(d.id);
    else await eliminarDeudasAnteriores(d.id, ahora);
  }
}
