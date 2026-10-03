import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Cartera, EstadoCartera } from '../types';
import { setCarteraActiva as setCarteraActivaService } from '../services/activacion';
import { sincronizarCobrosPendientesCartera } from '../utils/cobrosVirtuales';

export function calcularEstado(fechaVencimientoMensual: Timestamp): EstadoCartera {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = fechaVencimientoMensual.toDate();
  
  // Ajustar el mes y año al actual para calcular el estado del mes en curso
  vencimiento.setFullYear(hoy.getFullYear());
  vencimiento.setMonth(hoy.getMonth());
  vencimiento.setHours(0, 0, 0, 0);

  const diffMs = vencimiento.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diasRestantes < 0) return 'Mora';
  if (diasRestantes <= 5) return 'Próximo a vencer';
  return 'Al día';
}

export function diasParaVencer(fechaVencimientoMensual: Timestamp): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = fechaVencimientoMensual.toDate();
  
  // Ajustar el mes y año al actual para calcular los días restantes en el mes en curso
  vencimiento.setFullYear(hoy.getFullYear());
  vencimiento.setMonth(hoy.getMonth());
  vencimiento.setHours(0, 0, 0, 0);

  const diffMs = vencimiento.getTime() - hoy.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function useCarteras() {
  const [carteras, setCarteras] = useState<Cartera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'carteras'), orderBy('fechaCreacion', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Cartera));
        setCarteras(data);
        setLoading(false);

        const faltantes = snapshot.docs.filter(d => {
          const data = d.data();
          return data.fechaActivacion == null && data.activa !== false && data.fechaInactivacion == null;
        });
        faltantes.forEach(d => {
          const ref = d.ref;
          runTransaction(db, async (tx) => {
            const fresh = await tx.get(ref);
            const actual = fresh.data();
            if (!actual || actual.fechaActivacion != null) return;
            if (actual.activa === false || actual.fechaInactivacion != null) return;
            tx.update(ref, { fechaActivacion: actual.fechaCreacion || Timestamp.now() });
          }).catch(err => console.error('Error guardando fecha de activación:', err));
        });
      },
      (err) => {
        console.error('Error fetching carteras:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  /**
   * Crea la cartera. Los cobros del mes actual y futuros se proyectan en pantalla
   * desde la configuración de la cartera (sin documento en Firestore hasta registrar pago).
   */
  const addCartera = async (data: Omit<Cartera, 'id' | 'fechaCreacion' | 'estado'>) => {
    const estado = calcularEstado(data.fechaVencimientoMensual);

    await addDoc(collection(db, 'carteras'), {
      ...data,
      estado,
      activa: true,
      fechaCreacion: serverTimestamp(),
      fechaActivacion: serverTimestamp(),
    });
  };

  const updateCartera = async (id: string, data: Partial<Omit<Cartera, 'id'>>) => {
    const payload = { ...data };
    if (data.fechaVencimientoMensual) {
      payload.estado = calcularEstado(data.fechaVencimientoMensual);
    }
    await updateDoc(doc(db, 'carteras', id), payload);

    const syncCampos =
      data.nombre != null ||
      data.valorCartera != null ||
      data.fechaVencimientoMensual != null ||
      data.clienteNombre != null;

    if (syncCampos) {
      const carteraSnap = await getDoc(doc(db, 'carteras', id));
      if (carteraSnap.exists()) {
        const cartera = { id: carteraSnap.id, ...carteraSnap.data() } as Cartera;
        await sincronizarCobrosPendientesCartera(cartera);
      }
    }
  };

  const deleteCartera = async (id: string) => {
    await deleteDoc(doc(db, 'carteras', id));
  };

  const setCarteraActiva = async (id: string, activa: boolean) => {
    await setCarteraActivaService(id, activa);
  };

  return { carteras, loading, error, addCartera, updateCartera, deleteCartera, setCarteraActiva };
}
