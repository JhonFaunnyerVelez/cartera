import { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { InversionConfig } from '../types';
import { INVERSIONES_DEFAULT } from '../constants/inversionesDefault';
import { migrarTodasLasInversiones } from '../services/migrarInversiones';

export function useInversiones() {
  const [inversiones, setInversiones] = useState<InversionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seedingRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      collection(db, 'inversiones'),
      async (snap) => {
        if (snap.empty) {
          if (!seedingRef.current) {
            seedingRef.current = true;
            try {
              for (const inv of INVERSIONES_DEFAULT) {
                await setDoc(doc(db, 'inversiones', inv.id), inv);
              }
              await migrarTodasLasInversiones(INVERSIONES_DEFAULT);
              // onSnapshot volverá a dispararse cuando existan documentos
              return;
            } catch (err) {
              console.error('Error seeding inversiones:', err);
              setError(err instanceof Error ? err.message : 'Error al inicializar inversiones');
            } finally {
              seedingRef.current = false;
            }
          }
          setInversiones([]);
          setLoading(false);
          return;
        }

        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as InversionConfig))
          .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
        setInversiones(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching inversiones:', err);
        setError(err.message);
        setLoading(false);
      }
    );
  }, []);

  const activas = useMemo(() => inversiones.filter(i => i.activo), [inversiones]);

  const guardarInversion = async (data: InversionConfig) => {
    await setDoc(doc(db, 'inversiones', data.id), data);
  };

  const eliminarInversion = async (id: string) => {
    await deleteDoc(doc(db, 'inversiones', id));
  };

  const getBySlug = (slug: string) => inversiones.find(i => i.slug === slug);

  return {
    inversiones,
    activas,
    loading,
    error,
    guardarInversion,
    eliminarInversion,
    getBySlug,
  };
}
