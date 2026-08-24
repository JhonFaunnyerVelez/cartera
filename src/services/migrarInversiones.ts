import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { InversionConfig } from '../types';

export async function migrarColeccionLegacy(inversion: InversionConfig): Promise<number> {
  if (!inversion.coleccionLegacy) return 0;

  const yaMigrados = await getDocs(
    query(
      collection(db, 'movimientos_inversion'),
      where('inversionId', '==', inversion.id)
    )
  );
  if (!yaMigrados.empty) return 0;

  const legacySnap = await getDocs(collection(db, inversion.coleccionLegacy));
  if (legacySnap.empty) return 0;

  let count = 0;
  let batch = writeBatch(db);
  let ops = 0;

  for (const docSnap of legacySnap.docs) {
    const data = docSnap.data();
    const newRef = doc(collection(db, 'movimientos_inversion'));
    batch.set(newRef, { ...data, inversionId: inversion.id });
    count++;
    ops++;

    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  return count;
}

export async function migrarTodasLasInversiones(inversiones: InversionConfig[]): Promise<void> {
  for (const inv of inversiones) {
    if (inv.coleccionLegacy) {
      await migrarColeccionLegacy(inv);
    }
  }
}
