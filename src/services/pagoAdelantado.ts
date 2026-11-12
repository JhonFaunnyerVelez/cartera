import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Cartera, CobroMensual } from '../types';
import { esCarteraActiva } from '../utils/activo';
import { anularLiquidacionesDeCobro, crearLiquidacionPorPago } from './participacionAliado';

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

const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/** Cuotas ya registradas en este cobro (1 si fue un pago simple). */
export function mesesRegistradosDelPago(cobro: Pick<CobroMensual, 'mesesAdelantados' | 'cobrosAdelantadosIds'>): number {
  if (cobro.mesesAdelantados && cobro.mesesAdelantados > 0) return cobro.mesesAdelantados;
  const extras = cobro.cobrosAdelantadosIds?.length ?? 0;
  return extras + 1;
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
    periodos.push(`${MESES_NOMBRE[mesInicio - 1]} ${anioInicio}`);

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
    periodos.push(`${MESES_NOMBRE[op.mes - 1]} ${op.anio}`);
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

/**
 * Cambia las cuotas de un pago ya registrado. El cobro original sigue pagado:
 * solo agrega o quita meses adelantados y ajusta las liquidaciones del aliado.
 */
export async function editarPago(
  cartera: Cartera,
  cobro: CobroMensual,
  cantidadMeses: number,
): Promise<PagoAdelantoResult> {
  if (cantidadMeses < 1 || cantidadMeses > 24) {
    throw new Error('El pago debe ser de 1 a 24 meses.');
  }
  if (cobro.esPagoAdelantado) {
    throw new Error('Edita el pago en el mes en que se recibió el dinero.');
  }
  if (cobro.esCortesia) {
    throw new Error('Una cortesía no se edita como pago. Revierte y registra de nuevo.');
  }
  if (cobro.estado !== 'Pagado') {
    throw new Error('Solo se puede editar un pago ya registrado.');
  }

  const mesInicio = cobro.mes;
  const anioInicio = cobro.anio;
  const fechaPago = cobro.fechaPago?.toDate?.() ?? new Date();
  const idsPrevios = cobro.cobrosAdelantadosIds || [];
  const periodosNuevos: { mes: number; anio: number }[] = [];
  for (let i = 1; i < cantidadMeses; i++) {
    periodosNuevos.push(sumarMeses(mesInicio, anioInicio, i));
  }

  const previosPorPeriodo = new Map<string, string>();
  const idsARevertir: string[] = [];
  for (const id of idsPrevios) {
    const snap = await getDoc(doc(db, 'cobros_mensuales', id));
    if (!snap.exists()) continue;
    const data = snap.data();
    const sigue = periodosNuevos.some(p => p.mes === data.mes && p.anio === data.anio);
    if (sigue) previosPorPeriodo.set(`${data.mes}-${data.anio}`, id);
    else idsARevertir.push(id);
  }

  const batch = writeBatch(db);
  const periodos: string[] = [`${MESES_NOMBRE[mesInicio - 1]} ${anioInicio}`];
  const futurosIds: string[] = [];
  const operacionesNuevas: { id: string; mes: number; anio: number }[] = [];

  for (const periodo of periodosNuevos) {
    const key = `${periodo.mes}-${periodo.anio}`;
    const idPrevio = previosPorPeriodo.get(key);
    if (idPrevio) {
      futurosIds.push(idPrevio);
      periodos.push(`${MESES_NOMBRE[periodo.mes - 1]} ${periodo.anio}`);
      continue;
    }

    const snap = await getDocs(query(
      collection(db, 'cobros_mensuales'),
      where('carteraId', '==', cartera.id),
      where('mes', '==', periodo.mes),
      where('anio', '==', periodo.anio),
    ));

    let ref;
    let existe = false;
    if (snap.empty) {
      ref = doc(collection(db, 'cobros_mensuales'));
    } else {
      ref = snap.docs[0].ref;
      existe = true;
      const data = snap.docs[0].data();
      if (data.estado === 'Pagado' && !idsPrevios.includes(ref.id)) {
        throw new Error(`${MESES_NOMBRE[periodo.mes - 1]} ${periodo.anio} ya tiene un pago propio. No se puede incluir en este adelanto.`);
      }
    }

    const dataFutura = {
      estado: 'Pagado',
      fechaPago: Timestamp.fromDate(fechaPago),
      esPagoAdelantado: true,
      mesRecibido: mesInicio,
      anioRecibido: anioInicio,
    };

    if (existe) {
      batch.update(ref, dataFutura);
    } else {
      batch.set(ref, {
        carteraId: cartera.id,
        carteraNombre: cartera.nombre || cobro.carteraNombre || '',
        clienteId: cartera.clienteId,
        clienteNombre: cartera.clienteNombre || cobro.clienteNombre || '',
        mes: periodo.mes,
        anio: periodo.anio,
        valorCobro: cartera.valorCartera,
        fechaVencimiento: calcularFechaVencimientoCobro(cartera.fechaVencimientoMensual, periodo.mes, periodo.anio),
        ...dataFutura,
      });
    }

    futurosIds.push(ref.id);
    operacionesNuevas.push({ id: ref.id, mes: periodo.mes, anio: periodo.anio });
    periodos.push(`${MESES_NOMBRE[periodo.mes - 1]} ${periodo.anio}`);
  }

  const montoAdelantado = (cantidadMeses - 1) * cartera.valorCartera;
  batch.update(doc(db, 'cobros_mensuales', cobro.id), {
    montoAdelantado: montoAdelantado > 0 ? montoAdelantado : null,
    mesesAdelantados: cantidadMeses,
    cobrosAdelantadosIds: futurosIds,
    esCortesia: false,
    esPagoAdelantado: false,
  });

  for (const idFuturo of idsARevertir) {
    batch.update(doc(db, 'cobros_mensuales', idFuturo), {
      estado: 'Pendiente',
      fechaPago: null,
      esPagoAdelantado: false,
      mesRecibido: null,
      anioRecibido: null,
    });
  }

  await batch.commit();

  for (const idFuturo of idsARevertir) {
    await anularLiquidacionesDeCobro(idFuturo);
  }
  for (const periodo of operacionesNuevas) {
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

/** Cuotas extras ya registradas en un abono adicional (mes que ya estaba pagado antes). */
export function mesesAbonoAdicional(
  cobro: Pick<CobroMensual, 'esPagoAdelantado' | 'mesesAdelantados' | 'cobrosAdelantadosIds' | 'montoAdelantado'>,
): number {
  if (!cobro.esPagoAdelantado) return 0;
  if (cobro.cobrosAdelantadosIds && cobro.cobrosAdelantadosIds.length > 0) {
    return cobro.cobrosAdelantadosIds.length;
  }
  if (cobro.mesesAdelantados && cobro.mesesAdelantados > 0) return cobro.mesesAdelantados;
  return 0;
}

/**
 * Primer mes después del ancla que se puede incluir en un abono adicional:
 * pendiente, inexistente, o ya pagado como adelanto de ESTE mismo mes (reparar vínculo).
 */
async function primerMesParaAbonoAdicional(
  carteraId: string,
  mes: number,
  anio: number,
  mesAncla: number,
  anioAncla: number,
): Promise<{ mes: number; anio: number }> {
  let cursor = sumarMeses(mes, anio, 1);
  for (let i = 0; i < 36; i++) {
    const snap = await getDocs(query(
      collection(db, 'cobros_mensuales'),
      where('carteraId', '==', carteraId),
      where('mes', '==', cursor.mes),
      where('anio', '==', cursor.anio),
    ));
    if (snap.empty) return cursor;
    const data = snap.docs[0].data();
    if (data.estado !== 'Pagado') return cursor;
    if (
      data.esPagoAdelantado === true &&
      data.mesRecibido === mesAncla &&
      data.anioRecibido === anioAncla
    ) {
      return cursor;
    }
    cursor = sumarMeses(cursor.mes, cursor.anio, 1);
  }
  throw new Error('No hay meses pendientes por adelantar en los próximos 3 años.');
}

/**
 * Abono nuevo en un mes que ya estaba pagado antes (esPagoAdelantado).
 * El dinero suma a la caja de ESTE mes; las cuotas futuras quedan marcadas como adelantadas.
 * cantidadMeses = cuotas adicionales a cubrir (no incluye el mes actual).
 */
export async function registrarAbonoAdicional(
  cartera: Cartera,
  cobro: CobroMensual,
  cantidadMeses: number,
  fechaPago: Date = new Date(),
): Promise<PagoAdelantoResult> {
  if (!esCarteraActiva(cartera)) {
    throw new Error('No se puede adelantar pagos de una cartera inactiva.');
  }
  if (!cobro.esPagoAdelantado || cobro.estado !== 'Pagado') {
    throw new Error('El abono adicional solo aplica a un mes ya pagado antes.');
  }
  if (cantidadMeses < 1 || cantidadMeses > 24) {
    throw new Error('El abono debe ser de 1 a 24 meses.');
  }

  const mesAncla = cobro.mes;
  const anioAncla = cobro.anio;
  const idsPrevios = cobro.cobrosAdelantadosIds || [];
  const inicio = await primerMesParaAbonoAdicional(
    cartera.id, mesAncla, anioAncla, mesAncla, anioAncla,
  );

  // Si ya hay abono adicional vinculado, reeditamos desde el primer mes de ese abono.
  let mesInicio = inicio.mes;
  let anioInicio = inicio.anio;
  if (idsPrevios.length > 0) {
    let minKey = '';
    let minMes = 0;
    let minAnio = 0;
    for (const id of idsPrevios) {
      const snap = await getDoc(doc(db, 'cobros_mensuales', id));
      if (!snap.exists()) continue;
      const data = snap.data();
      const key = `${data.anio}-${String(data.mes).padStart(2, '0')}`;
      if (!minKey || key < minKey) {
        minKey = key;
        minMes = data.mes;
        minAnio = data.anio;
      }
    }
    if (minKey) {
      mesInicio = minMes;
      anioInicio = minAnio;
    }
  }

  const periodosNuevos: { mes: number; anio: number }[] = [];
  for (let i = 0; i < cantidadMeses; i++) {
    periodosNuevos.push(sumarMeses(mesInicio, anioInicio, i));
  }

  const previosPorPeriodo = new Map<string, string>();
  const idsARevertir: string[] = [];
  for (const id of idsPrevios) {
    const snap = await getDoc(doc(db, 'cobros_mensuales', id));
    if (!snap.exists()) continue;
    const data = snap.data();
    const sigue = periodosNuevos.some(p => p.mes === data.mes && p.anio === data.anio);
    if (sigue) previosPorPeriodo.set(`${data.mes}-${data.anio}`, id);
    else idsARevertir.push(id);
  }

  const batch = writeBatch(db);
  const periodos: string[] = [];
  const futurosIds: string[] = [];
  const operacionesNuevas: { id: string; mes: number; anio: number }[] = [];

  for (const periodo of periodosNuevos) {
    const key = `${periodo.mes}-${periodo.anio}`;
    const idPrevio = previosPorPeriodo.get(key);
    if (idPrevio) {
      futurosIds.push(idPrevio);
      periodos.push(`${MESES_NOMBRE[periodo.mes - 1]} ${periodo.anio}`);
      continue;
    }

    const snap = await getDocs(query(
      collection(db, 'cobros_mensuales'),
      where('carteraId', '==', cartera.id),
      where('mes', '==', periodo.mes),
      where('anio', '==', periodo.anio),
    ));

    let ref;
    let existe = false;
    let adoptarHuérfano = false;
    if (snap.empty) {
      ref = doc(collection(db, 'cobros_mensuales'));
    } else {
      ref = snap.docs[0].ref;
      existe = true;
      const data = snap.docs[0].data();
      if (data.estado === 'Pagado' && !idsPrevios.includes(ref.id)) {
        // Ya marcado como adelanto de ESTE mes (abono previo sin vínculo) → se adopta.
        const mismoRecibo =
          data.esPagoAdelantado === true &&
          data.mesRecibido === mesAncla &&
          data.anioRecibido === anioAncla;
        if (!mismoRecibo) {
          throw new Error(`${MESES_NOMBRE[periodo.mes - 1]} ${periodo.anio} ya tiene un pago. No se puede incluir en este abono.`);
        }
        adoptarHuérfano = true;
      }
    }

    const dataFutura = {
      estado: 'Pagado',
      fechaPago: Timestamp.fromDate(fechaPago),
      esPagoAdelantado: true,
      mesRecibido: mesAncla,
      anioRecibido: anioAncla,
    };

    if (adoptarHuérfano) {
      futurosIds.push(ref.id);
      periodos.push(`${MESES_NOMBRE[periodo.mes - 1]} ${periodo.anio}`);
      continue;
    }

    if (existe) {
      batch.update(ref, dataFutura);
    } else {
      batch.set(ref, {
        carteraId: cartera.id,
        carteraNombre: cartera.nombre || cobro.carteraNombre || '',
        clienteId: cartera.clienteId,
        clienteNombre: cartera.clienteNombre || cobro.clienteNombre || '',
        mes: periodo.mes,
        anio: periodo.anio,
        valorCobro: cartera.valorCartera,
        fechaVencimiento: calcularFechaVencimientoCobro(cartera.fechaVencimientoMensual, periodo.mes, periodo.anio),
        ...dataFutura,
      });
    }

    futurosIds.push(ref.id);
    operacionesNuevas.push({ id: ref.id, mes: periodo.mes, anio: periodo.anio });
    periodos.push(`${MESES_NOMBRE[periodo.mes - 1]} ${periodo.anio}`);
  }

  const montoAdelantado = cantidadMeses * cartera.valorCartera;
  // fechaPago = cuándo entró este dinero a caja (el abono de hoy).
  // mesRecibido/anioRecibido de la cuota siguen igual (se pagó en otro mes).
  batch.update(doc(db, 'cobros_mensuales', cobro.id), {
    montoAdelantado,
    mesesAdelantados: cantidadMeses,
    cobrosAdelantadosIds: futurosIds,
    fechaPago: Timestamp.fromDate(fechaPago),
  });

  for (const idFuturo of idsARevertir) {
    batch.update(doc(db, 'cobros_mensuales', idFuturo), {
      estado: 'Pendiente',
      fechaPago: null,
      esPagoAdelantado: false,
      mesRecibido: null,
      anioRecibido: null,
    });
  }

  await batch.commit();

  for (const idFuturo of idsARevertir) {
    await anularLiquidacionesDeCobro(idFuturo);
  }
  for (const periodo of operacionesNuevas) {
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
    totalPagado: montoAdelantado,
    periodos,
  };
}

/**
 * Quita solo el abono adicional de un mes pagado antes.
 * El cobro del mes sigue Pagado / esPagoAdelantado (plata vieja intacta).
 */
export async function revertirAbonoAdicional(cobro: CobroMensual): Promise<void> {
  if (!cobro.esPagoAdelantado) {
    throw new Error('Este cobro no es un pago adelantado previo.');
  }
  if (!(cobro.montoAdelantado || cobro.cobrosAdelantadosIds?.length)) {
    throw new Error('No hay abono adicional que revertir en este mes.');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'cobros_mensuales', cobro.id), {
    montoAdelantado: null,
    mesesAdelantados: null,
    cobrosAdelantadosIds: null,
  });

  for (const idFuturo of cobro.cobrosAdelantadosIds || []) {
    batch.update(doc(db, 'cobros_mensuales', idFuturo), {
      estado: 'Pendiente',
      fechaPago: null,
      esPagoAdelantado: false,
      mesRecibido: null,
      anioRecibido: null,
    });
  }

  await batch.commit();

  for (const idFuturo of cobro.cobrosAdelantadosIds || []) {
    await anularLiquidacionesDeCobro(idFuturo);
  }
}
