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
import type { MovimientoInversion, TipoMovimientoInversion } from '../types';

export function useMovimientosInversion(inversionId: string, mes: number, anio: number) {
  const [movimientos, setMovimientos] = useState<MovimientoInversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inversionId) {
      setMovimientos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'movimientos_inversion'),
      where('inversionId', '==', inversionId),
      where('mes', '==', mes),
      where('anio', '==', anio)
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoInversion));
      data.sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
      setMovimientos(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching movimientos inversion:', err);
      setError(err.message);
      setLoading(false);
    });
  }, [inversionId, mes, anio]);

  const addMovimiento = async (data: {
    tipo: TipoMovimientoInversion;
    monto: number;
    descripcion: string;
    mes: number;
    anio: number;
    fecha: Timestamp;
    notas?: string;
  }) => {
    const { notas, ...rest } = data;
    await addDoc(collection(db, 'movimientos_inversion'), {
      ...rest,
      inversionId,
      ...(notas ? { notas } : {}),
      fechaCreacion: serverTimestamp(),
    });
  };

  const updateMovimiento = async (
    id: string,
    data: Partial<Omit<MovimientoInversion, 'id' | 'fechaCreacion' | 'inversionId'>>,
    quitarNotas = false
  ) => {
    const { notas, ...rest } = data;
    await updateDoc(doc(db, 'movimientos_inversion', id), {
      ...rest,
      ...(notas ? { notas } : quitarNotas ? { notas: deleteField() } : {}),
    });
  };

  const deleteMovimiento = async (id: string) => {
    await deleteDoc(doc(db, 'movimientos_inversion', id));
  };

  return { movimientos, loading, error, addMovimiento, updateMovimiento, deleteMovimiento };
}

export function useAllMovimientosInversion(inversionId: string) {
  const [movimientos, setMovimientos] = useState<MovimientoInversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inversionId) {
      setMovimientos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'movimientos_inversion'),
      where('inversionId', '==', inversionId)
    );
    return onSnapshot(q, (snap) => {
      setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoInversion)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching all movimientos inversion:', err);
      setError(err.message);
      setLoading(false);
    });
  }, [inversionId]);

  return { movimientos, loading, error };
}

export function useAllMovimientosInversiones() {
  const [movimientos, setMovimientos] = useState<MovimientoInversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      collection(db, 'movimientos_inversion'),
      (snap) => {
        setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoInversion)));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching all movimientos inversiones:', err);
        setError(err.message);
        setLoading(false);
      }
    );
  }, []);

  return { movimientos, loading, error };
}
