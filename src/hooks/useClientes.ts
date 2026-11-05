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
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Cliente } from '../types';
import { setClienteActivo as setClienteActivoService } from '../services/activacion';
import { periodoEsActualOFuturo } from '../utils/activo';

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

  /** Actualiza el cliente y propaga nombre a carteras/cobros abiertos del mes actual y futuros. */
  const updateCliente = async (id: string, data: Partial<Omit<Cliente, 'id'>>) => {
    await updateDoc(doc(db, 'clientes', id), data);

    if (data.nombre == null) return;

    const nombre = data.nombre;
    const carterasSnap = await getDocs(query(
      collection(db, 'carteras'),
      where('clienteId', '==', id),
    ));
    if (carterasSnap.empty) return;

    const batchCarteras = writeBatch(db);
    carterasSnap.docs.forEach(d => {
      batchCarteras.update(d.ref, { clienteNombre: nombre });
    });
    await batchCarteras.commit();

    const batchCobros = writeBatch(db);
    let cobrosCount = 0;
    for (const carteraDoc of carterasSnap.docs) {
      const cobrosSnap = await getDocs(query(
        collection(db, 'cobros_mensuales'),
        where('carteraId', '==', carteraDoc.id),
        where('estado', 'in', ['Pendiente', 'Mora']),
      ));
      for (const cobroDoc of cobrosSnap.docs) {
        const { mes, anio } = cobroDoc.data();
        if (!periodoEsActualOFuturo(mes, anio)) continue;
        batchCobros.update(cobroDoc.ref, {
          clienteNombre: nombre,
          carteraNombre: carteraDoc.data().nombre || '',
        });
        cobrosCount++;
      }
    }
    if (cobrosCount > 0) await batchCobros.commit();
  };

  const deleteCliente = async (id: string) => {
    await deleteDoc(doc(db, 'clientes', id));
  };

  const setClienteActivo = async (id: string, activo: boolean) => {
    await setClienteActivoService(id, activo);
  };

  return { clientes, loading, error, addCliente, updateCliente, deleteCliente, setClienteActivo };
}
