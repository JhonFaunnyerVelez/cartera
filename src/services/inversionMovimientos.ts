import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { InversionConfig } from '../types';

export async function inversionTieneMovimientos(inv: InversionConfig): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, 'movimientos_inversion'),
      where('inversionId', '==', inv.id),
      limit(1)
    )
  );
  if (!snap.empty) return true;

  if (inv.coleccionLegacy) {
    const legacy = await getDocs(
      query(collection(db, inv.coleccionLegacy), limit(1))
    );
    return !legacy.empty;
  }

  return false;
}

export function contarMovimientosPorInversion(
  inversionId: string,
  movimientos: { inversionId: string }[]
): number {
  return movimientos.filter(m => m.inversionId === inversionId).length;
}
