import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CobroMensual } from '../types';

/** Todos los cobros de la base (para resúmenes y reportes). */
export function useAllCobros() {
  const [cobros, setCobros] = useState<CobroMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      collection(db, 'cobros_mensuales'),
      (snap) => {
        setCobros(snap.docs.map(d => ({ id: d.id, ...d.data() } as CobroMensual)));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching all cobros:', err);
        setError(err.message);
        setLoading(false);
      }
    );
  }, []);

  return { cobros, loading, error };
}
