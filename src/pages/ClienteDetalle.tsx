import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, MapPin, Briefcase, Plus, Calendar, TrendingUp, Gift, XCircle, CheckCircle2, RefreshCw, Pencil } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useClientes } from '../hooks/useClientes';
import { useCarteras, diasParaVencer } from '../hooks/useCarteras';
import { useCobros } from '../hooks/useCobros';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CarteraForm from '../components/carteras/CarteraForm';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useState, useMemo, useEffect } from 'react';
import type { Cartera, CobroMensual } from '../types';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}
function formatDate(ts: any) {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const { clientes, loading: loadingClientes } = useClientes();
  const { carteras, loading: loadingCarteras } = useCarteras();
  const hoy = new Date();
  const { cobros, registrarPago, registrarCortesia, revertirPago } = useCobros(hoy.getMonth() + 1, hoy.getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCartera, setEditingCartera] = useState<Cartera | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<CobroMensual[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(true);

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

  const handlePago = async (cobro: CobroMensual, isPagado: boolean) => {
    const actionStr = isPagado ? 'revertir' : 'registrar';
    
    setConfirmConfig({
      isOpen: true,
      title: isPagado ? '¿Revertir pago?' : '¿Registrar pago?',
      message: `¿Estás seguro de que quieres ${actionStr} el pago de ${cobro.carteraNombre}?`,
      type: isPagado ? 'danger' : 'success',
      onConfirm: async () => {
        setLoadingId(cobro.id);
        try {
          if (isPagado) await revertirPago(cobro);
          else await registrarPago(cobro.id);
        } finally { setLoadingId(null); }
      }
    });
  };

  const handleCortesia = async (cobro: CobroMensual) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Registrar Cortesía',
      message: `¿Quieres marcar el cobro de ${cobro.carteraNombre} como CORTESÍA ($0)?`,
      type: 'info',
      onConfirm: async () => {
        setLoadingId(cobro.id);
        try {
          await registrarCortesia(cobro.id);
        } finally { setLoadingId(null); }
      }
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

  const totalCartera = carterasCliente.reduce((sum, c) => sum + c.valorCartera, 0);

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
          <div className="-mt-12 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center text-indigo-600 font-bold text-3xl">
              {cliente.nombre.charAt(0).toUpperCase()}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{cliente.nombre}</h2>
          <div className="flex flex-wrap gap-4 mt-3">
            {cliente.empresa && (
              <span className="flex items-center gap-1.5 text-slate-500 text-sm">
                <Building2 size={14} className="text-slate-400" /> {cliente.empresa}
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
          { label: 'Carteras activas', value: carterasCliente.length },
          { label: 'Valor mensual total', value: formatCOP(totalCartera) },
          { label: 'En mora', value: carterasCliente.filter(c => c.estado === 'Mora').length },
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
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
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
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cartera</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor mensual</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Costo total</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vencimiento</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Renovación</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {carterasCliente.map((cartera) => {
                  const dias = diasParaVencer(cartera.fechaVencimientoMensual);
                  return (
                    <tr key={cartera.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                        {cartera.nombre || 'Sin nombre'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700 text-sm">{formatCOP(cartera.valorCartera)}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{formatCOP(cartera.costoTotal)}</td>
                      <td className="px-6 py-4">
                        <p className="text-slate-700 text-sm">{formatDate(cartera.fechaVencimientoMensual)}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{formatDate(cartera.fechaRenovacion)}</td>
                      <td className="px-6 py-4">
                        {(() => {
                          const cobroMes = cobros.find(c => c.carteraId === cartera.id);
                          if (cobroMes?.estado === 'Pagado') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Pagado
                              </span>
                            );
                          }

                          // Si no está pagado, mostramos los días o el badge original
                          if (dias >= 0 && dias <= 5) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> 
                                {dias === 0 ? 'Vence hoy' : `Faltan ${dias} días`}
                              </span>
                            );
                          }
                          if (dias < 0) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 
                                Venció hace {Math.abs(dias)} días
                              </span>
                            );
                          }
                          
                          // Si faltan más de 5 días y no está pagado, mostramos el badge Al día default
                          return <Badge estado={cartera.estado} />;
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const cobro = cobros.find(c => c.carteraId === cartera.id);
                            if (!cobro) return null;
                            const isPagado = cobro.estado === 'Pagado';
                            const isLoading = loadingId === cobro.id;

                            return (
                              <>
                                {/* Pago Normal */}
                                <button
                                  onClick={() => handlePago(cobro, isPagado)}
                                  disabled={isLoading}
                                  title={isPagado ? 'Revertir pago' : 'Registrar pago'}
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm
                                    ${isPagado 
                                      ? 'bg-rose-50 text-rose-500 hover:bg-rose-100 ring-1 ring-rose-200' 
                                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-1 ring-emerald-200'}`}
                                >
                                  {isLoading ? <RefreshCw size={14} className="animate-spin" /> : isPagado ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                </button>

                                {/* Cortesia */}
                                {!isPagado && (
                                  <button
                                    onClick={() => handleCortesia(cobro)}
                                    disabled={isLoading}
                                    title="Cortesia ($0)"
                                    className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 ring-1 ring-indigo-200 flex items-center justify-center transition-all shadow-sm"
                                  >
                                    <Gift size={16} />
                                  </button>
                                )}
                              </>
                            );
                          })()}

                          <button
                            onClick={() => openEditCartera(cartera)}
                            title="Editar configuración"
                            className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center transition-all shadow-sm"
                          >
                            <Pencil size={14} />
                          </button>
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
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha de Pago</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cartera</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Periodo</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historial.map((pago) => (
                  <tr key={pago.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="font-medium">{pago.fechaPago ? formatDate(pago.fechaPago) : '—'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">#{pago.id.slice(-6)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                      {pago.carteraNombre}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {MESES[pago.mes - 1]} {pago.anio}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-bold text-emerald-600">
                        {formatCOP(pago.valorCobro + (pago.montoAdelantado || 0))}
                      </div>
                      {(pago.montoAdelantado || 0) > 0 && (
                        <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 px-1 rounded">
                          Incluye adelanto
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
