import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { MovimientoCosolar } from '../types';

export function useAllMovimientosCosolar() {
  const [movimientos, setMovimientos] = useState<MovimientoCosolar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      collection(db, 'movimientos_cosolar'),
      (snap) => {
        setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoCosolar)));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching all movimientos cosolar:', err);
        setError(err.message);
        setLoading(false);
      }
    );
  }, []);

  return { movimientos, loading, error };
}
