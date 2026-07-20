import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Cliente } from '../types';
import { setClienteActivo as setClienteActivoService } from '../services/activacion';

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Suscripción en tiempo real a la colección 'clientes'
    const q = query(collection(db, 'clientes'), orderBy('fechaCreacion', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Cliente));
        setClientes(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching clientes:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const addCliente = async (data: Omit<Cliente, 'id' | 'fechaCreacion'>) => {
    await addDoc(collection(db, 'clientes'), {
      ...data,
      activo: true,
      fechaCreacion: serverTimestamp(),
    });
  };

  const updateCliente = async (id: string, data: Partial<Omit<Cliente, 'id'>>) => {
    await updateDoc(doc(db, 'clientes', id), data);
  };

  const deleteCliente = async (id: string) => {
    await deleteDoc(doc(db, 'clientes', id));
  };

  const setClienteActivo = async (id: string, activo: boolean) => {
    await setClienteActivoService(id, activo);
  };

  return { clientes, loading, error, addCliente, updateCliente, deleteCliente, setClienteActivo };
}
