import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CierreHistorico } from '../types';

/**
 * Hook para obtener el historial de cierres_historicos en tiempo real,
 * ordenados del más reciente al más antiguo.
 */
export function useCierres() {
  const [cierres, setCierres] = useState<CierreHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'cierres_historicos'),
      orderBy('anio', 'desc'),
      orderBy('mes', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CierreHistorico));
        setCierres(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching cierres:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { cierres, loading, error };
}
