import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { MovimientoOro } from '../types';

export function useAllMovimientosOro() {
  const [movimientos, setMovimientos] = useState<MovimientoOro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      collection(db, 'movimientos_oro'),
      (snap) => {
        setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoOro)));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching all movimientos oro:', err);
        setError(err.message);
        setLoading(false);
      }
    );
  }, []);

  return { movimientos, loading, error };
}
