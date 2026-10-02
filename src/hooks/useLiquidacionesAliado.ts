import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { LiquidacionAliado } from '../types';

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

  const marcarPagadas = async (ids: string[]) => {
    if (ids.length === 0) return;
    const ahora = Timestamp.now();
    if (ids.length === 1) {
      await updateDoc(doc(db, 'liquidaciones_aliados', ids[0]), {
        estado: 'Pagado',
        fechaPago: ahora,
      });
      return;
    }
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.update(doc(db, 'liquidaciones_aliados', id), {
        estado: 'Pagado',
        fechaPago: ahora,
      });
    });
    await batch.commit();
  };

  return { liquidaciones, loading, error, marcarPagadas };
}
