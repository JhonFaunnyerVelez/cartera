import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  Timestamp,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CobroMensual } from '../types';

export function useCobros(mes: number, anio: number) {
  const [cobros, setCobros] = useState<CobroMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'cobros_mensuales'),
      where('mes', '==', mes),
      where('anio', '==', anio),
      orderBy('clienteNombre', 'asc')
    );
    return onSnapshot(q, (snap) => {
      setCobros(snap.docs.map(d => ({ id: d.id, ...d.data() } as CobroMensual)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching cobros:', err);
      setError(err.message);
      setLoading(false);
    });
  }, [mes, anio]);

  const registrarPago = async (cobroId: string) => {
    await updateDoc(doc(db, 'cobros_mensuales', cobroId), {
      estado: 'Pagado',
      fechaPago: Timestamp.now(),
    });
  };

  /**
   * Revierte el pago del mes actual. Si fue un pago adelantado de múltiples meses,
   * también revierte los cobros futuros asociados.
   */
  const revertirPago = async (cobro: CobroMensual) => {
    const batch = writeBatch(db);

    // 1. Revertir el cobro actual
    batch.update(doc(db, 'cobros_mensuales', cobro.id), {
      estado: 'Pendiente',
      fechaPago: null,
      montoAdelantado: null,
      mesesAdelantados: null,
      cobrosAdelantadosIds: null,
      esPagoAdelantado: false,
      esCortesia: false,
      mesRecibido: null,
      anioRecibido: null,
    });

    // 2. Si tenía cobros futuros asociados, revertirlos a pendiente
    if (cobro.cobrosAdelantadosIds && cobro.cobrosAdelantadosIds.length > 0) {
      for (const idFuturo of cobro.cobrosAdelantadosIds) {
        batch.update(doc(db, 'cobros_mensuales', idFuturo), {
          estado: 'Pendiente',
          fechaPago: null,
          esPagoAdelantado: false,
          mesRecibido: null,
          anioRecibido: null,
        });
      }
    }

    await batch.commit();
  };

  const registrarCortesia = async (cobroId: string) => {
    await updateDoc(doc(db, 'cobros_mensuales', cobroId), {
      estado: 'Pagado',
      fechaPago: Timestamp.now(),
      esCortesia: true,
    });
  };

  return { cobros, loading, error, registrarPago, registrarCortesia, revertirPago };
}
