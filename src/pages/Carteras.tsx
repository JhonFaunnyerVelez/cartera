import { useState, useMemo, Fragment } from 'react';
import {
  Search, CheckCircle2, XCircle, Pencil,
  Trash2, RefreshCw, AlertCircle,
  ChevronUp, ChevronDown, Briefcase, CalendarDays, Gift,
  ChevronLeft, ChevronRight, Power, PowerOff,
  List, Calendar, Building2,
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
import RegistroPagoModal from '../components/carteras/RegistroPagoModal';
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
  clasesFilaAdelanto,
  etiquetaMesRecibido,
  esPagoAnticipado,
  tieneAdelantoRecibido,
} from '../components/carteras/AdelantoIndicators';
import { agruparCobrosPorDiaYEmpresa, getEstadoVisualCobro, type EstadoTotalGrupo } from '../utils/cobrosAgrupados';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const CLASES_TOTAL_GRUPO: Record<EstadoTotalGrupo, string> = {
  pagado: 'bg-emerald-500 text-white shadow-emerald-200/50',
  vencido: 'bg-rose-500 text-white shadow-rose-200/50',
  'al-dia': 'bg-slate-400 text-white shadow-slate-200/50',
  adelanto: 'bg-sky-500 text-white shadow-sky-200/50',
};

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}
function parseTimestamp(ts: unknown): Date | null {
  if (!ts) return null;
  try {
    if (ts instanceof Date) return ts;
    const t = ts as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof t.toDate === 'function') return t.toDate();
    if (typeof t.seconds === 'number') return new Date(t.seconds * 1000);
    if (typeof t._seconds === 'number') return new Date(t._seconds * 1000);
  } catch {
    return null;
  }
  return null;
}

function formatFechaHora(ts: unknown): { fecha: string; hora: string } | null {
  const d = parseTimestamp(ts);
  if (!d || Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { fecha: `${dd}/${mm}/${yyyy}`, hora: `${hh}:${min}` };
}

function CeldaFechaHora({ ts }: { ts: unknown }) {
  const fmt = formatFechaHora(ts);
  if (!fmt) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-col leading-tight whitespace-nowrap">
      <span className="text-slate-700 font-medium text-xs tabular-nums">{fmt.fecha}</span>
      <span className="text-slate-400 text-[10px] tabular-nums">{fmt.hora}</span>
    </div>
  );
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
  cobro, cartera, onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, onToggleActiva, loadingId,
  vistaUnificada = false,
  empresaGrupo,
  empresaRowSpan,
  empresaTotal,
  empresaTotalEstado,
}: {
  cobro: CobroMensual;
  cartera?: Cartera;
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  onToggleActiva: (c: Cartera) => void;
  loadingId: string | null;
  vistaUnificada?: boolean;
  empresaGrupo?: string;
  empresaRowSpan?: number;
  empresaTotal?: number;
  empresaTotalEstado?: EstadoTotalGrupo;
}) {
  const isPagado  = cobro.estado === 'Pagado';
  const isMora    = cobro.estado === 'Mora';
  const isLoading = loadingId === cobro.id;
  const estVisual = getEstadoVisualCobro(cobro);

  const conAdelanto = tieneAdelantoRecibido(cobro) && !esPagoAnticipado(cobro);
  const diaCls = vistaUnificada
    ? estVisual === 'pagado'
      ? conAdelanto ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'
      : estVisual === 'vencido'
      ? 'bg-rose-500 text-white'
      : 'bg-slate-300 text-slate-800'
    : isMora
    ? 'bg-rose-500 text-white'
    : isPagado
    ? conAdelanto ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'
    : 'bg-indigo-300 text-indigo-900';

  return (
    <tr className={clasesFilaCobro(cobro, vistaUnificada)}>
      {empresaGrupo && empresaRowSpan && (
        <td
          rowSpan={empresaRowSpan}
          className={`align-top bg-slate-50/60 border-r border-slate-100 w-[7rem] min-w-[7rem] max-w-[8rem] ${
            empresaRowSpan === 1 ? '!py-1.5 !px-1.5' : '!py-2 !px-2'
          }`}
        >
          <div className={empresaRowSpan === 1 ? 'space-y-1' : 'space-y-1.5 sticky top-0'}>
            <div className="flex items-start gap-1 min-w-0">
              <Building2 size={10} className="text-indigo-400 shrink-0 mt-0.5" />
              <p
                className="text-[10px] font-semibold text-slate-600 leading-tight break-words line-clamp-2"
                title={empresaGrupo}
              >
                {empresaGrupo}
              </p>
            </div>
            {empresaTotal != null && (
              <span className={`block w-full text-center rounded px-1 py-0.5 text-[9px] font-bold tabular-nums leading-none ${
                CLASES_TOTAL_GRUPO[empresaTotalEstado ?? 'al-dia']
              }`}>
                {formatCOP(empresaTotal)}
              </span>
            )}
          </div>
        </td>
      )}

      {/* Día del mes */}
      <td className="w-10 text-center">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto font-bold text-xs ${diaCls}`}>
          {cobro.fechaVencimiento?.toDate?.()?.getDate() ?? '—'}
        </div>
      </td>

      {/* Cartera */}
      <td className="min-w-[160px]">
        <p className="font-bold leading-tight text-slate-800">
          {cobro.carteraNombre || 'Sin nombre'}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
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
          {conAdelanto ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-bold text-emerald-600">{formatCOP(cobro.valorCobro)}</span>
              <span className="font-bold text-sky-600">{formatCOP(cobro.montoAdelantado!)}</span>
            </div>
          ) : (
            <span className={`font-bold ${
              cobro.esCortesia
                ? 'text-slate-400 line-through'
                : esPagoAnticipado(cobro)
                ? 'text-slate-400'
                : isPagado ? 'text-emerald-600' : isMora ? 'text-rose-600' : 'text-slate-800'
            }`}>
              {formatCOP(cobro.valorCobro)}
            </span>
          )}
          {esPagoAnticipado(cobro) && (
            <span className="text-[10px] font-semibold text-sky-700">Sin caja en este mes</span>
          )}
          {cobro.esCortesia && (
            <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-tighter">Cortesía</span>
          )}
        </div>
      </td>

      {/* Fecha vencimiento */}
      <td><CeldaFechaHora ts={cobro.fechaVencimiento} /></td>

      {/* Fecha de pago */}
      <td>{isPagado ? <CeldaFechaHora ts={cobro.fechaPago} /> : <span className="text-slate-400">—</span>}</td>

      {/* Estado */}
      <td>
        {isPagado ? (
          esPagoAnticipado(cobro) ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Pagado antes
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

// ─── Tabla de cobros agrupada por día y empresa ──────────────────────────────
type CobroTableProps = {
  cobros: CobroMensual[];
  carteras: Cartera[];
  clientesMap: Map<string, Cliente>;
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  onToggleActiva: (c: Cartera) => void;
  loadingId: string | null;
  vistaUnificada?: boolean;
};

function CobroTable({
  cobros, carteras, clientesMap,
  onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, onToggleActiva, loadingId,
  vistaUnificada = false,
}: CobroTableProps) {
  const bloques = useMemo(
    () => agruparCobrosPorDiaYEmpresa(cobros, clientesMap),
    [cobros, clientesMap]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr className="bg-indigo-600 text-left">
              <th className="text-white w-28 text-center">Empresa</th>
              <th className="text-white w-10 text-center">Día</th>
              <th className="text-white">Cartera</th>
              <th className="text-white">Valor</th>
              <th className="text-white">Vencimiento</th>
              <th className="text-white">Pagado el</th>
              <th className="text-white">Estado</th>
              <th className="text-white">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {bloques.map(bloque => (
              <Fragment key={bloque.key}>
                {bloque.empresas.map(grupoEmp => (
                  <Fragment key={`${bloque.key}-${grupoEmp.empresa}`}>
                    {grupoEmp.cobros.map((cobro, idx) => (
                      <CobroRow
                        key={cobro.id}
                        cobro={cobro}
                        cartera={carteras.find(c => c.id === cobro.carteraId)}
                        onPago={onPago}
                        onCortesia={onCortesia}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onPagoAdelanto={onPagoAdelanto}
                        onToggleActiva={onToggleActiva}
                        loadingId={loadingId}
                        vistaUnificada={vistaUnificada}
                        empresaGrupo={idx === 0 ? grupoEmp.empresa : undefined}
                        empresaRowSpan={idx === 0 ? grupoEmp.cobros.length : undefined}
                        empresaTotal={idx === 0 ? grupoEmp.total : undefined}
                        empresaTotalEstado={idx === 0 ? grupoEmp.estadoTotal : undefined}
                      />
                    ))}
                  </Fragment>
                ))}
              </Fragment>
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
  const [pagoCobro, setPagoCobro] = useState<CobroMensual | null>(null);
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

  const clientesMap = useMemo(() => {
    const map = new Map<string, Cliente>();
    for (const c of clientes) map.set(c.id, c);
    return map;
  }, [clientes]);

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
        const empresa = clientesMap.get(c.clienteId)?.empresa || '';
        return [c.clienteNombre, c.carteraNombre, empresa].join(' ').toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const da = a.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
        const db = b.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
        return da - db;
      });
  }, [cobrosDelMes, search, carterasMap, clientesMap, mesPasado]);

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
  const pagadosCortesia = useMemo(
    () => pagados.filter(c => c.esCortesia),
    [pagados]
  );
  const pagadosConAdelanto = useMemo(
    () => pagadosCaja.filter(c => tieneAdelantoRecibido(c)),
    [pagadosCaja]
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
  const totalCortesiaNominal = useMemo(
    () => pagadosCortesia.reduce((s, c) => s + c.valorCobro, 0),
    [pagadosCortesia]
  );
  const totalAnticipadoNominal = useMemo(
    () => pagadosAnticipados.reduce((s, c) => s + c.valorCobro, 0),
    [pagadosAnticipados]
  );
  const totalCaja = totalPag + totalAdelantadoRecibido;

  const totalGen  = useMemo(() => cobrosOrdenados.reduce((s, c) => s + c.valorCobro, 0), [cobrosOrdenados]);
  /** Dinero que sí puede entrar a caja este mes (sin cortesías ni pagados en otro mes). */
  const realmenteACobrar = useMemo(
    () => Math.max(0, totalGen - totalCortesiaNominal - totalAnticipadoNominal),
    [totalGen, totalCortesiaNominal, totalAnticipadoNominal]
  );
  const carterasRealmenteACobrar = useMemo(
    () => cobrosOrdenados.filter(c => !c.esCortesia && !esPagoAnticipado(c)).length,
    [cobrosOrdenados]
  );
  const pctPagos = carterasRealmenteACobrar > 0
    ? Math.round((pagadosCaja.length / carterasRealmenteACobrar) * 100)
    : 0;
  const pctRecaudoReal = realmenteACobrar > 0
    ? Math.round((totalPag / realmenteACobrar) * 100)
    : 0;

  const handlePago = (cobro: CobroMensual, isPagado: boolean) => {
    if (isPagado) {
      setConfirmConfig({
        isOpen: true,
        title: '¿Revertir pago?',
        message: `¿Estás seguro de que quieres revertir el pago de ${cobro.carteraNombre}?`,
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
    setPagoCobro(cobro);
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
            Ordenadas por día de vencimiento, agrupadas por empresa
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

      {/* KPIs principales */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.88fr_0.82fr] gap-2">
          <div className="bg-white rounded-xl border border-indigo-100 p-3 shadow-sm grid grid-cols-[0.85fr_1.15fr_0.75fr] divide-x divide-indigo-100 gap-2 items-start">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-tight">Lo que va a cobrar</p>
              <p className="text-base font-bold text-slate-700 tabular-nums mt-1">{formatCOP(totalGen)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{cobrosOrdenados.length} carteras</p>
            </div>
            <div className="min-w-0 px-1">
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider leading-tight">Realmente a cobrar</p>
              <p className="text-base font-bold text-indigo-700 tabular-nums mt-1">{formatCOP(realmenteACobrar)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{carterasRealmenteACobrar} pagos</p>
              <p className="text-[10px] text-slate-400 tabular-nums leading-snug">
                {formatCOP(totalGen)} − {formatCOP(totalCortesiaNominal)} − {formatCOP(totalAnticipadoNominal)}
              </p>
            </div>
            <div className="min-w-0 pl-1">
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider leading-tight">Pagos cobrados</p>
              <p className="text-base font-bold text-indigo-700 tabular-nums mt-1">{pctPagos}%</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {pagadosCaja.length}/{carterasRealmenteACobrar}
                {pctRecaudoReal !== pctPagos && ` · ${pctRecaudoReal}% $`}
              </p>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, pctPagos)}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-emerald-100 p-3 shadow-sm grid grid-cols-2 divide-x divide-emerald-100 gap-2 items-start">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-tight">Ya cobrado</p>
              <p className="text-base font-bold text-emerald-600 tabular-nums mt-1">{formatCOP(totalPag)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{pagadosCaja.length} pagos</p>
            </div>
            <div className="min-w-0 pl-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-tight">En caja</p>
              <p className="text-base font-bold text-sky-700 tabular-nums mt-1">{formatCOP(totalCaja)}</p>
              <p className="text-[10px] text-slate-400 mt-1 tabular-nums leading-snug">
                {formatCOP(totalPag)} + {formatCOP(totalAdelantadoRecibido)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-rose-100 p-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider leading-tight">Lo que falta</p>
              <p className="text-base font-bold text-rose-600 tabular-nums mt-1">{formatCOP(totalPend)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{pendientes.length} pendientes</p>
              <p className="text-[10px] text-slate-400 tabular-nums leading-snug">
                {formatCOP(realmenteACobrar)} − {formatCOP(totalPag)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 p-3 grid grid-cols-2 divide-x divide-slate-200 gap-3 bg-white shadow-sm">
            <div className="min-w-0 pr-1">
              <p className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${totalAdelantadoRecibido > 0 ? 'text-sky-700' : 'text-slate-500'}`}>Adelantos recibidos</p>
              <p className={`text-base font-bold tabular-nums mt-1 ${totalAdelantadoRecibido > 0 ? 'text-sky-800' : 'text-slate-500'}`}>
                {formatCOP(totalAdelantadoRecibido)}
              </p>
              <p className={`text-[10px] mt-1 ${totalAdelantadoRecibido > 0 ? 'text-sky-600/90' : 'text-slate-400'}`}>
                {pagadosConAdelanto.length} pago{pagadosConAdelanto.length !== 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-slate-400">Suma a caja · meses futuros</p>
            </div>
            <div className="min-w-0 pl-2">
              <p className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${pagadosCortesia.length > 0 ? 'text-violet-700' : 'text-slate-500'}`}>Cortesías</p>
              <p className={`text-base font-bold tabular-nums mt-1 ${pagadosCortesia.length > 0 ? 'text-violet-800 line-through decoration-violet-400/60' : 'text-slate-500'}`}>
                {formatCOP(totalCortesiaNominal)}
              </p>
              <p className={`text-[10px] mt-1 ${pagadosCortesia.length > 0 ? 'text-violet-600/90' : 'text-slate-400'}`}>
                {pagadosCortesia.length} perdonada{pagadosCortesia.length !== 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-slate-400">$0 en caja</p>
            </div>
          </div>

          <div className={`rounded-xl border p-3 ${pagadosAnticipados.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${pagadosAnticipados.length > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Pagados antes</p>
            <p className={`text-base font-bold tabular-nums mt-1 ${pagadosAnticipados.length > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
              {formatCOP(totalAnticipadoNominal)}
            </p>
            <p className={`text-[10px] mt-1 ${pagadosAnticipados.length > 0 ? 'text-amber-600/90' : 'text-slate-400'}`}>
              {pagadosAnticipados.length} cobro{pagadosAnticipados.length !== 1 ? 's' : ''} · pagaron en otro mes
            </p>
            <p className="text-[10px] text-slate-400">Sin caja en este mes</p>
          </div>
        </div>
      </div>


      {/* Buscador + tabs de vista */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cartera, cliente o empresa..."
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
            clientesMap={clientesMap}
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
                <CobroTable cobros={pendientes} carteras={carteras} clientesMap={clientesMap}
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
                <CobroTable cobros={pagadosCaja} carteras={carteras} clientesMap={clientesMap}
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
                <CobroTable cobros={pagadosAnticipados} carteras={carteras} clientesMap={clientesMap}
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

      <Modal isOpen={!!pagoCobro} onClose={() => setPagoCobro(null)} title="Registrar pago" size="md">
        {pagoCobro && (
          <RegistroPagoModal
            cobro={pagoCobro}
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
