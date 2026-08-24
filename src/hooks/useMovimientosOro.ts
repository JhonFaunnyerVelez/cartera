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
import type { MovimientoOro, TipoMovimientoOro } from '../types';

export function useMovimientosOro(mes: number, anio: number) {
  const [movimientos, setMovimientos] = useState<MovimientoOro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'movimientos_oro'),
      where('mes', '==', mes),
      where('anio', '==', anio)
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoOro));
      data.sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
      setMovimientos(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching movimientos oro:', err);
      setError(err.message);
      setLoading(false);
    });
  }, [mes, anio]);

  const addMovimiento = async (data: {
    tipo: TipoMovimientoOro;
    monto: number;
    descripcion: string;
    mes: number;
    anio: number;
    fecha: Timestamp;
    notas?: string;
  }) => {
    const { notas, ...rest } = data;
    await addDoc(collection(db, 'movimientos_oro'), {
      ...rest,
      ...(notas ? { notas } : {}),
      fechaCreacion: serverTimestamp(),
    });
  };

  const updateMovimiento = async (
    id: string,
    data: Partial<Omit<MovimientoOro, 'id' | 'fechaCreacion'>>,
    quitarNotas = false
  ) => {
    const { notas, ...rest } = data;
    await updateDoc(doc(db, 'movimientos_oro', id), {
      ...rest,
      ...(notas ? { notas } : quitarNotas ? { notas: deleteField() } : {}),
    });
  };

  const deleteMovimiento = async (id: string) => {
    await deleteDoc(doc(db, 'movimientos_oro', id));
  };

  return { movimientos, loading, error, addMovimiento, updateMovimiento, deleteMovimiento };
}
