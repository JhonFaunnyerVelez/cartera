import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, FileText, Landmark, Paperclip, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import { useAliados } from '../hooks/useAliados';
import { useClientes } from '../hooks/useClientes';
import { useCarteras } from '../hooks/useCarteras';
import { useLiquidacionesAliado } from '../hooks/useLiquidacionesAliado';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { calcularParticipacion, etiquetaMes, mesDeFactura, sumarMes } from '../utils/participacionAliado';
import { esCarteraActiva } from '../utils/activo';
import { borrarComprobanteStorage, esImagenComprobante, subirComprobantesAliado } from '../services/comprobantesAliado';
import type { ComprobanteAliado, LiquidacionAliado } from '../types';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function resumenFactura(items: LiquidacionAliado[]) {
  const referidos = new Set(items.map(i => i.clienteId).filter(Boolean));
  const carteras = new Set(items.map(i => i.carteraId).filter(Boolean));
  const porPct = new Map<number, { porcentaje: number; carteras: number; base: number; participacion: number }>();

  for (const item of items) {
    const pct = item.porcentaje || 0;
    const prev = porPct.get(pct) ?? { porcentaje: pct, carteras: 0, base: 0, participacion: 0 };
    prev.carteras += 1;
    prev.base += item.montoRecibido || 0;
    prev.participacion += item.montoParticipacion || 0;
    porPct.set(pct, prev);
  }

  return {
    referidos: referidos.size,
    carteras: carteras.size || items.length,
    base: items.reduce((s, i) => s + (i.montoRecibido || 0), 0),
    total: items.reduce((s, i) => s + (i.montoParticipacion || 0), 0),
    pendientes: items.filter(i => i.estado !== 'Pagado').length,
    pagados: items.filter(i => i.estado === 'Pagado').length,
    porPct: [...porPct.values()].sort((a, b) => b.porcentaje - a.porcentaje),
  };
}

export default function AliadoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { aliados, loading } = useAliados();
  const { clientes } = useClientes();
  const { carteras } = useCarteras();
  const { liquidaciones, loading: loadingLiq, marcarPagadas, revertirPagadas, actualizarComprobantes } = useLiquidacionesAliado();
  const hoy = new Date();
  const [mesSel, setMesSel] = useState(hoy.getMonth() + 1);
  const [anioSel, setAnioSel] = useState(hoy.getFullYear());
  const [marcando, setMarcando] = useState(false);
  const [revirtiendo, setRevirtiendo] = useState(false);
  const [editandoComprobantes, setEditandoComprobantes] = useState(false);
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [modalComprobantesOpen, setModalComprobantesOpen] = useState(false);
  const [archivosPago, setArchivosPago] = useState<File[]>([]);
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [errorPago, setErrorPago] = useState('');
  const [errorComprobantes, setErrorComprobantes] = useState('');
  const [confirmRevertir, setConfirmRevertir] = useState(false);

  const aliado = aliados.find(a => a.id === id);
  const referidos = useMemo(
    () => clientes.filter(c => c.aliadoId === id),
    [clientes, id],
  );

  const filasReferidos = useMemo(() => {
    return referidos.map(cliente => {
      const propias = carteras.filter(c => c.clienteId === cliente.id && esCarteraActiva(c));
      const valor = propias.reduce((s, c) => s + c.valorCartera, 0);
      const pct = cliente.porcentajeParticipacion || 0;
      return {
        cliente,
        carteras: propias.length,
        valor,
        participacion: calcularParticipacion(valor, pct),
      };
    });
  }, [referidos, carteras]);

  const resumenCarteraActiva = useMemo(() => {
    const porPct = new Map<number, { porcentaje: number; referidos: number; carteras: number; valor: number; participacion: number }>();
    for (const fila of filasReferidos) {
      const pct = fila.cliente.porcentajeParticipacion || 0;
      const prev = porPct.get(pct) ?? { porcentaje: pct, referidos: 0, carteras: 0, valor: 0, participacion: 0 };
      prev.referidos += 1;
      prev.carteras += fila.carteras;
      prev.valor += fila.valor;
      prev.participacion += fila.participacion;
      porPct.set(pct, prev);
    }
    return {
      referidos: filasReferidos.length,
      carteras: filasReferidos.reduce((s, f) => s + f.carteras, 0),
      valor: filasReferidos.reduce((s, f) => s + f.valor, 0),
      participacion: filasReferidos.reduce((s, f) => s + f.participacion, 0),
      porPct: [...porPct.values()].sort((a, b) => b.porcentaje - a.porcentaje),
    };
  }, [filasReferidos]);

  const delAliado = useMemo(
    () => liquidaciones.filter(l => l.aliadoId === id),
    [liquidaciones, id],
  );
  const facturado = delAliado.filter(l => {
    const f = mesDeFactura(l);
    return f.mes === mesSel && f.anio === anioSel;
  });
  const aPagar = delAliado.filter(l => l.mesPago === mesSel && l.anioPago === anioSel);
  const pendientesPago = aPagar.filter(l => l.estado !== 'Pagado');
  const pagadosMes = aPagar.filter(l => l.estado === 'Pagado');
  const totalPorPagar = useMemo(
    () => pendientesPago.reduce((s, l) => s + l.montoParticipacion, 0),
    [pendientesPago],
  );
  const totalPagado = useMemo(
    () => pagadosMes.reduce((s, l) => s + l.montoParticipacion, 0),
    [pagadosMes],
  );
  const estadoMes: 'sin-movimiento' | 'por-pagar' | 'parcial' | 'pagado' =
    aPagar.length === 0
      ? 'sin-movimiento'
      : pendientesPago.length === 0
      ? 'pagado'
      : pagadosMes.length === 0
      ? 'por-pagar'
      : 'parcial';

  const reportePago = useMemo(() => resumenFactura(aPagar), [aPagar]);
  const reporteFacturado = useMemo(() => resumenFactura(facturado), [facturado]);
  const comprobantesFactura = useMemo(() => {
    const map = new Map<string, ComprobanteAliado>();
    for (const item of aPagar) {
      for (const c of item.comprobantes || []) {
        if (c?.url) map.set(c.path || c.url, c);
      }
    }
    return [...map.values()];
  }, [aPagar]);

  const irMes = (delta: number) => {
    const sig = sumarMes(mesSel, anioSel, delta);
    setMesSel(sig.mes);
    setAnioSel(sig.anio);
  };

  const abrirMarcarPago = () => {
    setArchivosPago([]);
    setErrorPago('');
    setModalPagoOpen(true);
  };

  const onElegirArchivos = (lista: FileList | null) => {
    if (!lista?.length) return;
    setErrorPago('');
    setArchivosPago(prev => {
      const existentes = new Set(prev.map(f => `${f.name}-${f.size}-${f.lastModified}`));
      const nuevos = [...lista].filter(f => !existentes.has(`${f.name}-${f.size}-${f.lastModified}`));
      return [...prev, ...nuevos].slice(0, 8);
    });
  };

  const confirmarMarcarPago = async () => {
    if (!aliado || pendientesPago.length === 0) return;
    setMarcando(true);
    setErrorPago('');
    try {
      let comprobantes: ComprobanteAliado[] = [];
      if (archivosPago.length > 0) {
        comprobantes = await subirComprobantesAliado(archivosPago, {
          aliadoId: aliado.id,
          mes: mesSel,
          anio: anioSel,
        });
      }
      await marcarPagadas(pendientesPago.map(l => l.id), comprobantes);
      setModalPagoOpen(false);
      setArchivosPago([]);
    } catch (err: unknown) {
      setErrorPago(err instanceof Error ? err.message : 'No se pudo guardar el pago.');
    } finally {
      setMarcando(false);
    }
  };

  const confirmarRevertir = async () => {
    if (pagadosMes.length === 0) return;
    setRevirtiendo(true);
    try {
      await revertirPagadas(pagadosMes.map(l => l.id));
      setConfirmRevertir(false);
    } finally {
      setRevirtiendo(false);
    }
  };

  const abrirGestionComprobantes = () => {
    setArchivosNuevos([]);
    setErrorComprobantes('');
    setModalComprobantesOpen(true);
  };

  const onElegirArchivosNuevos = (lista: FileList | null) => {
    if (!lista?.length) return;
    setErrorComprobantes('');
    setArchivosNuevos(prev => {
      const existentes = new Set(prev.map(f => `${f.name}-${f.size}-${f.lastModified}`));
      const nuevos = [...lista].filter(f => !existentes.has(`${f.name}-${f.size}-${f.lastModified}`));
      return [...prev, ...nuevos].slice(0, 8);
    });
  };

  const quitarComprobanteExistente = async (comprobante: ComprobanteAliado) => {
    if (pagadosMes.length === 0 || editandoComprobantes) return;
    setEditandoComprobantes(true);
    setErrorComprobantes('');
    try {
      const clave = comprobante.path || comprobante.url;
      const restantes = comprobantesFactura.filter(c => (c.path || c.url) !== clave);
      await actualizarComprobantes(pagadosMes.map(l => l.id), restantes);
      await borrarComprobanteStorage(comprobante.path);
    } catch (err: unknown) {
      setErrorComprobantes(err instanceof Error ? err.message : 'No se pudo quitar el comprobante.');
    } finally {
      setEditandoComprobantes(false);
    }
  };

  const agregarComprobantesAPagado = async () => {
    if (!aliado || pagadosMes.length === 0 || archivosNuevos.length === 0) return;
    setEditandoComprobantes(true);
    setErrorComprobantes('');
    try {
      const subidos = await subirComprobantesAliado(archivosNuevos, {
        aliadoId: aliado.id,
        mes: mesSel,
        anio: anioSel,
      });
      const merged = [...comprobantesFactura];
      for (const c of subidos) {
        if (!merged.some(x => (x.path || x.url) === (c.path || c.url))) merged.push(c);
      }
      await actualizarComprobantes(pagadosMes.map(l => l.id), merged);
      setArchivosNuevos([]);
      setModalComprobantesOpen(false);
    } catch (err: unknown) {
      setErrorComprobantes(err instanceof Error ? err.message : 'No se pudieron subir los comprobantes.');
    } finally {
      setEditandoComprobantes(false);
    }
  };

  if (loading || loadingLiq) return <LoadingSpinner />;
  if (!aliado) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">No se encontró el aliado.</p>
        <Link to="/aliados" className="text-indigo-600 text-sm mt-3 inline-block">Volver a aliados</Link>
      </div>
    );
  }

  const totalFacturado = reporteFacturado.total;
  const totalAPagar = reportePago.total;
  const mesPagoSiguiente = sumarMes(mesSel, anioSel, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <Link to="/aliados" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium">
          <ArrowLeft size={16} /> Aliados
        </Link>
        <button
          type="button"
          onClick={() => {
            const prev = document.title;
            document.title = `SALE · Liquidación ${MESES[mesSel - 1]} ${anioSel} · ${aliado.nombre}`;
            const restore = () => {
              document.title = prev;
              window.removeEventListener('afterprint', restore);
            };
            window.addEventListener('afterprint', restore);
            window.print();
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 self-start"
        >
          <Printer size={15} /> Imprimir reporte
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 inline-flex px-2 py-0.5 rounded-lg">{aliado.codigo}</p>
            <h1 className="text-xl font-bold text-slate-800 mt-2">{aliado.nombre}</h1>
            <p className="text-sm text-slate-500 mt-2 flex items-start gap-1.5">
              <Landmark size={15} className="mt-0.5 text-slate-400 shrink-0" />
              <span>{aliado.bancoNombre} · {aliado.tipoCuenta} · {aliado.numeroCuenta}<br />Titular: {aliado.titular}</span>
            </p>
          </div>
          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 self-start">
            <button type="button" onClick={() => irMes(-1)} className="w-8 h-8 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center" aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800 min-w-[9rem] text-center">{MESES[mesSel - 1]} {anioSel}</span>
            <button type="button" onClick={() => irMes(1)} className="w-8 h-8 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center" aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="mt-4">
          {estadoMes === 'pagado' && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-emerald-100 border border-emerald-200 px-3 py-1.5">
              <CheckCircle2 size={15} className="text-emerald-700" />
              <span className="text-sm font-bold text-emerald-800">Pagado</span>
              <span className="text-xs text-emerald-700">· {formatCOP(totalPagado)} transferido este mes</span>
            </div>
          )}
          {estadoMes === 'por-pagar' && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-amber-100 border border-amber-200 px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm font-bold text-amber-900">Por pagar</span>
              <span className="text-xs text-amber-800">· falta transferir {formatCOP(totalPorPagar)}</span>
            </div>
          )}
          {estadoMes === 'parcial' && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-sky-100 border border-sky-200 px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span className="text-sm font-bold text-sky-900">Parcial</span>
              <span className="text-xs text-sky-800">
                · pagado {formatCOP(totalPagado)} · por pagar {formatCOP(totalPorPagar)}
              </span>
            </div>
          )}
          {estadoMes === 'sin-movimiento' && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5">
              <span className="text-sm font-bold text-slate-600">Sin liquidaciones este mes</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-indigo-700">Facturado en {MESES[mesSel - 1]}</p>
            <p className="text-lg font-bold text-indigo-800 tabular-nums mt-1">{formatCOP(totalFacturado)}</p>
            <p className="text-[10px] text-slate-500 mt-1">Se paga del 1 al 5 de {etiquetaMes(mesPagoSiguiente.mes, mesPagoSiguiente.anio)}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-800">Por pagar</p>
            <p className="text-lg font-bold text-amber-900 tabular-nums mt-1">{formatCOP(totalPorPagar)}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              {pendientesPago.length} liquidación{pendientesPago.length !== 1 ? 'es' : ''} pendiente{pendientesPago.length !== 1 ? 's' : ''}
            </p>
            {pendientesPago.length > 0 && (
              <button type="button" onClick={abrirMarcarPago} disabled={marcando || revirtiendo} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-60">
                <CheckCircle2 size={13} /> Marcar pagado
              </button>
            )}
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Ya pagado</p>
            <p className="text-lg font-bold text-emerald-800 tabular-nums mt-1">{formatCOP(totalPagado)}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              {pagadosMes.length} liquidación{pagadosMes.length !== 1 ? 'es' : ''} · total mes {formatCOP(totalAPagar)}
            </p>
            {pagadosMes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={abrirGestionComprobantes}
                  disabled={marcando || revirtiendo || editandoComprobantes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-700 text-xs font-semibold hover:bg-indigo-50 disabled:opacity-60"
                >
                  <Paperclip size={13} /> Comprobantes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRevertir(true)}
                  disabled={marcando || revirtiendo || editandoComprobantes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60"
                >
                  <RotateCcw size={13} /> Revertir pago
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reporte mensual tipo factura — sin nombres de clientes */}
      <div className="print-factura bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-slate-300">
        <div className="bg-slate-800 text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xl font-extrabold tracking-[0.2em] uppercase">SALE</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mt-1">Reporte de pago · {aliado.codigo}</p>
            <h2 className="text-lg font-bold leading-tight mt-0.5">{aliado.nombre}</h2>
            <p className="text-sm text-slate-300 mt-0.5">Liquidación {MESES[mesSel - 1]} {anioSel}</p>
          </div>
          <div className="text-sm text-slate-300 text-right space-y-1">
            <p className="font-semibold text-white">SALE</p>
            <p>Transferir del 1 al 5</p>
            <p>{aliado.bancoNombre}</p>
            <p className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
              estadoMes === 'pagado'
                ? 'bg-emerald-500 text-white'
                : estadoMes === 'por-pagar'
                ? 'bg-amber-400 text-amber-950'
                : estadoMes === 'parcial'
                ? 'bg-sky-400 text-sky-950'
                : 'bg-slate-500 text-white'
            }`}>
              {estadoMes === 'pagado' ? 'PAGADO' : estadoMes === 'por-pagar' ? 'POR PAGAR' : estadoMes === 'parcial' ? 'PARCIAL' : 'SIN MOVIMIENTO'}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase text-slate-500">Referidos</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums mt-0.5">{reportePago.referidos || resumenCarteraActiva.referidos}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase text-slate-500">Carteras</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums mt-0.5">{reportePago.carteras || resumenCarteraActiva.carteras}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase text-slate-500">Base cobrada</p>
              <p className="text-base font-bold text-slate-800 tabular-nums mt-1">{formatCOP(reportePago.base)}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${
              estadoMes === 'pagado' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
            }`}>
              <p className={`text-[10px] font-bold uppercase ${
                estadoMes === 'pagado' ? 'text-emerald-700' : 'text-amber-800'
              }`}>
                {estadoMes === 'pagado' ? 'Total pagado' : 'Total liquidación'}
              </p>
              <p className={`text-base font-bold tabular-nums mt-1 ${
                estadoMes === 'pagado' ? 'text-emerald-800' : 'text-amber-900'
              }`}>
                {formatCOP(reportePago.total)}
              </p>
            </div>
          </div>

          {(totalPorPagar > 0 || totalPagado > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-amber-800">Por pagar</p>
                <p className="text-sm font-bold text-amber-900 tabular-nums mt-0.5">{formatCOP(totalPorPagar)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-emerald-700">Pagado</p>
                <p className="text-sm font-bold text-emerald-800 tabular-nums mt-0.5">{formatCOP(totalPagado)}</p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Resumen de cartera por %</p>
            {(reportePago.porPct.length > 0 ? reportePago.porPct : resumenCarteraActiva.porPct).length === 0 ? (
              <p className="text-sm text-slate-400 italic">Sin movimiento este mes.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-bold">%</th>
                      <th className="px-3 py-2 font-bold">Referidos / ítems</th>
                      <th className="px-3 py-2 font-bold">Carteras</th>
                      <th className="px-3 py-2 font-bold text-right">Base</th>
                      <th className="px-3 py-2 font-bold text-right">Participación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportePago.porPct.length > 0
                      ? reportePago.porPct.map(fila => (
                          <tr key={fila.porcentaje} className="border-t border-slate-100">
                            <td className="px-3 py-2.5 font-bold text-sky-700">{fila.porcentaje}%</td>
                            <td className="px-3 py-2.5 text-slate-600">{fila.carteras} cobro{fila.carteras !== 1 ? 's' : ''}</td>
                            <td className="px-3 py-2.5 text-slate-600">{fila.carteras}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatCOP(fila.base)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800">{formatCOP(fila.participacion)}</td>
                          </tr>
                        ))
                      : resumenCarteraActiva.porPct.map(fila => (
                          <tr key={fila.porcentaje} className="border-t border-slate-100">
                            <td className="px-3 py-2.5 font-bold text-sky-700">{fila.porcentaje}%</td>
                            <td className="px-3 py-2.5 text-slate-600">{fila.referidos} referido{fila.referidos !== 1 ? 's' : ''}</td>
                            <td className="px-3 py-2.5 text-slate-600">{fila.carteras}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatCOP(fila.valor)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800">{formatCOP(fila.participacion)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500 space-y-0.5">
              <p>Cuenta: {aliado.tipoCuenta} · {aliado.numeroCuenta}</p>
              <p>Titular: {aliado.titular}</p>
              <p>
                Estado:{' '}
                <span className={`font-bold ${
                  estadoMes === 'pagado' ? 'text-emerald-700' : estadoMes === 'por-pagar' ? 'text-amber-800' : 'text-sky-700'
                }`}>
                  {estadoMes === 'pagado' ? 'Pagado' : estadoMes === 'por-pagar' ? 'Por pagar' : estadoMes === 'parcial' ? 'Parcial' : 'Sin movimiento'}
                </span>
                {' · '}
                {reportePago.pendientes} por pagar
                {reportePago.pagados > 0 ? ` · ${reportePago.pagados} pagado${reportePago.pagados !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {estadoMes === 'pagado' ? 'Total pagado' : 'Pendiente por transferir'}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${
                estadoMes === 'pagado' ? 'text-emerald-700' : 'text-amber-800'
              }`}>
                {formatCOP(estadoMes === 'pagado' ? totalPagado : totalPorPagar || reportePago.total)}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Comprobantes de pago ({comprobantesFactura.length})
              </p>
              {pagadosMes.length > 0 && (
                <button
                  type="button"
                  onClick={abrirGestionComprobantes}
                  disabled={editandoComprobantes}
                  className="print:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-semibold hover:bg-indigo-100 disabled:opacity-60"
                >
                  <Paperclip size={12} /> Agregar / quitar
                </button>
              )}
            </div>
            {comprobantesFactura.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {pagadosMes.length > 0 ? 'Aún no hay comprobantes. Puedes adjuntarlos aunque ya esté pagado.' : 'Sin comprobantes.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {comprobantesFactura.map(c => (
                  <div key={c.path || c.url} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 relative">
                    {pagadosMes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => quitarComprobanteExistente(c)}
                        disabled={editandoComprobantes}
                        className="print:hidden absolute top-2 right-2 z-10 w-8 h-8 rounded-lg bg-white/95 border border-rose-200 text-rose-600 shadow-sm flex items-center justify-center hover:bg-rose-50 disabled:opacity-60"
                        title="Quitar comprobante"
                        aria-label="Quitar comprobante"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {esImagenComprobante(c) ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="block print:pointer-events-none">
                        <img
                          src={c.url}
                          alt={c.nombre}
                          className="w-full max-h-64 object-contain bg-white"
                        />
                      </a>
                    ) : (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-3 text-sm text-indigo-700 font-medium hover:bg-indigo-50 print:text-slate-800"
                      >
                        <FileText size={16} className="shrink-0" />
                        <span className="truncate">{c.nombre}</span>
                      </a>
                    )}
                    <p className="px-3 py-1.5 text-[10px] text-slate-500 truncate border-t border-slate-100">{c.nombre}</p>
                  </div>
                ))}
              </div>
            )}
            {errorComprobantes && !modalComprobantesOpen && (
              <p className="print:hidden mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{errorComprobantes}</p>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={modalPagoOpen}
        onClose={() => { if (!marcando) setModalPagoOpen(false); }}
        title="Marcar pago al aliado"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Vas a marcar como pagado {formatCOP(pendientesPago.reduce((s, l) => s + l.montoParticipacion, 0))} ({pendientesPago.length} liquidación{pendientesPago.length !== 1 ? 'es' : ''}).
            Adjunta el comprobante de transferencia.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Comprobantes</label>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition">
              <Paperclip size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Elegir imágenes o PDF</span>
              <span className="text-[11px] text-slate-400">Máx. 8 archivos · 8 MB c/u</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                multiple
                className="hidden"
                onChange={e => {
                  onElegirArchivos(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {archivosPago.length > 0 && (
            <ul className="space-y-2">
              {archivosPago.map((f, idx) => (
                <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {f.type.startsWith('image/') ? (
                    <Paperclip size={16} className="text-sky-500 shrink-0" />
                  ) : (
                    <FileText size={16} className="text-slate-400 shrink-0" />
                  )}
                  <span className="flex-1 truncate text-slate-700">{f.name}</span>
                  <span className="text-[10px] text-slate-400 tabular-nums">{(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setArchivosPago(prev => prev.filter((_, i) => i !== idx))}
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                    aria-label="Quitar archivo"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {errorPago && (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <X size={14} className="mt-0.5 shrink-0" /> {errorPago}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              disabled={marcando}
              onClick={() => setModalPagoOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={marcando}
              onClick={confirmarMarcarPago}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {marcando ? 'Guardando...' : 'Confirmar pagado'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="space-y-2 print:hidden">
        <h2 className="font-bold text-slate-800">Referidos</h2>
        {filasReferidos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Este aliado no tiene empresas asignadas.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="text-slate-500">Empresa</th>
                    <th className="text-slate-500">Cliente</th>
                    <th className="text-slate-500">%</th>
                    <th className="text-slate-500">Carteras</th>
                    <th className="text-slate-500">A cobrar</th>
                  </tr>
                </thead>
                <tbody>
                  {filasReferidos.map(fila => (
                    <tr key={fila.cliente.id} className="border-b border-slate-100">
                      <td className="font-semibold text-slate-800 text-sm">{fila.cliente.empresa || '—'}</td>
                      <td className="text-sm text-slate-600">{fila.cliente.nombre}</td>
                      <td className="text-sm font-semibold text-sky-700">{fila.cliente.porcentajeParticipacion || 0}%</td>
                      <td className="text-sm text-slate-600">{fila.carteras}</td>
                      <td className="text-sm font-bold text-sky-800 tabular-nums">{formatCOP(fila.participacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 print:hidden">
        <h2 className="font-bold text-slate-800">Facturado en {MESES[mesSel - 1]} {anioSel}</h2>
        {facturado.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No hay membresías facturadas este mes.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
            {facturado.map(item => (
              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.empresa || item.clienteNombre}</p>
                  <p className="text-[11px] text-slate-400">{item.carteraNombre} · {item.porcentaje}% de {formatCOP(item.montoRecibido)}</p>
                </div>
                <span className="font-bold text-indigo-700 tabular-nums">{formatCOP(item.montoParticipacion)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-800">Pago del 1 al 5 de {MESES[mesSel - 1]} {anioSel}</h2>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              Por pagar {formatCOP(totalPorPagar)}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Pagado {formatCOP(totalPagado)}
            </span>
          </div>
        </div>
        {aPagar.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Nada por transferir en estos primeros 5 días.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
            {aPagar.map(item => {
              const pagado = item.estado === 'Pagado';
              return (
                <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{item.empresa || item.clienteNombre}</p>
                    <p className="text-[11px] text-slate-400">
                      Facturado en {etiquetaMes(mesDeFactura(item).mes, mesDeFactura(item).anio)}
                      {item.comprobantes?.length ? ` · ${item.comprobantes.length} comprobante${item.comprobantes.length !== 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      pagado
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      {pagado ? 'Pagado' : 'Por pagar'}
                    </span>
                    <span className={`font-bold tabular-nums ${pagado ? 'text-emerald-700' : 'text-amber-800'}`}>
                      {formatCOP(item.montoParticipacion)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={modalComprobantesOpen}
        onClose={() => { if (!editandoComprobantes) setModalComprobantesOpen(false); }}
        title="Comprobantes del pago"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Puedes agregar o quitar comprobantes aunque el pago ya esté marcado como pagado.
            Se actualizan en todas las liquidaciones pagadas de este mes.
          </p>

          {comprobantesFactura.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Adjuntos actuales</p>
              <ul className="space-y-2">
                {comprobantesFactura.map(c => (
                  <li key={c.path || c.url} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    {esImagenComprobante(c) ? (
                      <img src={c.url} alt="" className="w-10 h-10 rounded object-cover shrink-0 bg-slate-100" />
                    ) : (
                      <FileText size={16} className="text-slate-400 shrink-0" />
                    )}
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-indigo-700 hover:underline">
                      {c.nombre}
                    </a>
                    <button
                      type="button"
                      disabled={editandoComprobantes}
                      onClick={() => quitarComprobanteExistente(c)}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center disabled:opacity-60"
                      aria-label="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Agregar más</label>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition">
              <Paperclip size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Elegir imágenes o PDF</span>
              <span className="text-[11px] text-slate-400">Máx. 8 archivos · 8 MB c/u</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                multiple
                className="hidden"
                onChange={e => {
                  onElegirArchivosNuevos(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {archivosNuevos.length > 0 && (
            <ul className="space-y-2">
              {archivosNuevos.map((f, idx) => (
                <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <Paperclip size={16} className="text-sky-500 shrink-0" />
                  <span className="flex-1 truncate text-slate-700">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setArchivosNuevos(prev => prev.filter((_, i) => i !== idx))}
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                    aria-label="Quitar archivo"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {errorComprobantes && (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{errorComprobantes}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              disabled={editandoComprobantes}
              onClick={() => setModalComprobantesOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={editandoComprobantes || archivosNuevos.length === 0}
              onClick={agregarComprobantesAPagado}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {editandoComprobantes ? 'Guardando...' : 'Subir y guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmRevertir}
        onClose={() => { if (!revirtiendo) setConfirmRevertir(false); }}
        onConfirm={confirmarRevertir}
        title="¿Revertir pago al aliado?"
        message={`Se volverán a marcar como por pagar ${pagadosMes.length} liquidación${pagadosMes.length !== 1 ? 'es' : ''} (${formatCOP(totalPagado)}). Los comprobantes adjuntos se quitan de este pago.`}
        type="danger"
        confirmText={revirtiendo ? 'Revirtiendo...' : 'Sí, revertir'}
      />
    </div>
  );
}
