import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Aliado, Cliente, CobroMensual } from '../types';
import { calcularParticipacion, periodoLiquidacionAliado } from '../utils/participacionAliado';

async function aliadoDeCliente(clienteId: string): Promise<{ cliente: Cliente; aliado: Aliado } | null> {
  const clienteSnap = await getDoc(doc(db, 'clientes', clienteId));
  if (!clienteSnap.exists()) return null;
  const cliente = { id: clienteSnap.id, ...clienteSnap.data() } as Cliente;
  const porcentaje = cliente.porcentajeParticipacion || 0;
  if (!cliente.aliadoId || porcentaje <= 0) return null;

  const aliadoSnap = await getDoc(doc(db, 'aliados', cliente.aliadoId));
  if (!aliadoSnap.exists()) return null;
  const aliado = { id: aliadoSnap.id, ...aliadoSnap.data() } as Aliado;
  if (aliado.activo === false) return null;
  return { cliente, aliado };
}

/** Borra liquidaciones aún no transferidas de un cobro (al revertir el pago). */
export async function anularLiquidacionesDeCobro(cobroId: string) {
  if (!cobroId) return;
  const snap = await getDocs(query(
    collection(db, 'liquidaciones_aliados'),
    where('cobroId', '==', cobroId),
  ));
  const pendientes = snap.docs.filter(d => d.data().estado !== 'Pagado');
  if (pendientes.length === 0) return;
  const batch = writeBatch(db);
  pendientes.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

/**
 * Al registrar un pago de cartera, aparta el % del aliado para transferirlo
 * a su banco entre el día 1 y el 5 del mes siguiente.
 */
export async function crearLiquidacionPorPago(
  cobro: Pick<CobroMensual, 'id' | 'clienteId' | 'carteraId' | 'mes' | 'anio'> & Partial<CobroMensual>,
  montoRecibido: number,
  opciones?: { facturarEnMesCobro?: boolean },
) {
  if (!cobro.clienteId || cobro.esCortesia || montoRecibido <= 0) return;
  const vinculo = await aliadoDeCliente(cobro.clienteId);
  if (!vinculo) return;

  const { cliente, aliado } = vinculo;
  const porcentaje = cliente.porcentajeParticipacion || 0;
  const montoParticipacion = calcularParticipacion(montoRecibido, porcentaje);
  if (montoParticipacion <= 0) return;

  const yaPagada = await getDocs(query(
    collection(db, 'liquidaciones_aliados'),
    where('cobroId', '==', cobro.id),
  ));
  if (yaPagada.docs.some(d => d.data().estado === 'Pagado')) return;
  await anularLiquidacionesDeCobro(cobro.id);

  const fechaFactura = opciones?.facturarEnMesCobro
    ? new Date(cobro.anio, cobro.mes - 1, 1)
    : new Date();
  const periodo = periodoLiquidacionAliado(fechaFactura);
  await addDoc(collection(db, 'liquidaciones_aliados'), {
    aliadoId: aliado.id,
    aliadoNombre: aliado.nombre,
    aliadoCodigo: aliado.codigo,
    bancoNombre: aliado.bancoNombre || '',
    tipoCuenta: aliado.tipoCuenta || 'Ahorros',
    numeroCuenta: aliado.numeroCuenta || '',
    titular: aliado.titular || '',
    clienteId: cliente.id,
    clienteNombre: cliente.nombre || cobro.clienteNombre || '',
    empresa: cliente.empresa || '',
    carteraId: cobro.carteraId,
    carteraNombre: cobro.carteraNombre || '',
    cobroId: cobro.id,
    mesCobro: cobro.mes,
    anioCobro: cobro.anio,
    mesFacturado: fechaFactura.getMonth() + 1,
    anioFacturado: fechaFactura.getFullYear(),
    montoRecibido,
    porcentaje,
    montoParticipacion,
    mesPago: periodo.mes,
    anioPago: periodo.anio,
    fechaLimite: Timestamp.fromDate(periodo.fechaLimite),
    estado: 'Pendiente',
    fechaCreacion: serverTimestamp(),
    fechaPago: null,
  });
}
