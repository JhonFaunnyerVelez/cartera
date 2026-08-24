import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  doc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { MovimientoCosolar, TipoMovimientoCosolar } from '../types';

export function useMovimientosCosolar(mes: number, anio: number) {
  const [movimientos, setMovimientos] = useState<MovimientoCosolar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'movimientos_cosolar'),
      where('mes', '==', mes),
      where('anio', '==', anio)
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoCosolar));
      data.sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
      setMovimientos(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching movimientos cosolar:', err);
      setError(err.message);
      setLoading(false);
    });
  }, [mes, anio]);

  const addMovimiento = async (data: {
    tipo: TipoMovimientoCosolar;
    monto: number;
    descripcion: string;
    mes: number;
    anio: number;
    fecha: Timestamp;
    notas?: string;
  }) => {
    const { notas, ...rest } = data;
    await addDoc(collection(db, 'movimientos_cosolar'), {
      ...rest,
      ...(notas ? { notas } : {}),
      fechaCreacion: serverTimestamp(),
    });
  };

  const updateMovimiento = async (
    id: string,
    data: Partial<Omit<MovimientoCosolar, 'id' | 'fechaCreacion'>>,
    quitarNotas = false
  ) => {
    const { notas, ...rest } = data;
    await updateDoc(doc(db, 'movimientos_cosolar', id), {
      ...rest,
      ...(notas ? { notas } : quitarNotas ? { notas: deleteField() } : {}),
    });
  };

  const deleteMovimiento = async (id: string) => {
    await deleteDoc(doc(db, 'movimientos_cosolar', id));
  };

  return { movimientos, loading, error, addMovimiento, updateMovimiento, deleteMovimiento };
}
