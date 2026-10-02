import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Aliado } from '../types';

export type AliadoInput = Omit<Aliado, 'id' | 'fechaCreacion'>;

export function useAliados() {
  const [aliados, setAliados] = useState<Aliado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'aliados'), orderBy('fechaCreacion', 'desc'));
    return onSnapshot(q, (snap) => {
      setAliados(snap.docs.map(d => ({ id: d.id, ...d.data() } as Aliado)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching aliados:', err);
      setError(err.message);
      setLoading(false);
    });
  }, []);

  const addAliado = async (data: AliadoInput) => {
    await addDoc(collection(db, 'aliados'), {
      ...data,
      codigo: data.codigo.trim().toUpperCase(),
      activo: data.activo !== false,
      fechaCreacion: serverTimestamp(),
    });
  };

  const updateAliado = async (id: string, data: Partial<AliadoInput>) => {
    const payload = { ...data };
    if (payload.codigo) payload.codigo = payload.codigo.trim().toUpperCase();
    await updateDoc(doc(db, 'aliados', id), payload);
  };

  const deleteAliado = async (id: string) => {
    await deleteDoc(doc(db, 'aliados', id));
  };

  return { aliados, loading, error, addAliado, updateAliado, deleteAliado };
}
