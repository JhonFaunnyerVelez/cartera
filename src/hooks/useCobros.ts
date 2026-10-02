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
import { anularLiquidacionesDeCobro, crearLiquidacionPorPago } from '../services/participacionAliado';

/**
 * Ajusta dinámicamente la fecha de vencimiento para cobros antiguos que hayan sido
 * guardados con la fecha base de la cartera (mes/año incorrectos para este cobro).
 */
function aplicarCorreccionFecha(data: any): CobroMensual {
  const cobro = data as CobroMensual;
  if (cobro.fechaVencimiento?.toDate) {
    const base = cobro.fechaVencimiento.toDate();
    // Si el mes o año de la fecha de vencimiento guardada no coinciden con los del cobro, los ajustamos en memoria
    if (base.getMonth() !== cobro.mes - 1 || base.getFullYear() !== cobro.anio) {
      const realDate = new Date(cobro.anio, cobro.mes - 1, base.getDate(), base.getHours(), base.getMinutes(), base.getSeconds());
      cobro.fechaVencimiento = Timestamp.fromDate(realDate);
    }
  }
  return cobro;
}

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
      setCobros(snap.docs.map(d => {
        const data = d.data();
        const cobroCorregido = aplicarCorreccionFecha(data);
        return { ...cobroCorregido, id: d.id };
      }));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching cobros:', err);
      setError(err.message);
      setLoading(false);
    });
  }, [mes, anio]);

  const registrarPago = async (cobro: CobroMensual) => {
    await updateDoc(doc(db, 'cobros_mensuales', cobro.id), {
      estado: 'Pagado',
      fechaPago: Timestamp.now(),
      valorCobro: cobro.valorCobro,
      carteraNombre: cobro.carteraNombre ?? '',
      clienteNombre: cobro.clienteNombre ?? '',
      ...(cobro.fechaVencimiento ? { fechaVencimiento: cobro.fechaVencimiento } : {}),
      esCortesia: false,
    });
    await crearLiquidacionPorPago(cobro, cobro.valorCobro);
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
    await anularLiquidacionesDeCobro(cobro.id);
    for (const idFuturo of cobro.cobrosAdelantadosIds || []) {
      await anularLiquidacionesDeCobro(idFuturo);
    }
  };

  const registrarCortesia = async (cobro: CobroMensual) => {
    await updateDoc(doc(db, 'cobros_mensuales', cobro.id), {
      estado: 'Pagado',
      fechaPago: Timestamp.now(),
      valorCobro: cobro.valorCobro,
      carteraNombre: cobro.carteraNombre ?? '',
      clienteNombre: cobro.clienteNombre ?? '',
      ...(cobro.fechaVencimiento ? { fechaVencimiento: cobro.fechaVencimiento } : {}),
      esCortesia: true,
    });
  };

  return { cobros, loading, error, registrarPago, registrarCortesia, revertirPago };
}
