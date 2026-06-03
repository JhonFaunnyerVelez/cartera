import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle, Search, CheckCircle2, XCircle, Pencil,
  Trash2, RefreshCw, AlertCircle, DollarSign, Clock,
  ChevronUp, ChevronDown, Briefcase, CalendarDays, Gift,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useCobros } from '../hooks/useCobros';
import { useCarteras } from '../hooks/useCarteras';
import { useClientes } from '../hooks/useClientes';
import { useCierres } from '../hooks/useCierres';
import { generarCobrosParaMes } from '../services/cierreMensual';
import type { CobroMensual, Cartera, Cliente } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CarteraForm from '../components/carteras/CarteraForm';
import PagoAdelantoModal from '../components/carteras/PagoAdelantoModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}
function formatDate(ts: any) {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}
function formatDateFull(ts: any) {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Etiqueta urgencia ────────────────────────────────────────────────────────
function DiasLabel({ ts, pagado }: { ts: any; pagado: boolean }) {
  if (pagado || !ts?.toDate) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const venc = ts.toDate(); venc.setHours(0, 0, 0, 0);
  const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0)  return <span className="text-xs font-semibold text-rose-600">Hace {Math.abs(dias)} días</span>;
  if (dias === 0) return <span className="text-xs font-bold text-rose-600 animate-pulse">¡Vence hoy!</span>;
  if (dias <= 5)  return <span className="text-xs font-semibold text-amber-600">En {dias} día{dias !== 1 ? 's' : ''}</span>;
  return <span className="text-xs text-slate-400">En {dias} días</span>;
}

// ─── Fila de cobro ────────────────────────────────────────────────────────────
function CobroRow({
  cobro, cartera, clienteInfo, onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, loadingId,
}: {
  cobro: CobroMensual;
  cartera?: Cartera;
  clienteInfo?: Cliente;
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  loadingId: string | null;
}) {
  const isPagado  = cobro.estado === 'Pagado';
  const isMora    = cobro.estado === 'Mora';
  const isLoading = loadingId === cobro.id;

  return (
    <tr className={`transition group border-b border-slate-100
      ${isPagado
        ? 'bg-emerald-50/40'
        : isMora
        ? 'bg-rose-50/50 border-l-4 border-l-rose-400'
        : 'hover:bg-indigo-50/40'}`}>

      {/* Día del mes */}
      <td className="px-4 py-3.5 w-14 text-center">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto font-bold text-sm
          ${isMora ? 'bg-rose-100 text-rose-700' : isPagado ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
          {cobro.fechaVencimiento?.toDate?.()?.getDate() ?? '—'}
        </div>
      </td>

      {/* CARTERA arriba (bold) · Cliente + Empresa abajo (pequeño) */}
      <td className="px-4 py-3.5 min-w-[180px]">
        <p className={`font-bold text-sm leading-tight ${isPagado ? 'text-slate-500' : 'text-slate-800'}`}>
          {cobro.carteraNombre || 'Sin nombre'}
        </p>
        <Link
          to={`/clientes/${cobro.clienteId}`}
          className="inline-flex items-center gap-1 mt-0.5 text-xs text-slate-500 hover:text-indigo-600 transition"
        >
          {cobro.clienteNombre || '—'}
          {clienteInfo?.empresa && (
            <span className="text-slate-400">· {clienteInfo.empresa}</span>
          )}
        </Link>
        <div className="mt-0.5 flex items-center gap-2">
          <DiasLabel ts={cobro.fechaVencimiento} pagado={isPagado} />
          {cobro.esPagoAdelantado && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
              ⏩ Adelantado
            </span>
          )}
        </div>
      </td>

      {/* Valor */}
      <td className="px-4 py-3.5">
        <div className="flex flex-col justify-center">
          <span className={`font-bold text-sm ${
            cobro.esCortesia 
              ? 'text-slate-400 line-through' 
              : isPagado ? 'text-emerald-600' : isMora ? 'text-rose-600' : 'text-slate-800'
          }`}>
            {formatCOP(cobro.valorCobro)}
          </span>
          {cobro.esCortesia && (
            <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-tighter">Cortesía</span>
          )}
          {cobro.montoAdelantado && cobro.montoAdelantado > 0 && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded mt-0.5 w-fit">
              + {formatCOP(cobro.montoAdelantado)} extra
            </span>
          )}
        </div>
      </td>

      {/* Fecha vencimiento */}
      <td className="px-4 py-3.5 text-slate-500 text-sm">{formatDate(cobro.fechaVencimiento)}</td>

      {/* Fecha de pago */}
      <td className="px-4 py-3.5 text-slate-400 text-xs">
        {isPagado ? formatDateFull(cobro.fechaPago) : '—'}
      </td>

      {/* Estado */}
      <td className="px-4 py-3.5">
        {isPagado ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Pagado
          </span>
        ) : isMora ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> En mora
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pendiente
          </span>
        )}
      </td>

      {/* Acciones — siempre visibles y mejor organizadas */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          {/* Botón Pago Normal */}
          <button
            onClick={() => onPago(cobro, isPagado)}
            disabled={isLoading}
            title={isPagado ? 'Revertir pago' : 'Registrar pago'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm
              ${isPagado 
                ? 'bg-rose-50 text-rose-500 hover:bg-rose-100 ring-1 ring-rose-200' 
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-1 ring-emerald-200'}`}
          >
            {isLoading ? <RefreshCw size={14} className="animate-spin" /> : isPagado ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          </button>

          {/* Botón Cortesia (solo si está pendiente) */}
          {!isPagado && (
            <button
              onClick={() => onCortesia(cobro)}
              disabled={isLoading}
              title="Registrar como Cortesía ($0)"
              className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all shadow-sm ring-1 ring-indigo-200 flex items-center justify-center"
            >
              <Gift size={16} />
            </button>
          )}

          {/* Botón Pago Adelantado (solo si está pendiente) */}
          {!isPagado && cartera && (
            <button 
              onClick={() => onPagoAdelanto(cartera)} 
              disabled={isLoading}
              title="Adelantar pagos"
              className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all shadow-sm ring-1 ring-purple-200 flex items-center justify-center"
            >
              <CalendarDays size={16} />
            </button>
          )}

          {/* Botón Editar Cartera */}
          {cartera && (
            <button 
              onClick={() => onEdit(cartera)} 
              title="Editar configuración"
              className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all shadow-sm ring-1 ring-slate-200 flex items-center justify-center"
            >
              <Pencil size={14} />
            </button>
          )}

          {/* Botón Eliminar Cartera */}
          {cartera && (
            <button 
              onClick={() => onDelete(cartera.id)} 
              title="Eliminar cartera"
              className="w-9 h-9 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-all shadow-sm ring-1 ring-rose-100 flex items-center justify-center"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Cabecera de sección colapsable ──────────────────────────────────────────
function SectionHeader({ label, count, total, color, collapsed, onToggle }: {
  label: string; count: number; total: string;
  color: 'rose' | 'emerald';
  collapsed: boolean; onToggle: () => void;
}) {
  const cls = {
    rose:    'bg-rose-50 border-rose-200 text-rose-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  }[color];
  return (
    <button onClick={onToggle}
      className={`w-full flex items-center justify-between px-5 py-3 border rounded-xl text-left transition hover:opacity-90 ${cls}`}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{label}</span>
        <span className="text-xs font-bold bg-white/60 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold text-sm">{total}</span>
        {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </div>
    </button>
  );
}

// ─── Tabla de cobros ─────────────────────────────────────────────────────────
function CobroTable({ cobros, carteras, clientes, onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, loadingId }: {
  cobros: CobroMensual[];
  carteras: Cartera[];
  clientes: Cliente[];
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  loadingId: string | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-indigo-600 text-left">
              <th className="px-4 py-3.5 text-xs font-semibold text-white uppercase tracking-wider w-14 text-center">Día</th>
              <th className="px-4 py-3.5 text-xs font-semibold text-white uppercase tracking-wider">Cartera / Cliente</th>
              <th className="px-4 py-3.5 text-xs font-semibold text-white uppercase tracking-wider">Valor</th>
              <th className="px-4 py-3.5 text-xs font-semibold text-white uppercase tracking-wider">Vencimiento</th>
              <th className="px-4 py-3.5 text-xs font-semibold text-white uppercase tracking-wider">Pagado el</th>
              <th className="px-4 py-3.5 text-xs font-semibold text-white uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3.5 text-xs font-semibold text-white uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cobros.map((cobro) => (
              <CobroRow
                key={cobro.id}
                cobro={cobro}
                cartera={carteras.find(c => c.id === cobro.carteraId)}
                clienteInfo={clientes.find(c => c.id === cobro.clienteId)}
                onPago={onPago}
                onCortesia={onCortesia}
                onEdit={onEdit}
                onDelete={onDelete}
                onPagoAdelanto={onPagoAdelanto}
                loadingId={loadingId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Carteras() {
  const hoy = new Date();
  const mesActual  = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  // ── Navegación de meses ("pasar hojas") ─────────────────────────────────────
  const [mesSel, setMesSel]   = useState(mesActual);
  const [anioSel, setAnioSel] = useState(anioActual);

  const esMesActual = mesSel === mesActual && anioSel === anioActual;
  const esMesFuturo = anioSel > anioActual || (anioSel === anioActual && mesSel > mesActual);

  const irMesAnterior = () => {
    if (mesSel === 1) { setMesSel(12); setAnioSel(a => a - 1); }
    else { setMesSel(m => m - 1); }
  };
  const irMesSiguiente = () => {
    if (mesSel === 12) { setMesSel(1); setAnioSel(a => a + 1); }
    else { setMesSel(m => m + 1); }
  };
  const irHoy = () => { setMesSel(mesActual); setAnioSel(anioActual); };

  const { cobros, loading: lCobros, registrarPago, registrarCortesia, revertirPago } = useCobros(mesSel, anioSel);
  const { carteras, loading: lCarteras, deleteCartera } = useCarteras();
  const { clientes, loading: lClientes } = useClientes();
  const { cierres, loading: lCierres } = useCierres();

  // ¿El mes seleccionado ya tiene un cierre ejecutado? → es de solo lectura
  const mesCerrado = cierres.some(c => c.mes === mesSel && c.anio === anioSel);
  // Se puede generar si el mes NO está cerrado (sin importar si es pasado, actual o futuro)
  const puedeGenerar = !mesCerrado;

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCartera, setEditCartera] = useState<Cartera | null>(null);
  const [adelantoCartera, setAdelantoCartera] = useState<Cartera | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [colPend, setColPend] = useState(false);
  const [colPag, setColPag] = useState(false);

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

  // Ordenar por fecha de vencimiento ASCENDENTE (más urgente primero)
  const cobrosOrdenados = useMemo(() => {
    return [...cobros]
      .filter(c => {
        if (!search.trim()) return true;
        return [c.clienteNombre, c.carteraNombre].join(' ').toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const da = a.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
        const db = b.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
        return da - db;
      });
  }, [cobros, search]);

  const pendientes = useMemo(() => cobrosOrdenados.filter(c => c.estado !== 'Pagado'), [cobrosOrdenados]);
  const pagados    = useMemo(() => cobrosOrdenados.filter(c => c.estado === 'Pagado'), [cobrosOrdenados]);

  const totalPend = useMemo(() => pendientes.reduce((s, c) => s + c.valorCobro, 0), [pendientes]);
  const totalPag  = useMemo(() => 
    pagados
      .filter(c => !c.esPagoAdelantado && !c.esCortesia) // Si es un adelanto de un mes anterior o una cortesía, no suma a la caja de hoy
      .reduce((s, c) => s + c.valorCobro, 0), 
    [pagados]
  );
  const totalAdelantadoRecibido = useMemo(() => pagados.reduce((s, c) => s + (c.montoAdelantado || 0), 0), [pagados]);
  
  // Total de caja = lo cobrado de este mes + lo cobrado en adelanto de meses futuros (dinero ya en caja)
  const totalGen  = useMemo(() => cobros.reduce((s, c) => s + c.valorCobro, 0), [cobros]);
  const totalCaja = totalPag + totalAdelantadoRecibido;

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

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '¿Eliminar cartera?',
      message: 'Esta acción no se puede deshacer y borrará la configuración de la cartera.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteCartera(id);
          setFeedback({ ok: true, msg: 'Cartera eliminada correctamente.' });
        } catch (e: any) {
          setFeedback({ ok: false, msg: e.message });
        }
      }
    });
  };

  const handleEdit = (c: Cartera) => { setEditCartera(c); setModalOpen(true); };
  const handlePagoAdelanto = (c: Cartera) => setAdelantoCartera(c);

  const handleGenerar = async () => {
    setGenerando(true); setFeedback(null);
    try {
      const count = await generarCobrosParaMes(mesSel, anioSel);
      setFeedback({ ok: true, msg: count > 0 ? `✓ ${count} cobros generados para ${MESES[mesSel - 1]} ${anioSel}.` : 'Los cobros ya estaban generados.' });
    } catch (e: any) {
      setFeedback({ ok: false, msg: e.message });
    } finally { setGenerando(false); }
  };

  const closeModal = () => { setModalOpen(false); setEditCartera(null); };

  if (lCobros || lCarteras || lClientes || lCierres) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cobros</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Ordenados por fecha · los primeros son los más urgentes
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
          {/* Generar cobros: visible en cualquier mes SIN cierre ejecutado */}
          {puedeGenerar && (
            <button onClick={handleGenerar} disabled={generando}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60 shadow-sm"
              title={mesCerrado ? 'Este mes ya fue cerrado' : 'Genera cobros para carteras que aún no tengan uno este mes'}>
              <RefreshCw size={14} className={generando ? 'animate-spin' : ''} />
              {generando ? 'Generando...' : `Generar cobros de ${MESES[mesSel - 1]}`}
            </button>
          )}
          <button onClick={() => { setEditCartera(null); setModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm hover:-translate-y-0.5">
            <PlusCircle size={15} /> Nueva Cartera
          </button>
        </div>
      </div>

      {/* ── Navegador de mes ("pasar hojas") ── */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={irMesAnterior}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition shadow-sm"
          title="Mes anterior"
        >
          <ChevronLeft size={18} />
        </button>

        <div className={`flex items-center gap-3 px-6 py-2.5 rounded-2xl border font-semibold text-sm shadow-sm transition-all ${
          esMesActual
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200'
            : esMesFuturo
            ? 'bg-purple-50 border-purple-200 text-purple-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <CalendarDays size={15} />
          <span className="text-base font-bold">{MESES[mesSel - 1]} {anioSel}</span>
          {esMesActual && (
            <span className="ml-1 text-[10px] font-bold bg-white/25 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Actual</span>
          )}
          {!esMesActual && esMesFuturo && (
            <span className="ml-1 text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Futuro</span>
          )}
          {!esMesActual && !esMesFuturo && (
            <span className="ml-1 text-[10px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Pasado</span>
          )}
        </div>

        <button
          onClick={irMesSiguiente}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition shadow-sm"
          title="Mes siguiente"
        >
          <ChevronRight size={18} />
        </button>

        {!esMesActual && (
          <button
            onClick={irHoy}
            className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 hover:underline transition px-2"
          >
            Ir a hoy
          </button>
        )}
      </div>

      {/* Banner: mes cerrado oficialmente → solo lectura */}
      {mesCerrado && (
        <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
          <div>
            <span className="font-semibold">Mes cerrado — </span>
            <strong>{MESES[mesSel - 1]} {anioSel}</strong> ya tiene cierre ejecutado.
            Este período es de solo lectura; no se pueden generar ni modificar cobros.
          </div>
        </div>
      )}

      {/* Banner: mes pasado sin cierre → editable */}
      {!esMesActual && !esMesFuturo && !mesCerrado && cobros.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold">Período sin cerrar — </span>
            estás viendo <strong>{MESES[mesSel - 1]} {anioSel}</strong>.
            Puedes registrar pagos atrasados y generar cobros de carteras faltantes.
          </div>
        </div>
      )}

      {/* Banner: mes futuro con cobros anticipados */}
      {esMesFuturo && !mesCerrado && cobros.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 text-sm">
          <CalendarDays size={16} className="mt-0.5 flex-shrink-0 text-purple-500" />
          <div>
            <span className="font-semibold">Mes futuro — </span>
            hay cobros anticipados para <strong>{MESES[mesSel - 1]} {anioSel}</strong>.
            Puedes generar los que falten o registrar pagos adelantados.
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${
          feedback.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {feedback.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {feedback.msg}
          <button onClick={() => setFeedback(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-indigo-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total {MESES[mesSel-1]}</p>
            <p className="text-lg font-bold text-slate-800">{formatCOP(totalGen)}</p>
            <p className="text-[10px] text-slate-400">{cobros.length} carteras</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ya cobrado</p>
            <p className="text-lg font-bold text-emerald-600">{formatCOP(totalPag)}</p>
            <p className="text-[10px] text-slate-400">{pagados.length} pagos</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-rose-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-rose-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Falta cobrar</p>
            <p className="text-lg font-bold text-rose-600">{formatCOP(totalPend)}</p>
            <p className="text-[10px] text-slate-400">{pendientes.length} pendientes</p>
          </div>
        </div>

        <div className="bg-indigo-600 rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-indigo-200">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <DollarSign size={18} className="text-white" />
          </div>
          <div className="text-white">
            <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">Total en caja</p>
            <p className="text-lg font-bold">{formatCOP(totalCaja)}</p>
            <p className="text-[10px] opacity-90 font-medium whitespace-nowrap">
              {totalAdelantadoRecibido > 0 ? `Incluye adelantos` : 'Hoy'}
            </p>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cartera o cliente..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition" />
      </div>

      {cobros.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <Briefcase size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No hay cobros para {MESES[mesSel - 1]} {anioSel}</p>
          {mesCerrado ? (
            <p className="text-slate-400 text-xs mt-2">
              Este mes ya tiene cierre ejecutado y no registró cobros.
            </p>
          ) : (
            <>
              <p className="text-slate-400 text-xs mt-1 mb-3">
                {esMesActual
                  ? 'Usa el botón "Generar cobros" para crear los cobros del mes.'
                  : esMesFuturo
                  ? 'Puedes generar los cobros anticipadamente, o esperar al cierre del mes anterior.'
                  : 'Este mes pasado no tiene cobros. Puedes generarlos para registrar pagos atrasados.'}
              </p>
              <button onClick={handleGenerar} disabled={generando}
                className="mt-1 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                <RefreshCw size={14} className={generando ? 'animate-spin' : ''} />
                {generando ? 'Generando...' : `Generar cobros de ${MESES[mesSel - 1]} ${anioSel}`}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pendientes */}
          {pendientes.length > 0 && (
            <div className="space-y-2">
              <SectionHeader label="⚡ Pendientes de cobro" count={pendientes.length}
                total={formatCOP(totalPend)} color="rose"
                collapsed={colPend} onToggle={() => setColPend(v => !v)} />
              {!colPend && (
                <CobroTable cobros={pendientes} carteras={carteras} clientes={clientes}
                  onPago={handlePago} onCortesia={handleCortesia} onEdit={handleEdit} onDelete={handleDelete}
                  onPagoAdelanto={handlePagoAdelanto} loadingId={loadingId} />
              )}
            </div>
          )}

          {/* Pagados */}
          {pagados.length > 0 && (
            <div className="space-y-2">
              <SectionHeader label="✓ Ya cobrado" count={pagados.length}
                total={formatCOP(totalPag)} color="emerald"
                collapsed={colPag} onToggle={() => setColPag(v => !v)} />
              {!colPag && (
                <CobroTable cobros={pagados} carteras={carteras} clientes={clientes}
                  onPago={handlePago} onCortesia={handleCortesia} onEdit={handleEdit} onDelete={handleDelete}
                  onPagoAdelanto={handlePagoAdelanto} loadingId={loadingId} />
              )}
            </div>
          )}

          {cobrosOrdenados.length === 0 && search && (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400 text-sm">
              Sin resultados para "<strong>{search}</strong>"
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal}
        title={editCartera ? `Editar: ${editCartera.nombre}` : 'Nueva Cartera'} size="lg">
        <CarteraForm onClose={closeModal} clientes={clientes} initial={editCartera} />
      </Modal>

      <Modal isOpen={!!adelantoCartera} onClose={() => setAdelantoCartera(null)}
        title="Registrar pago adelantado" size="md">
        {adelantoCartera && (
          <PagoAdelantoModal
            cartera={adelantoCartera}
            mesActual={mesActual}
            anioActual={anioActual}
            onClose={() => setAdelantoCartera(null)}
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
