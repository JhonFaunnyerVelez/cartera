import { useEffect, useState } from 'react';
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ComprobanteAliado, LiquidacionAliado } from '../types';

export function useLiquidacionesAliado() {
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionAliado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'liquidaciones_aliados'), orderBy('fechaCreacion', 'desc'));
    return onSnapshot(q, (snap) => {
      setLiquidaciones(snap.docs.map(d => ({ id: d.id, ...d.data() } as LiquidacionAliado)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching liquidaciones aliado:', err);
      setError(err.message);
      setLoading(false);
    });
  }, []);

  const marcarPagadas = async (ids: string[], comprobantes: ComprobanteAliado[] = []) => {
    if (ids.length === 0) return;
    const ahora = Timestamp.now();
    const payload: Record<string, unknown> = {
      estado: 'Pagado',
      fechaPago: ahora,
    };
    if (comprobantes.length > 0) {
      payload.comprobantes = comprobantes;
    }

    if (ids.length === 1) {
      await updateDoc(doc(db, 'liquidaciones_aliados', ids[0]), payload);
      return;
    }
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.update(doc(db, 'liquidaciones_aliados', id), payload);
    });
    await batch.commit();
  };

  /** Vuelve las liquidaciones a Pendiente y limpia fecha/comprobantes del pago. */
  const revertirPagadas = async (ids: string[]) => {
    if (ids.length === 0) return;
    const payload = {
      estado: 'Pendiente' as const,
      fechaPago: null,
      comprobantes: deleteField(),
    };

    if (ids.length === 1) {
      await updateDoc(doc(db, 'liquidaciones_aliados', ids[0]), payload);
      return;
    }
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.update(doc(db, 'liquidaciones_aliados', id), payload);
    });
    await batch.commit();
  };

  /** Actualiza los comprobantes de liquidaciones ya pagadas (agregar/quitar). */
  const actualizarComprobantes = async (ids: string[], comprobantes: ComprobanteAliado[]) => {
    if (ids.length === 0) return;
    const payload =
      comprobantes.length > 0
        ? { comprobantes }
        : { comprobantes: deleteField() };

    if (ids.length === 1) {
      await updateDoc(doc(db, 'liquidaciones_aliados', ids[0]), payload);
      return;
    }
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.update(doc(db, 'liquidaciones_aliados', id), payload);
    });
    await batch.commit();
  };

  return { liquidaciones, loading, error, marcarPagadas, revertirPagadas, actualizarComprobantes };
}
