import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Cartera, EstadoCartera } from '../types';
import { setCarteraActiva as setCarteraActivaService } from '../services/activacion';

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
   * Calcula la fecha de vencimiento para el mes y año específicos,
   * manteniendo el día y hora de la fecha base.
   */
  const calcularFechaVencimientoCobro = (fechaBase: Timestamp | undefined, mes: number, anio: number): Timestamp | undefined => {
    if (!fechaBase) return fechaBase;
    const dateBase = fechaBase.toDate();
    const nuevaFecha = new Date(anio, mes - 1, dateBase.getDate(), dateBase.getHours(), dateBase.getMinutes(), dateBase.getSeconds());
    return Timestamp.fromDate(nuevaFecha);
  };

  /**
   * Crea la cartera Y genera automáticamente su cobro para el mes actual.
   * Así aunque se registre a mitad de mes, ya aparece en la lista de cobros.
   */
  const addCartera = async (data: Omit<Cartera, 'id' | 'fechaCreacion' | 'estado'>) => {
    const estado = calcularEstado(data.fechaVencimientoMensual);
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1; // 1-12
    const anioActual = hoy.getFullYear();

    const batch = writeBatch(db);

    // 1. Crear la cartera
    const carteraRef = doc(collection(db, 'carteras'));
    batch.set(carteraRef, {
      ...data,
      estado,
      activa: true,
      fechaCreacion: serverTimestamp(),
    });

    // 2. Verificar si ya existe un cobro para esta cartera en el mes actual
    //    (no debería existir porque la cartera es nueva, pero lo chequeamos por seguridad)
    const existSnap = await getDocs(
      query(
        collection(db, 'cobros_mensuales'),
        where('carteraId', '==', carteraRef.id),
        where('mes', '==', mesActual),
        where('anio', '==', anioActual)
      )
    );

    if (existSnap.empty) {
      // 3. Generar el cobro del mes actual para esta nueva cartera
      const cobroRef = doc(collection(db, 'cobros_mensuales'));
      batch.set(cobroRef, {
        carteraId: carteraRef.id,
        carteraNombre: data.nombre || '',
        clienteId: data.clienteId,
        clienteNombre: data.clienteNombre || '',
        mes: mesActual,
        anio: anioActual,
        valorCobro: data.valorCartera,
        estado: 'Pendiente',
        fechaPago: null,
        fechaVencimiento: calcularFechaVencimientoCobro(data.fechaVencimientoMensual, mesActual, anioActual),
      });
    }

    await batch.commit();
  };

  const updateCartera = async (id: string, data: Partial<Omit<Cartera, 'id'>>) => {
    const payload = { ...data };
    if (data.fechaVencimientoMensual) {
      payload.estado = calcularEstado(data.fechaVencimientoMensual);
    }
    await updateDoc(doc(db, 'carteras', id), payload);

    // Si cambió el nombre, actualizar también en los cobros pendientes del mes actual
    if (data.nombre) {
      const hoy = new Date();
      const mesActual = hoy.getMonth() + 1;
      const anioActual = hoy.getFullYear();
      const cobrosSnap = await getDocs(
        query(
          collection(db, 'cobros_mensuales'),
          where('carteraId', '==', id),
          where('mes', '==', mesActual),
          where('anio', '==', anioActual)
        )
      );
      const b = writeBatch(db);
      cobrosSnap.docs.forEach((d) => {
        b.update(d.ref, { carteraNombre: data.nombre });
      });
      if (!cobrosSnap.empty) await b.commit();
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
