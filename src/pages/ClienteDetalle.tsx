import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, MapPin, Briefcase, Plus, Calendar, TrendingUp, Gift, XCircle, CheckCircle2, RefreshCw, Pencil, UserX, UserCheck, Power, PowerOff } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useClientes } from '../hooks/useClientes';
import { useAliados } from '../hooks/useAliados';
import { calcularParticipacion, resumenParticipacion } from '../utils/participacionAliado';
import { useCarteras, diasParaVencer } from '../hooks/useCarteras';
import { useCobros } from '../hooks/useCobros';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CarteraForm from '../components/carteras/CarteraForm';
import RegistroPagoModal from '../components/carteras/RegistroPagoModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useState, useMemo, useEffect } from 'react';
import type { Cartera, CobroMensual } from '../types';
import { esCarteraActiva, esClienteActivo } from '../utils/activo';
import {
  BadgePagoAnticipado,
  ValorConAdelanto,
  clasesFilaAdelanto,
  etiquetaMesRecibido,
} from '../components/carteras/AdelantoIndicators';
import {
  alinearCobroConCartera,
  esCobroVirtual,
  materializarCobroVirtual,
} from '../utils/cobrosVirtuales';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}
function formatDate(ts: any) {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
function diaPagoMensual(ts: any): string {
  if (!ts?.toDate) return '—';
  return `Día ${ts.toDate().getDate()}`;
}

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const { clientes, loading: loadingClientes, setClienteActivo } = useClientes();
  const { aliados } = useAliados();
  const { carteras, loading: loadingCarteras, setCarteraActiva } = useCarteras();
  const hoy = new Date();
  const { cobros, registrarPago, registrarCortesia, revertirPago } = useCobros(hoy.getMonth() + 1, hoy.getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCartera, setEditingCartera] = useState<Cartera | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<CobroMensual[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [pagoCobro, setPagoCobro] = useState<CobroMensual | null>(null);

  // Estado para el modal de confirmación bonito
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Cargar historial de pagos de este cliente
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'cobros_mensuales'),
      where('clienteId', '==', id),
      where('estado', '==', 'Pagado'),
      orderBy('fechaPago', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      setHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() } as CobroMensual)));
      setLoadingHistorial(false);
    }, () => setLoadingHistorial(false));
  }, [id]);

  const cliente = useMemo(() => clientes.find((c) => c.id === id), [clientes, id]);

  // Carteras de este cliente
  const carterasCliente = useMemo(
    () => carteras.filter((c) => c.clienteId === id),
    [carteras, id]
  );

  const openEditCartera = (c: Cartera) => { setEditingCartera(c); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditingCartera(null); };

  const handlePago = (cobro: CobroMensual, cartera: Cartera, isPagado: boolean) => {
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();
    const cobroAlineado = alinearCobroConCartera(cobro, cartera, mesActual, anioActual);

    if (isPagado) {
      setConfirmConfig({
        isOpen: true,
        title: '¿Revertir pago?',
        message: `¿Estás seguro de que quieres revertir el pago de ${cobroAlineado.carteraNombre}?`,
        type: 'danger',
        onConfirm: async () => {
          setLoadingId(cobro.id);
          try {
            await revertirPago(cobro);
          } finally { setLoadingId(null); }
        }
      });
      return;
    }
    setPagoCobro(cobroAlineado);
  };

  const confirmarPago = async (monto: number) => {
    if (!pagoCobro) return;
    setLoadingId(pagoCobro.id);
    try {
      let cobroPago = { ...pagoCobro, valorCobro: monto };
      if (esCobroVirtual(pagoCobro.id)) {
        const id = await materializarCobroVirtual(cobroPago);
        cobroPago = { ...cobroPago, id };
      }
      await registrarPago(cobroPago);
      setPagoCobro(null);
    } finally {
      setLoadingId(null);
    }
  };

  const handleCortesia = async (cobro: CobroMensual, cartera: Cartera) => {
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();
    const cobroAlineado = alinearCobroConCartera(cobro, cartera, mesActual, anioActual);

    setConfirmConfig({
      isOpen: true,
      title: 'Registrar Cortesía',
      message: `¿Quieres marcar el cobro de ${cobroAlineado.carteraNombre} como CORTESÍA ($0)?`,
      type: 'info',
      onConfirm: async () => {
        setLoadingId(cobro.id);
        try {
          let cobroPago = cobroAlineado;
          if (esCobroVirtual(cobro.id)) {
            const id = await materializarCobroVirtual(cobroAlineado);
            cobroPago = { ...cobroAlineado, id };
          }
          await registrarCortesia(cobroPago);
        } finally { setLoadingId(null); }
      }
    });
  };

  const handleToggleCliente = () => {
    const activo = esClienteActivo(cliente!);
    setConfirmConfig({
      isOpen: true,
      title: activo ? '¿Desactivar cliente?' : '¿Reactivar cliente?',
      message: activo
        ? `Se desactivará a "${cliente!.nombre}" y todas sus carteras. No aparecerán en cobros futuros, pero el historial de meses anteriores se conserva.`
        : `Se reactivará a "${cliente!.nombre}" y todas sus carteras. Se generará el cobro del mes actual si corresponde.`,
      type: activo ? 'danger' : 'success',
      onConfirm: async () => {
        await setClienteActivo(cliente!.id, !activo);
      },
    });
  };

  const handleToggleCartera = (cartera: Cartera) => {
    const activa = esCarteraActiva(cartera);
    setConfirmConfig({
      isOpen: true,
      title: activa ? '¿Desactivar cartera?' : '¿Reactivar cartera?',
      message: activa
        ? `"${cartera.nombre}" dejará de aparecer en cobros futuros. Los meses anteriores con deuda o pagos se conservan.`
        : `"${cartera.nombre}" volverá a generar cobros. Se creará el cobro del mes actual si no existe.`,
      type: activa ? 'danger' : 'success',
      onConfirm: async () => {
        await setCarteraActiva(cartera.id, !activa);
      },
    });
  };

  if (loadingClientes || loadingCarteras) return <LoadingSpinner />;

  if (!cliente) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-lg">Cliente no encontrado.</p>
        <Link to="/clientes" className="text-indigo-600 mt-4 inline-block hover:underline">← Volver a Clientes</Link>
      </div>
    );
  }

  const totalCartera = carterasCliente.filter(esCarteraActiva).reduce((sum, c) => sum + c.valorCartera, 0);
  const carterasActivasCount = carterasCliente.filter(esCarteraActiva).length;
  const clienteActivo = esClienteActivo(cliente);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/clientes" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium transition">
        <ArrowLeft size={16} /> Volver a Clientes
      </Link>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600" />
        <div className="px-6 pb-6">
          <div className="flex items-start justify-between gap-4 -mt-12 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center text-indigo-600 font-bold text-3xl flex-shrink-0">
              {cliente.nombre.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleToggleCliente}
              className={`mt-14 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm border ${
                clienteActivo
                  ? 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                  : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {clienteActivo ? <><UserX size={16} /> Desactivar cliente</> : <><UserCheck size={16} /> Reactivar cliente</>}
            </button>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            {cliente.nombre}
            {!clienteActivo && (
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">Inactivo</span>
            )}
          </h2>
          <div className="flex flex-wrap gap-4 mt-3">
            {cliente.empresa && (
              <span className="flex items-center gap-1.5 text-slate-500 text-sm">
                <Building2 size={14} className="text-slate-400" /> {cliente.empresa}
              </span>
            )}
            {cliente.aliadoId && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-1 rounded-lg">
                Aliado {aliados.find(a => a.id === cliente.aliadoId)?.codigo || '—'}
                {cliente.porcentajeParticipacion ? ` · ${cliente.porcentajeParticipacion}%` : ''}
              </span>
            )}
            {cliente.pais && (
              <span className="flex items-center gap-1.5 text-slate-500 text-sm">
                <Globe size={14} className="text-slate-400" /> {cliente.pais}
              </span>
            )}
            {cliente.ruta && (
              <span className="flex items-center gap-1.5 text-slate-500 text-sm">
                <MapPin size={14} className="text-slate-400" /> {cliente.ruta}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-slate-500 text-sm">
              <Calendar size={14} className="text-slate-400" />
              Cliente desde {formatDate(cliente.fechaCreacion)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Carteras activas', value: carterasActivasCount },
          { label: 'Valor mensual total', value: formatCOP(totalCartera) },
          { label: 'En mora', value: carterasCliente.filter(c => esCarteraActiva(c) && c.estado === 'Mora').length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-slate-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Carteras Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-500" />
            <h3 className="font-semibold text-slate-800">Carteras asignadas</h3>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{carterasCliente.length}</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!clienteActivo}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Asignar Cartera
          </button>
        </div>

        {carterasCliente.length === 0 ? (
          <div className="py-12 text-center">
            <Briefcase size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">Este cliente no tiene carteras asignadas.</p>
            <button onClick={() => setIsModalOpen(true)} className="mt-3 text-indigo-600 text-sm hover:underline font-medium">
              Asignar primera cartera →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="text-slate-500">Cartera</th>
                  <th className="text-slate-500">Valor mensual</th>
                  <th className="text-slate-500">Aliado</th>
                  <th className="text-slate-500">Participación</th>
                  <th className="text-slate-500">Recibo</th>
                  <th className="text-slate-500">Día de pago</th>
                  <th className="text-slate-500">Estado</th>
                  <th className="text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {carterasCliente.map((cartera) => {
                  const dias = diasParaVencer(cartera.fechaVencimientoMensual);
                  return (
                    <tr key={cartera.id} className={`hover:bg-slate-50 transition ${!esCarteraActiva(cartera) ? 'opacity-55' : ''}`}>
                      <td className="font-bold text-slate-800">
                        {cartera.nombre || 'Sin nombre'}
                        {!esCarteraActiva(cartera) && (
                          <span className="ml-1.5 text-[10px] font-bold text-slate-400 uppercase">Inactiva</span>
                        )}
                      </td>
                      <td className="font-semibold text-slate-700">{formatCOP(cartera.valorCartera)}</td>
                      <td>
                        {(() => {
                          const info = resumenParticipacion(cliente, aliados);
                          if (!info) return <span className="text-slate-300 text-xs">—</span>;
                          return (
                            <div className="leading-tight">
                              <p className="text-xs font-bold text-sky-800">{info.aliadoCodigo}</p>
                              <p className="text-[10px] text-sky-700">{info.aliadoNombre}</p>
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const info = resumenParticipacion(cliente, aliados);
                          if (!info) return <span className="text-slate-300 text-xs">—</span>;
                          const monto = calcularParticipacion(cartera.valorCartera, info.porcentaje);
                          return (
                            <div className="leading-tight">
                              <p className="text-xs font-bold text-sky-800 tabular-nums">{formatCOP(monto)}</p>
                              <p className="text-[10px] text-sky-600">{info.porcentaje}%</p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="font-bold text-emerald-700 text-xs tabular-nums">
                        {(() => {
                          const info = resumenParticipacion(cliente, aliados);
                          const participacion = info ? calcularParticipacion(cartera.valorCartera, info.porcentaje) : 0;
                          return formatCOP(cartera.valorCartera - participacion);
                        })()}
                      </td>
                      <td className="text-slate-600">{diaPagoMensual(cartera.fechaVencimientoMensual)}</td>
                      <td>
                        {(() => {
                          const cobroMes = cobros.find(c => c.carteraId === cartera.id);
                          if (cobroMes?.estado === 'Pagado') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Pagado
                              </span>
                            );
                          }

                          // Si no está pagado, mostramos los días o el badge original
                          if (dias >= 0 && dias <= 5) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> 
                                {dias === 0 ? 'Vence hoy' : `Faltan ${dias} días`}
                              </span>
                            );
                          }
                          if (dias < 0) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 
                                Venció hace {Math.abs(dias)} días
                              </span>
                            );
                          }
                          
                          // Si faltan más de 5 días y no está pagado, mostramos el badge Al día default
                          return <Badge estado={cartera.estado} />;
                        })()}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {(() => {
                            const cobro = cobros.find(c => c.carteraId === cartera.id);
                            const carteraActiva = esCarteraActiva(cartera);

                            return (
                              <>
                                {carteraActiva && cobro && (() => {
                                  const isPagado = cobro.estado === 'Pagado';
                                  const isLoading = loadingId === cobro.id;
                                  return (
                                    <>
                                      <button
                                        onClick={() => handlePago(cobro, cartera, isPagado)}
                                        disabled={isLoading}
                                        title={isPagado ? 'Revertir pago' : 'Registrar pago'}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
                                          ${isPagado 
                                            ? 'bg-rose-50 text-rose-500 hover:bg-rose-100 ring-1 ring-rose-200' 
                                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-1 ring-emerald-200'}`}
                                      >
                                        {isLoading ? <RefreshCw size={12} className="animate-spin" /> : isPagado ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                      </button>
                                      {!isPagado && (
                                        <button
                                          onClick={() => handleCortesia(cobro, cartera)}
                                          disabled={isLoading}
                                          title="Cortesia ($0)"
                                          className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 ring-1 ring-indigo-200 flex items-center justify-center transition-all"
                                        >
                                          <Gift size={14} />
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}

                          <button
                            onClick={() => openEditCartera(cartera)}
                            title="Editar configuración"
                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center transition-all"
                          >
                            <Pencil size={12} />
                          </button>

                          <button
                            onClick={() => handleToggleCartera(cartera)}
                            title={carteraActiva ? 'Desactivar cartera' : 'Reactivar cartera'}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ring-1 ${
                              carteraActiva
                                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 ring-amber-200'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-emerald-200'
                            }`}
                          >
                            {carteraActiva ? <PowerOff size={12} /> : <Power size={12} />}
                          </button>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCartera ? 'Editar Cartera' : 'Asignar Cartera'}
        size="lg"
      >
        <CarteraForm onClose={closeModal} clientes={clientes} initial={editingCartera} defaultClienteId={cliente.id} />
      </Modal>

      {/* Historial de Pagos Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <TrendingUp size={18} className="text-emerald-500" />
          <h3 className="font-semibold text-slate-800">Historial de pagos recibidos</h3>
        </div>

        {loadingHistorial ? (
          <div className="py-12 text-center text-slate-400 text-sm">Cargando pagos...</div>
        ) : historial.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm italic">
            No hay pagos registrados para este cliente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="text-slate-500">Fecha de Pago</th>
                  <th className="text-slate-500">Cartera</th>
                  <th className="text-slate-500">Periodo</th>
                  <th className="text-slate-500 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historial.map((pago) => (
                  <tr key={pago.id} className={`hover:bg-slate-50 transition ${clasesFilaAdelanto(pago)}`}>
                    <td className="text-slate-700">
                      <div className="font-medium">{pago.fechaPago ? formatDate(pago.fechaPago) : '—'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">#{pago.id.slice(-6)}</div>
                    </td>
                    <td className="text-slate-600 font-medium">
                      <div>{pago.carteraNombre}</div>
                      {pago.esPagoAdelantado && (
                        <span className="mt-0.5 inline-block">
                          <BadgePagoAnticipado mesRecibido={etiquetaMesRecibido(pago)} />
                        </span>
                      )}
                    </td>
                    <td className="text-slate-500">
                      {MESES[pago.mes - 1]} {pago.anio}
                    </td>
                    <td className="text-right">
                      <ValorConAdelanto
                        valorCobro={pago.valorCobro}
                        montoAdelantado={pago.montoAdelantado}
                        esCortesia={pago.esCortesia}
                        esPagoAnticipadoFlag={pago.esPagoAdelantado}
                        mesRecibido={etiquetaMesRecibido(pago)}
                        alineacion="der"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={!!pagoCobro} onClose={() => setPagoCobro(null)} title="Registrar pago" size="md">
        {pagoCobro && (
          <RegistroPagoModal
            cobro={pagoCobro}
            participacion={resumenParticipacion(clientes.find(c => c.id === pagoCobro.clienteId), aliados)}
            onClose={() => setPagoCobro(null)}
            onConfirm={confirmarPago}
          />
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />
    </div>
  );
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
