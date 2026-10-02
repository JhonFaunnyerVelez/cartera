import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Cartera } from '../types';
import { esCarteraActiva } from '../utils/activo';
import { crearLiquidacionPorPago } from './participacionAliado';

function sumarMeses(mes: number, anio: number, n: number): { mes: number; anio: number } {
  let m = mes + n;
  let a = anio;
  while (m > 12) { m -= 12; a++; }
  return { mes: m, anio: a };
}

export interface PagoAdelantoResult {
  mesesPagados: number;
  totalPagado: number;
  periodos: string[];
}

/**
 * Calcula la fecha de vencimiento para el mes y año específicos,
 * manteniendo el día y hora de la fecha base.
 */
function calcularFechaVencimientoCobro(fechaBase: Timestamp | undefined, mes: number, anio: number): Timestamp | undefined {
  if (!fechaBase) return fechaBase;
  const dateBase = fechaBase.toDate();
  const nuevaFecha = new Date(anio, mes - 1, dateBase.getDate(), dateBase.getHours(), dateBase.getMinutes(), dateBase.getSeconds());
  return Timestamp.fromDate(nuevaFecha);
}

export async function registrarPagoAdelantado(
  cartera: Cartera,
  mesInicio: number,
  anioInicio: number,
  cantidadMeses: number,
  fechaPago: Date = new Date()
): Promise<PagoAdelantoResult> {
  if (!esCarteraActiva(cartera)) {
    throw new Error('No se puede adelantar pagos de una cartera inactiva.');
  }
  const batch = writeBatch(db);
  const periodos: string[] = [];
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // 1. Obtener/crear las referencias para los meses futuros y guardar sus IDs
  const futurosIds: string[] = [];
  const operacionesFuturas: any[] = [];

  for (let i = 1; i < cantidadMeses; i++) {
    const { mes, anio } = sumarMeses(mesInicio, anioInicio, i);
    const snap = await getDocs(query(
      collection(db, 'cobros_mensuales'),
      where('carteraId', '==', cartera.id),
      where('mes', '==', mes),
      where('anio', '==', anio)
    ));

    let ref;
    let existe = false;
    if (snap.empty) {
      ref = doc(collection(db, 'cobros_mensuales'));
    } else {
      ref = snap.docs[0].ref;
      existe = true;
    }

    futurosIds.push(ref.id);
    operacionesFuturas.push({ ref, existe, mes, anio });
  }

  // 2. Procesar el mes actual (i = 0)
  const snapActual = await getDocs(query(
    collection(db, 'cobros_mensuales'),
    where('carteraId', '==', cartera.id),
    where('mes', '==', mesInicio),
    where('anio', '==', anioInicio)
  ));

  const montoAdelantado = (cantidadMeses - 1) * cartera.valorCartera;

  const dataActualBase = {
    estado: 'Pagado',
    fechaPago: Timestamp.fromDate(fechaPago),
    montoAdelantado: montoAdelantado > 0 ? montoAdelantado : null,
    mesesAdelantados: cantidadMeses,
    cobrosAdelantadosIds: futurosIds,
  };

  let cobroIdActual = '';
  if (snapActual.empty) {
    const refActual = doc(collection(db, 'cobros_mensuales'));
    cobroIdActual = refActual.id;
    batch.set(refActual, {
      carteraId: cartera.id,
      carteraNombre: cartera.nombre || '',
      clienteId: cartera.clienteId,
      clienteNombre: cartera.clienteNombre || '',
      mes: mesInicio,
      anio: anioInicio,
      valorCobro: cartera.valorCartera,
      fechaVencimiento: calcularFechaVencimientoCobro(cartera.fechaVencimientoMensual, mesInicio, anioInicio),
      ...dataActualBase
    });
  } else {
    const refActual = snapActual.docs[0].ref;
    cobroIdActual = refActual.id;
    batch.update(refActual, dataActualBase);
  }
  periodos.push(`${MESES[mesInicio - 1]} ${anioInicio}`);

  // 3. Agregar operaciones futuras al batch
  for (const op of operacionesFuturas) {
    const dataFuturaBase = {
      estado: 'Pagado',
      fechaPago: Timestamp.fromDate(fechaPago),
      esPagoAdelantado: true,
      mesRecibido: mesInicio,
      anioRecibido: anioInicio,
    };

    if (op.existe) {
      batch.update(op.ref, dataFuturaBase);
    } else {
      batch.set(op.ref, {
        carteraId: cartera.id,
        carteraNombre: cartera.nombre || '',
        clienteId: cartera.clienteId,
        clienteNombre: cartera.clienteNombre || '',
        mes: op.mes,
        anio: op.anio,
        valorCobro: cartera.valorCartera,
        fechaVencimiento: calcularFechaVencimientoCobro(cartera.fechaVencimientoMensual, op.mes, op.anio),
        ...dataFuturaBase
      });
    }
    periodos.push(`${MESES[op.mes - 1]} ${op.anio}`);
  }

  await batch.commit();

  const mesesAliado = [
    { id: cobroIdActual, mes: mesInicio, anio: anioInicio },
    ...operacionesFuturas.map(op => ({ id: op.ref.id, mes: op.mes, anio: op.anio })),
  ];
  for (const periodo of mesesAliado) {
    if (!periodo.id) continue;
    await crearLiquidacionPorPago({
      id: periodo.id,
      carteraId: cartera.id,
      carteraNombre: cartera.nombre,
      clienteId: cartera.clienteId,
      clienteNombre: cartera.clienteNombre,
      mes: periodo.mes,
      anio: periodo.anio,
      valorCobro: cartera.valorCartera,
      estado: 'Pagado',
      fechaPago: Timestamp.fromDate(fechaPago),
    }, cartera.valorCartera, { facturarEnMesCobro: true });
  }

  return {
    mesesPagados: cantidadMeses,
    totalPagado: cartera.valorCartera * cantidadMeses,
    periodos,
  };
}
