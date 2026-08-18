import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, CheckCircle2, XCircle, Pencil,
  Trash2, RefreshCw, AlertCircle, DollarSign, Clock,
  ChevronUp, ChevronDown, Briefcase, CalendarDays, Gift,
  ChevronLeft, ChevronRight, Power, PowerOff,
  List, Calendar,
} from 'lucide-react';
import { useCobros } from '../hooks/useCobros';
import { useCarteras } from '../hooks/useCarteras';
import { useClientes } from '../hooks/useClientes';
import { generarCobrosParaMes } from '../services/cierreMensual';
import type { CobroMensual, Cartera, Cliente } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CarteraForm from '../components/carteras/CarteraForm';
import PagoAdelantoModal from '../components/carteras/PagoAdelantoModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { cobroVisibleEnMes, esCarteraActiva } from '../utils/activo';
import { esMesPasado } from '../utils/periodo';
import {
  combinarCobrosConVirtuales,
  esCobroVirtual,
  materializarCobroVirtual,
} from '../utils/cobrosVirtuales';
import {
  BadgePagoAnticipado,
  BadgeRecibioAdelanto,
  MontoAdelantadoExtra,
  clasesFilaAdelanto,
  etiquetaMesRecibido,
  esPagoAnticipado,
  tieneAdelantoRecibido,
} from '../components/carteras/AdelantoIndicators';

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

type EstadoVisualCobro = 'pagado' | 'al-dia' | 'vencido';

function getEstadoVisualCobro(cobro: CobroMensual): EstadoVisualCobro {
  if (cobro.estado === 'Pagado') return 'pagado';
  if (cobro.estado === 'Mora') return 'vencido';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = cobro.fechaVencimiento?.toDate?.();
  if (!venc) return 'al-dia';
  venc.setHours(0, 0, 0, 0);
  if (venc.getTime() <= hoy.getTime()) return 'vencido';
  return 'al-dia';
}

function clasesFilaCobro(cobro: CobroMensual, vistaUnificada: boolean): string {
  const bordeVerde = esPagoAnticipado(cobro) || tieneAdelantoRecibido(cobro)
    ? ''
    : 'border-l-4 border-l-emerald-500';

  if (!vistaUnificada) {
    const isPagado = cobro.estado === 'Pagado';
    const isMora = cobro.estado === 'Mora';
    return `transition group border-b ${
      isPagado
        ? `bg-emerald-100/80 ${bordeVerde} border-emerald-300`
        : isMora
        ? 'bg-rose-100/80 border-l-4 border-l-rose-500 border-rose-300'
        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
    } ${clasesFilaAdelanto(cobro)}`;
  }
  const est = getEstadoVisualCobro(cobro);
  if (est === 'pagado') return `transition group border-b border-emerald-300 bg-emerald-100/80 ${bordeVerde} ${clasesFilaAdelanto(cobro)}`;
  if (est === 'vencido') return `transition group border-b border-rose-300 bg-rose-100/80 border-l-4 border-l-rose-500`;
  return `transition group border-b border-slate-200 bg-slate-50 hover:bg-slate-100/70 ${clasesFilaAdelanto(cobro)}`;
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
  cobro, cartera, clienteInfo, onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, onToggleActiva, loadingId,
  vistaUnificada = false,
}: {
  cobro: CobroMensual;
  cartera?: Cartera;
  clienteInfo?: Cliente;
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  onToggleActiva: (c: Cartera) => void;
  loadingId: string | null;
  vistaUnificada?: boolean;
}) {
  const isPagado  = cobro.estado === 'Pagado';
  const isMora    = cobro.estado === 'Mora';
  const isLoading = loadingId === cobro.id;
  const estVisual = getEstadoVisualCobro(cobro);

  const diaCls = vistaUnificada
    ? estVisual === 'pagado'
      ? 'bg-emerald-500 text-white'
      : estVisual === 'vencido'
      ? 'bg-rose-500 text-white'
      : 'bg-slate-300 text-slate-800'
    : isMora
    ? 'bg-rose-500 text-white'
    : isPagado
    ? 'bg-emerald-500 text-white'
    : 'bg-indigo-300 text-indigo-900';

  return (
    <tr className={clasesFilaCobro(cobro, vistaUnificada)}>

      {/* Día del mes */}
      <td className="w-10 text-center">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto font-bold text-xs ${diaCls}`}>
          {cobro.fechaVencimiento?.toDate?.()?.getDate() ?? '—'}
        </div>
      </td>

      {/* CARTERA arriba (bold) · Cliente + Empresa abajo (pequeño) */}
      <td className="min-w-[160px]">
        <p className="font-bold leading-tight text-slate-800">
          {cobro.carteraNombre || 'Sin nombre'}
        </p>
        <Link
          to={`/clientes/${cobro.clienteId}`}
          className="inline-flex items-center gap-1 mt-0.5 text-xs text-slate-600 hover:text-indigo-600 transition"
        >
          {cobro.clienteNombre || '—'}
          {clienteInfo?.empresa && (
            <span className="text-slate-500">· {clienteInfo.empresa}</span>
          )}
        </Link>
        <div className="mt-0.5 flex items-center gap-2">
          <DiasLabel ts={cobro.fechaVencimiento} pagado={isPagado} />
          {esPagoAnticipado(cobro) && (
            <BadgePagoAnticipado mesRecibido={etiquetaMesRecibido(cobro)} />
          )}
          {tieneAdelantoRecibido(cobro) && !esPagoAnticipado(cobro) && <BadgeRecibioAdelanto />}
        </div>
      </td>

      {/* Valor */}
      <td>
        <div className="flex flex-col justify-center">
          <span className={`font-bold ${
            cobro.esCortesia 
              ? 'text-slate-400 line-through' 
              : esPagoAnticipado(cobro)
              ? 'text-slate-400'
              : isPagado ? 'text-emerald-600' : isMora ? 'text-rose-600' : 'text-slate-800'
          }`}>
            {formatCOP(cobro.valorCobro)}
          </span>
          {esPagoAnticipado(cobro) && (
            <span className="text-[10px] font-semibold text-sky-700">Sin caja en este mes</span>
          )}
          {cobro.esCortesia && (
            <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-tighter">Cortesía</span>
          )}
          {cobro.montoAdelantado && cobro.montoAdelantado > 0 && (
            <MontoAdelantadoExtra monto={cobro.montoAdelantado} />
          )}
        </div>
      </td>

      {/* Fecha vencimiento */}
      <td className="text-slate-600">{formatDate(cobro.fechaVencimiento)}</td>

      {/* Fecha de pago */}
      <td className="text-slate-600 text-[11px]">
        {isPagado ? formatDateFull(cobro.fechaPago) : '—'}
      </td>

      {/* Estado */}
      <td>
        {isPagado ? (
          esPagoAnticipado(cobro) ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Pagado antes
            </span>
          ) : tieneAdelantoRecibido(cobro) ? (
            <span className="inline-flex flex-col gap-0.5 items-start">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Pagado
              </span>
              <span className="text-[10px] font-bold text-sky-700">+ adelanto en caja</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Pagado
            </span>
          )
        ) : isMora ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> En mora
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pendiente
          </span>
        )}
      </td>

      {/* Acciones — siempre visibles y mejor organizadas */}
      <td>
        <div className="flex items-center gap-1">
          {/* Botón Pago Normal */}
          <button
            onClick={() => onPago(cobro, isPagado)}
            disabled={isLoading}
            title={isPagado ? 'Revertir pago' : 'Registrar pago'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
              ${isPagado 
                ? 'bg-rose-50 text-rose-500 hover:bg-rose-100 ring-1 ring-rose-200' 
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-1 ring-emerald-200'}`}
          >
            {isLoading ? <RefreshCw size={12} className="animate-spin" /> : isPagado ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
          </button>

          {/* Botón Cortesia (solo si está pendiente y activa) */}
          {!isPagado && cartera && esCarteraActiva(cartera) && (
            <button
              onClick={() => onCortesia(cobro)}
              disabled={isLoading}
              title="Registrar como Cortesía ($0)"
              className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all ring-1 ring-indigo-200 flex items-center justify-center"
            >
              <Gift size={14} />
            </button>
          )}

          {/* Botón Pago Adelantado (solo si está pendiente y activa) */}
          {!isPagado && cartera && esCarteraActiva(cartera) && (
            <button 
              onClick={() => onPagoAdelanto(cartera)} 
              disabled={isLoading}
              title="Adelantar pagos"
              className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all ring-1 ring-purple-200 flex items-center justify-center"
            >
              <CalendarDays size={14} />
            </button>
          )}

          {/* Botón Editar Cartera */}
          {cartera && (
            <button 
              onClick={() => onEdit(cartera)} 
              title="Editar configuración"
              className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all ring-1 ring-slate-200 flex items-center justify-center"
            >
              <Pencil size={12} />
            </button>
          )}

          {/* Botón Eliminar Cartera */}
          {cartera && (
            <button 
              onClick={() => onDelete(cartera.id)} 
              title="Eliminar cartera"
              className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-all ring-1 ring-rose-100 flex items-center justify-center"
            >
              <Trash2 size={12} />
            </button>
          )}

          {/* Activar / Desactivar */}
          {cartera && (
            <button
              onClick={() => onToggleActiva(cartera)}
              title={esCarteraActiva(cartera) ? 'Desactivar cartera' : 'Reactivar cartera'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ring-1 ${
                esCarteraActiva(cartera)
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 ring-amber-200'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-emerald-200'
              }`}
            >
              {esCarteraActiva(cartera) ? <PowerOff size={12} /> : <Power size={12} />}
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
    rose:    'bg-rose-100 border-rose-300 text-rose-800',
    emerald: 'bg-emerald-100 border-emerald-300 text-emerald-800',
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
function CobroTable({ cobros, carteras, clientes, onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, onToggleActiva, loadingId, vistaUnificada = false }: {
  cobros: CobroMensual[];
  carteras: Cartera[];
  clientes: Cliente[];
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  onToggleActiva: (c: Cartera) => void;
  loadingId: string | null;
  vistaUnificada?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr className="bg-indigo-600 text-left">
              <th className="text-white w-10 text-center">Día</th>
              <th className="text-white">Cartera / Cliente</th>
              <th className="text-white">Valor</th>
              <th className="text-white">Vencimiento</th>
              <th className="text-white">Pagado el</th>
              <th className="text-white">Estado</th>
              <th className="text-white">Acciones</th>
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
                onToggleActiva={onToggleActiva}
                loadingId={loadingId}
                vistaUnificada={vistaUnificada}
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
  const { carteras, loading: lCarteras, deleteCartera, setCarteraActiva } = useCarteras();
  const { clientes, loading: lClientes } = useClientes();

  const mesPasado = esMesPasado(mesSel, anioSel);
  const usaProyeccionDinamica = esMesActual || esMesFuturo;
  const puedeGenerar = mesPasado;

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCartera, setEditCartera] = useState<Cartera | null>(null);
  const [adelantoCartera, setAdelantoCartera] = useState<Cartera | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [colPend, setColPend] = useState(false);
  const [colPag, setColPag] = useState(false);
  const [vistaTab, setVistaTab] = useState<'grupos' | 'unificada'>('unificada');

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

  const carterasMap = useMemo(() => {
    const map = new Map<string, Cartera>();
    for (const c of carteras) map.set(c.id, c);
    return map;
  }, [carteras]);

  const cobrosDelMes = useMemo(() => {
    if (!usaProyeccionDinamica) return cobros;
    return combinarCobrosConVirtuales(cobros, carteras, mesSel, anioSel);
  }, [cobros, carteras, mesSel, anioSel, usaProyeccionDinamica]);

  // Ordenar por fecha de vencimiento ASCENDENTE (más urgente primero)
  const cobrosOrdenados = useMemo(() => {
    return [...cobrosDelMes]
      .filter(c => cobroVisibleEnMes(c, carterasMap.get(c.carteraId), mesPasado))
      .filter(c => {
        if (!search.trim()) return true;
        return [c.clienteNombre, c.carteraNombre].join(' ').toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const da = a.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
        const db = b.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
        return da - db;
      });
  }, [cobrosDelMes, search, carterasMap, mesPasado]);

  const pendientes = useMemo(() => cobrosOrdenados.filter(c => c.estado !== 'Pagado'), [cobrosOrdenados]);
  const pagados    = useMemo(() => cobrosOrdenados.filter(c => c.estado === 'Pagado'), [cobrosOrdenados]);
  const pagadosCaja = useMemo(
    () => pagados.filter(c => !esPagoAnticipado(c) && !c.esCortesia),
    [pagados]
  );
  const pagadosAnticipados = useMemo(
    () => pagados.filter(c => esPagoAnticipado(c)),
    [pagados]
  );

  const totalPend = useMemo(() => pendientes.reduce((s, c) => s + c.valorCobro, 0), [pendientes]);
  const totalPag  = useMemo(() => 
    pagadosCaja.reduce((s, c) => s + c.valorCobro, 0), 
    [pagadosCaja]
  );
  const totalAdelantadoRecibido = useMemo(
    () => pagadosCaja.reduce((s, c) => s + (c.montoAdelantado || 0), 0),
    [pagadosCaja]
  );
  
  const totalCaja = totalPag + totalAdelantadoRecibido;

  const totalGen  = useMemo(() => cobrosOrdenados.reduce((s, c) => s + c.valorCobro, 0), [cobrosOrdenados]);

  const handlePago = async (cobro: CobroMensual, isPagado: boolean) => {
    setConfirmConfig({
      isOpen: true,
      title: isPagado ? '¿Revertir pago?' : '¿Registrar pago?',
      message: isPagado
        ? `¿Estás seguro de que quieres revertir el pago de ${cobro.carteraNombre}?`
        : `¿Registrar pago de ${formatCOP(cobro.valorCobro)} por ${cobro.carteraNombre}?`,
      type: isPagado ? 'danger' : 'success',
      onConfirm: async () => {
        setLoadingId(cobro.id);
        try {
          if (isPagado) {
            await revertirPago(cobro);
          } else {
            let cobroPago = cobro;
            if (esCobroVirtual(cobro.id)) {
              const id = await materializarCobroVirtual(cobro);
              cobroPago = { ...cobro, id };
            }
            await registrarPago(cobroPago);
          }
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
          let cobroPago = cobro;
          if (esCobroVirtual(cobro.id)) {
            const id = await materializarCobroVirtual(cobro);
            cobroPago = { ...cobro, id };
          }
          await registrarCortesia(cobroPago);
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

  const handleToggleActiva = (cartera: Cartera) => {
    const activa = esCarteraActiva(cartera);
    setConfirmConfig({
      isOpen: true,
      title: activa ? '¿Desactivar cartera?' : '¿Reactivar cartera?',
      message: activa
        ? `"${cartera.nombre}" dejará de aparecer en cobros futuros. El historial de meses anteriores se conserva.`
        : `"${cartera.nombre}" volverá a aparecer en los cobros del mes actual y futuros.`,
      type: activa ? 'danger' : 'success',
      onConfirm: async () => {
        await setCarteraActiva(cartera.id, !activa);
        setFeedback({ ok: true, msg: activa ? 'Cartera desactivada.' : 'Cartera reactivada.' });
      },
    });
  };

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

  if (lCobros || lCarteras || lClientes) return <LoadingSpinner />;

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
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap justify-end items-center">
          {puedeGenerar && (
            <button onClick={handleGenerar} disabled={generando}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60 shadow-sm"
              title="Genera cobros en Firestore para meses pasados que aún no tengan registro">
              <RefreshCw size={14} className={generando ? 'animate-spin' : ''} />
              {generando ? 'Generando...' : `Generar cobros de ${MESES[mesSel - 1]}`}
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={irMesAnterior}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition shadow-sm"
              title="Mes anterior"
            >
              <ChevronLeft size={18} />
            </button>

            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm shadow-sm transition-all ${
              esMesActual
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200'
                : esMesFuturo
                ? 'bg-purple-50 border-purple-200 text-purple-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <CalendarDays size={15} />
              <span className="font-bold whitespace-nowrap">{MESES[mesSel - 1]} {anioSel}</span>
              {esMesActual && (
                <span className="text-[10px] font-bold bg-white/25 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Actual</span>
              )}
              {!esMesActual && esMesFuturo && (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Futuro</span>
              )}
              {!esMesActual && !esMesFuturo && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Pasado</span>
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
                className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 hover:underline transition px-1"
              >
                Hoy
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Banners informativos */}
      {mesPasado && cobrosDelMes.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold">Mes pasado — </span>
            estás viendo <strong>{MESES[mesSel - 1]} {anioSel}</strong>.
            Puedes registrar pagos atrasados o generar cobros faltantes en Firestore.
          </div>
        </div>
      )}

      {/* Banner: mes actual/futuro con proyección automática */}
      {usaProyeccionDinamica && cobrosDelMes.length > 0 && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm border ${
          esMesFuturo
            ? 'bg-purple-50 border-purple-200 text-purple-800'
            : 'bg-indigo-50 border-indigo-200 text-indigo-800'
        }`}>
          <CalendarDays size={16} className={`mt-0.5 flex-shrink-0 ${esMesFuturo ? 'text-purple-500' : 'text-indigo-500'}`} />
          <div>
            <span className="font-semibold">{esMesFuturo ? 'Mes futuro — ' : 'Mes actual — '}</span>
            los cobros se calculan automáticamente desde las carteras activas.
            {cobros.length < cobrosDelMes.length && (
              <> Al registrar un pago se guarda en el sistema.</>
            )}
          </div>
        </div>
      )}

      {/* Banner: mes futuro con cobros anticipados (pagos adelantados reales) */}
      {esMesFuturo && cobros.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-800 text-sm">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-sky-500" />
          <div>
            <span className="font-semibold">Pagos adelantados — </span>
            hay {cobros.filter(c => c.estado === 'Pagado').length} cobro(s) ya registrados en Firestore para este mes.
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
            <p className="text-[10px] text-slate-400">{cobrosOrdenados.length} carteras</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cobrado del mes</p>
            <p className="text-lg font-bold text-emerald-600">{formatCOP(totalPag)}</p>
            <p className="text-[10px] text-slate-400">{pagadosCaja.length} pago{pagadosCaja.length !== 1 ? 's' : ''} en caja</p>
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
            <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">Caja del mes</p>
            <p className="text-lg font-bold">{formatCOP(totalCaja)}</p>
            <p className="text-[10px] opacity-90 font-medium whitespace-nowrap">
              {totalAdelantadoRecibido > 0
                ? `Incl. ${formatCOP(totalAdelantadoRecibido)} adelanto`
                : 'Solo cobros de este mes'}
            </p>
          </div>
        </div>
      </div>


      {/* Buscador + tabs de vista */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cartera o cliente..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setVistaTab('unificada')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap flex-1 sm:flex-none ${
                vistaTab === 'unificada'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar size={15} /> Vista unificada
            </button>
            <button
              type="button"
              onClick={() => setVistaTab('grupos')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap flex-1 sm:flex-none ${
                vistaTab === 'grupos'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List size={15} /> Por secciones
            </button>
          </div>

          {vistaTab === 'unificada' && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-300 border border-emerald-500" /> Pagado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-400" /> Aún no vence
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-rose-300 border border-rose-500" /> Vencido / sin pagar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-sky-300 border border-sky-500" /> Pagado antes (sin caja)
              </span>
            </div>
          )}
        </div>
      </div>

      {cobrosDelMes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <Briefcase size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No hay cobros para {MESES[mesSel - 1]} {anioSel}</p>
          {mesPasado && cobrosDelMes.length === 0 ? (
            <>
              <p className="text-slate-400 text-xs mt-1 mb-3">
                Este mes pasado no tiene cobros registrados. Puedes generarlos para el historial.
              </p>
              <button onClick={handleGenerar} disabled={generando}
                className="mt-1 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                <RefreshCw size={14} className={generando ? 'animate-spin' : ''} />
                {generando ? 'Generando...' : `Generar cobros de ${MESES[mesSel - 1]} ${anioSel}`}
              </button>
            </>
          ) : usaProyeccionDinamica ? (
            <p className="text-slate-400 text-xs mt-2">
              No hay carteras activas. Crea o reactiva carteras para ver los cobros proyectados de este mes.
            </p>
          ) : null}
        </div>
      ) : vistaTab === 'unificada' ? (
        cobrosOrdenados.length === 0 ? (
          search ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400 text-sm">
              Sin resultados para "<strong>{search}</strong>"
            </div>
          ) : null
        ) : (
          <CobroTable
            cobros={cobrosOrdenados}
            carteras={carteras}
            clientes={clientes}
            onPago={handlePago}
            onCortesia={handleCortesia}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPagoAdelanto={handlePagoAdelanto}
            onToggleActiva={handleToggleActiva}
            loadingId={loadingId}
            vistaUnificada
          />
        )
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
                  onPagoAdelanto={handlePagoAdelanto} onToggleActiva={handleToggleActiva} loadingId={loadingId} />
              )}
            </div>
          )}

          {/* Pagados */}
          {pagadosCaja.length > 0 && (
            <div className="space-y-2">
              <SectionHeader label="✓ Cobrado en caja" count={pagadosCaja.length}
                total={formatCOP(totalPag + totalAdelantadoRecibido)} color="emerald"
                collapsed={colPag} onToggle={() => setColPag(v => !v)} />
              {!colPag && (
                <CobroTable cobros={pagadosCaja} carteras={carteras} clientes={clientes}
                  onPago={handlePago} onCortesia={handleCortesia} onEdit={handleEdit} onDelete={handleDelete}
                  onPagoAdelanto={handlePagoAdelanto} onToggleActiva={handleToggleActiva} loadingId={loadingId} />
              )}
            </div>
          )}

          {pagadosAnticipados.length > 0 && (
            <div className="space-y-2">
              <SectionHeader label="⏩ Pagados antes (no suman a caja)" count={pagadosAnticipados.length}
                total={formatCOP(0)} color="rose"
                collapsed={colPag} onToggle={() => setColPag(v => !v)} />
              {!colPag && (
                <CobroTable cobros={pagadosAnticipados} carteras={carteras} clientes={clientes}
                  onPago={handlePago} onCortesia={handleCortesia} onEdit={handleEdit} onDelete={handleDelete}
                  onPagoAdelanto={handlePagoAdelanto} onToggleActiva={handleToggleActiva} loadingId={loadingId} />
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
