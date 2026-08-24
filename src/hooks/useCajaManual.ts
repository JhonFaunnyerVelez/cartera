import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CajaManual } from '../types';
import { formatPeriodoId } from '../utils/periodo';
import type { CajaManualMap } from '../utils/resumenMensual';

export function useCajaManual() {
  const [registros, setRegistros] = useState<CajaManual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      collection(db, 'caja_manual'),
      (snap) => {
        setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() } as CajaManual)));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching caja manual:', err);
        setError(err.message);
        setLoading(false);
      }
    );
  }, []);

  const mapa = useMemo(() => {
    const m: CajaManualMap = {};
    for (const r of registros) m[r.id] = r.totalCaja;
    return m;
  }, [registros]);

  const guardarCaja = async (mes: number, anio: number, totalCaja: number, notas?: string) => {
    const id = formatPeriodoId(mes, anio);
    await setDoc(doc(db, 'caja_manual', id), {
      mes,
      anio,
      totalCaja,
      ...(notas?.trim() ? { notas: notas.trim() } : {}),
      fechaActualizacion: serverTimestamp(),
    });
  };

  const eliminarCaja = async (mes: number, anio: number) => {
    await deleteDoc(doc(db, 'caja_manual', formatPeriodoId(mes, anio)));
  };

  return { registros, mapa, loading, error, guardarCaja, eliminarCaja };
}
