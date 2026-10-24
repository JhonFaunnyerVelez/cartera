import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, CheckCircle2, XCircle, Pencil,
  Trash2, RefreshCw, AlertCircle,
  ChevronUp, ChevronDown, Briefcase, CalendarDays, Gift,
  ChevronLeft, ChevronRight, Power, PowerOff,
  List, Calendar, Building2, MoreVertical, Globe, FilePenLine, Filter,
} from 'lucide-react';
import { useCobros } from '../hooks/useCobros';
import { useCarteras } from '../hooks/useCarteras';
import { useClientes } from '../hooks/useClientes';
import { useAliados } from '../hooks/useAliados';
import { useLiquidacionesAliado } from '../hooks/useLiquidacionesAliado';
import { calcularParticipacion, resumenParticipacion } from '../utils/participacionAliado';
import { generarCobrosParaMes } from '../services/cierreMensual';
import type { Aliado, CobroMensual, Cartera, Cliente } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CarteraForm from '../components/carteras/CarteraForm';
import PagoAdelantoModal from '../components/carteras/PagoAdelantoModal';
import RegistroPagoModal from '../components/carteras/RegistroPagoModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { cobroVisibleEnMes, esCarteraActiva, esClienteActivo } from '../utils/activo';
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

type FiltroCobro = 'vencido' | 'al-dia' | 'pagado' | 'adelanto' | 'cortesia' | 'pagado-antes';

const FILTROS_VACIOS: Record<FiltroCobro, boolean> = {
  vencido: false,
  'al-dia': false,
  pagado: false,
  adelanto: false,
  cortesia: false,
  'pagado-antes': false,
};

const FILTROS_UI: { id: FiltroCobro; label: string; swatch: string; swatch2?: string }[] = [
  { id: 'vencido', label: 'Vencido', swatch: 'bg-rose-300 border-rose-500' },
  { id: 'al-dia', label: 'Aún no vence', swatch: 'bg-slate-200 border-slate-400' },
  { id: 'pagado', label: 'Pagado', swatch: 'bg-emerald-300 border-emerald-500' },
  { id: 'adelanto', label: 'Con adelanto', swatch: 'bg-emerald-300 border-emerald-500', swatch2: 'bg-sky-300 border-sky-500' },
  { id: 'cortesia', label: 'Cortesía', swatch: 'bg-violet-300 border-violet-500' },
  { id: 'pagado-antes', label: 'Pagado antes', swatch: 'bg-sky-300 border-sky-500' },
];

function tipoFiltroCobro(cobro: CobroMensual): FiltroCobro {
  if (cobro.esCortesia && cobro.estado === 'Pagado') return 'cortesia';
  if (esPagoAnticipado(cobro) && cobro.estado === 'Pagado') return 'pagado-antes';
  if (tieneAdelantoRecibido(cobro) && cobro.estado === 'Pagado') return 'adelanto';
  if (cobro.estado === 'Pagado') return 'pagado';
  return getEstadoVisualCobro(cobro) === 'vencido' ? 'vencido' : 'al-dia';
}

const CLASES_TOTAL_GRUPO: Record<EstadoTotalGrupo, string> = {
  pagado: 'bg-emerald-500 text-white shadow-emerald-200/50',
  vencido: 'bg-rose-500 text-white shadow-rose-200/50',
  'al-dia': 'bg-slate-400 text-white shadow-slate-200/50',
  adelanto: 'bg-emerald-500 text-white shadow-emerald-200/50',
  cortesia: 'bg-violet-500 text-white shadow-violet-200/50 line-through decoration-white/70',
  'pagado-antes': 'bg-sky-500 text-white shadow-sky-200/50 line-through decoration-white/70',
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
  const extras = clasesFilaAdelanto(cobro);
  const bordeVerde = esPagoAnticipado(cobro) || tieneAdelantoRecibido(cobro) || cobro.esCortesia
    ? ''
    : 'border-l-4 border-l-emerald-500';

  if (cobro.esCortesia && cobro.estado === 'Pagado') {
    return `transition group border-b border-violet-300 bg-violet-100/80 ${extras}`;
  }

  if (esPagoAnticipado(cobro) && cobro.estado === 'Pagado') {
    return `transition group border-b border-sky-300 bg-sky-100/80 border-l-4 border-l-sky-500`;
  }

  if (tieneAdelantoRecibido(cobro) && !esPagoAnticipado(cobro) && cobro.estado === 'Pagado') {
    return `transition group border-b border-emerald-300 bg-emerald-100/80 border-l-4 border-l-emerald-500`;
  }

  if (!vistaUnificada) {
    const isPagado = cobro.estado === 'Pagado';
    const isMora = cobro.estado === 'Mora';
    return `transition group border-b ${
      isPagado
        ? `bg-emerald-100/80 ${bordeVerde} border-emerald-300`
        : isMora
        ? 'bg-rose-100/80 border-l-4 border-l-rose-500 border-rose-300'
        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
    } ${extras}`;
  }
  const est = getEstadoVisualCobro(cobro);
  if (est === 'pagado') {
    if (esPagoAnticipado(cobro)) {
      return `transition group border-b border-sky-300 bg-sky-100/80 border-l-4 border-l-sky-500`;
    }
    if (tieneAdelantoRecibido(cobro)) {
      return `transition group border-b border-emerald-300 bg-emerald-100/80 border-l-4 border-l-emerald-500`;
    }
    return `transition group border-b border-emerald-300 bg-emerald-100/80 ${bordeVerde} ${extras}`;
  }
  if (est === 'vencido') return `transition group border-b border-rose-300 bg-rose-100/80 border-l-4 border-l-rose-500`;
  return `transition group border-b border-slate-200 bg-slate-50 hover:bg-slate-100/70 ${extras}`;
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

function MenuFilaCobro({
  cobro, cartera, isPagado, isLoading,
  onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, onEditarPago, onToggleActiva,
}: {
  cobro: CobroMensual;
  cartera?: Cartera;
  isPagado: boolean;
  isLoading: boolean;
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  onEditarPago: (cobro: CobroMensual, cartera: Cartera) => void;
  onToggleActiva: (c: Cartera) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, arriba: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activa = cartera ? esCarteraActiva(cartera) : false;
  const puedeCobrar = !isPagado && !!cartera && activa;
  const puedeEditarPago = isPagado && !!cartera && !cobro.esCortesia && !cobro.esPagoAdelantado;

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  const toggle = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const arriba = window.innerHeight - rect.bottom < 320;
    setPos({ top: arriba ? rect.top - 4 : rect.bottom + 4, left: rect.left, arriba });
    setAbierto(v => !v);
  };

  const elegir = (accion: () => void) => {
    setAbierto(false);
    accion();
  };

  const item = 'w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50';

  return (
    <td className="w-10 text-center">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={isLoading}
        title="Opciones"
        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
      >
        {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <MoreVertical size={16} />}
      </button>
      {abierto && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[80] min-w-[11.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          style={{
            top: pos.top,
            left: pos.left,
            transform: pos.arriba ? 'translateY(-100%)' : undefined,
          }}
        >
          <button type="button" className={item} onClick={() => elegir(() => onPago(cobro, isPagado))}>
            {isPagado ? <XCircle size={14} className="text-rose-500" /> : <CheckCircle2 size={14} className="text-emerald-600" />}
            {isPagado ? 'Revertir pago' : 'Registrar pago'}
          </button>
          {puedeEditarPago && (
            <button type="button" className={item} onClick={() => elegir(() => onEditarPago(cobro, cartera!))}>
              <FilePenLine size={14} className="text-indigo-600" /> Editar pago
            </button>
          )}
          {puedeCobrar && (
            <button type="button" className={item} onClick={() => elegir(() => onCortesia(cobro))}>
              <Gift size={14} className="text-violet-600" /> Cortesía
            </button>
          )}
          {puedeCobrar && (
            <button type="button" className={item} onClick={() => elegir(() => onPagoAdelanto(cartera!))}>
              <CalendarDays size={14} className="text-sky-600" /> Adelantar pagos
            </button>
          )}
          {cartera && (
            <button type="button" className={item} onClick={() => elegir(() => onEdit(cartera))}>
              <Pencil size={14} className="text-slate-500" /> Editar cartera
            </button>
          )}
          {cartera && (
            <button type="button" className={item} onClick={() => elegir(() => onToggleActiva(cartera))}>
              {activa ? <PowerOff size={14} className="text-amber-600" /> : <Power size={14} className="text-emerald-600" />}
              {activa ? 'Desactivar' : 'Reactivar'}
            </button>
          )}
          {cartera && (
            <button type="button" className={`${item} text-rose-600 hover:bg-rose-50`} onClick={() => elegir(() => onDelete(cartera.id))}>
              <Trash2 size={14} /> Eliminar
            </button>
          )}
        </div>,
        document.body,
      )}
    </td>
  );
}

// ─── Fila de cobro ────────────────────────────────────────────────────────────
function CobroRow({
  cobro, cartera, cliente, aliados = [], onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, onEditarPago, onToggleActiva, loadingId,
  vistaUnificada = false,
  empresaGrupo,
  empresaRowSpan,
  empresaTotal,
  empresaTotalEstado,
}: {
  cobro: CobroMensual;
  cartera?: Cartera;
  cliente?: Cliente;
  aliados?: Aliado[];
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  onEditarPago: (cobro: CobroMensual, cartera: Cartera) => void;
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
  if (!cartera || !esCarteraActiva(cartera)) return null;
  if (cliente && !esClienteActivo(cliente)) return null;
  const estVisual = getEstadoVisualCobro(cobro);

  const conAdelanto = tieneAdelantoRecibido(cobro) && !esPagoAnticipado(cobro);
  const diaClsPagado = cobro.esCortesia
    ? 'bg-violet-500 text-white'
    : esPagoAnticipado(cobro)
    ? 'bg-sky-500 text-white'
    : 'bg-emerald-500 text-white';

  const diaCls = vistaUnificada
    ? estVisual === 'pagado'
      ? diaClsPagado
      : estVisual === 'vencido'
      ? 'bg-rose-500 text-white'
      : 'bg-slate-300 text-slate-800'
    : isMora
    ? 'bg-rose-500 text-white'
    : isPagado
    ? diaClsPagado
    : 'bg-indigo-300 text-indigo-900';

  const infoAliado = resumenParticipacion(cliente, aliados);
  const montoParticipacion = infoAliado ? calcularParticipacion(cobro.valorCobro, infoAliado.porcentaje) : 0;

  return (
    <tr className={clasesFilaCobro(cobro, vistaUnificada)}>
      <MenuFilaCobro
        cobro={cobro}
        cartera={cartera}
        isPagado={isPagado}
        isLoading={isLoading}
        onPago={onPago}
        onCortesia={onCortesia}
        onEdit={onEdit}
        onDelete={onDelete}
        onPagoAdelanto={onPagoAdelanto}
        onEditarPago={onEditarPago}
        onToggleActiva={onToggleActiva}
      />
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

      <td className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
          <Globe size={11} className="text-slate-400 shrink-0" />
          {cartera.pais?.trim() || cliente?.pais?.trim() || 'Sin país'}
        </span>
      </td>

      {/* Valor */}
      <td>
        <div className="flex flex-col justify-center">
          {conAdelanto ? (
            <div className="flex flex-col gap-1">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700/80 leading-none">Mes</p>
                <p className="font-bold text-emerald-600 tabular-nums leading-tight">{formatCOP(cobro.valorCobro)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-sky-700/80 leading-none">Adelanto</p>
                <p className="font-bold text-sky-700 tabular-nums leading-tight">{formatCOP(cobro.montoAdelantado!)}</p>
              </div>
            </div>
          ) : (
            <span className={`font-bold ${
              cobro.esCortesia
                ? 'text-violet-500 line-through decoration-violet-400/70'
                : esPagoAnticipado(cobro)
                ? 'text-sky-600 line-through decoration-sky-400/70'
                : isPagado ? 'text-emerald-600' : isMora ? 'text-rose-600' : 'text-slate-800'
            }`}>
              {formatCOP(cobro.valorCobro)}
            </span>
          )}
          {esPagoAnticipado(cobro) && (
            <span className="text-[10px] font-semibold text-sky-700">Sin caja en este mes</span>
          )}
          {cobro.esCortesia && (
            <span className="text-[10px] font-extrabold text-violet-700 uppercase tracking-tighter">Cortesía</span>
          )}
        </div>
      </td>

      <td className="whitespace-nowrap">
        {infoAliado ? (
          <div className="leading-tight" title={infoAliado.banco}>
            <p className="text-xs font-bold text-sky-800">{infoAliado.aliadoCodigo}</p>
            <p className="text-[10px] text-sky-700">{infoAliado.aliadoNombre}</p>
          </div>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      <td className="whitespace-nowrap">
        {infoAliado ? (
          <div className="leading-tight">
            <p className="text-xs font-bold text-sky-800 tabular-nums">{formatCOP(montoParticipacion)}</p>
            <p className="text-[10px] text-sky-600">{infoAliado.porcentaje}% de este mes · se paga después</p>
          </div>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      {/* Fecha vencimiento */}
      <td><CeldaFechaHora ts={cobro.fechaVencimiento} /></td>

      {/* Fecha de pago */}
      <td>{isPagado ? <CeldaFechaHora ts={cobro.fechaPago} /> : <span className="text-slate-400">—</span>}</td>

      {/* Estado */}
      <td>
        {isPagado ? (
          cobro.esCortesia ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-900 border border-violet-300">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Cortesía
            </span>
          ) : esPagoAnticipado(cobro) ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-900 border border-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Pagado antes
            </span>
          ) : conAdelanto ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-900 border border-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Pago con adelanto
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
  aliados: Aliado[];
  onPago: (cobro: CobroMensual, pagado: boolean) => void;
  onCortesia: (cobro: CobroMensual) => void;
  onEdit: (c: Cartera) => void;
  onDelete: (id: string) => void;
  onPagoAdelanto: (c: Cartera) => void;
  onEditarPago: (cobro: CobroMensual, cartera: Cartera) => void;
  onToggleActiva: (c: Cartera) => void;
  loadingId: string | null;
  vistaUnificada?: boolean;
};

function CobroTable({
  cobros, carteras, clientesMap, aliados,
  onPago, onCortesia, onEdit, onDelete, onPagoAdelanto, onEditarPago, onToggleActiva, loadingId,
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
              <th className="text-white w-10" />
              <th className="text-white w-28 text-center">Empresa</th>
              <th className="text-white w-10 text-center">Día</th>
              <th className="text-white">Cartera</th>
              <th className="text-white">País</th>
              <th className="text-white">Valor</th>
              <th className="text-white">Aliado</th>
              <th className="text-white">Participación</th>
              <th className="text-white">Vencimiento</th>
              <th className="text-white">Pagado el</th>
              <th className="text-white">Estado</th>
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
                        cliente={clientesMap.get(carteras.find(c => c.id === cobro.carteraId)?.clienteId || '') ?? clientesMap.get(cobro.clienteId)}
                        aliados={aliados}
                        onPago={onPago}
                        onCortesia={onCortesia}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onPagoAdelanto={onPagoAdelanto}
                        onEditarPago={onEditarPago}
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
  const { aliados } = useAliados();
  const { liquidaciones } = useLiquidacionesAliado();

  const mesPasado = esMesPasado(mesSel, anioSel);
  const usaProyeccionDinamica = esMesActual || esMesFuturo;
  const puedeGenerar = mesPasado;

  const [search, setSearch] = useState('');
  const [filtros, setFiltros] = useState<Record<FiltroCobro, boolean>>(FILTROS_VACIOS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCartera, setEditCartera] = useState<Cartera | null>(null);
  const [adelantoCartera, setAdelantoCartera] = useState<Cartera | null>(null);
  const [pagoEditar, setPagoEditar] = useState<{ cobro: CobroMensual; cartera: Cartera } | null>(null);
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

  const resumenCarteras = useMemo(() => {
    const porPais = new Map<string, number>();
    let creadasEsteMes = 0;

    for (const cartera of carteras) {
      const creada = cartera.fechaCreacion?.toDate?.();
      if (creada && creada.getMonth() + 1 === mesSel && creada.getFullYear() === anioSel) {
        creadasEsteMes += 1;
      }

      const cliente = clientesMap.get(cartera.clienteId);
      if (!cliente || !esCarteraActiva(cartera) || !esClienteActivo(cliente)) continue;
      const pais = cartera.pais?.trim() || cliente.pais?.trim() || 'Sin país';
      porPais.set(pais, (porPais.get(pais) ?? 0) + 1);
    }

    return {
      creadasEsteMes,
      porPais: [...porPais.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')),
    };
  }, [carteras, clientesMap, mesSel, anioSel]);

  const cobrosDelMes = useMemo(() => {
    const carterasVivas = carteras.filter(cartera => {
      const cliente = clientesMap.get(cartera.clienteId);
      return !!cliente && esCarteraActiva(cartera) && esClienteActivo(cliente);
    });
    const idsVivos = new Set(carterasVivas.map(c => c.id));
    const reales = cobros.filter(c => idsVivos.has(c.carteraId));
    return combinarCobrosConVirtuales(reales, carterasVivas, mesSel, anioSel);
  }, [cobros, carteras, clientesMap, mesSel, anioSel]);

  // Ordenar por fecha de vencimiento ASCENDENTE (más urgente primero)
  const cobrosOrdenados = useMemo(() => {
    return [...cobrosDelMes]
      .filter(c => cobroVisibleEnMes(c, carterasMap.get(c.carteraId), clientesMap.get(c.clienteId)))
      .filter(c => {
        if (!search.trim()) return true;
        const cliente = clientesMap.get(c.clienteId);
        const cartera = carterasMap.get(c.carteraId);
        const empresa = cliente?.empresa || '';
        const pais = cartera?.pais || cliente?.pais || '';
        return [c.clienteNombre, c.carteraNombre, empresa, pais].join(' ').toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const da = a.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
        const db = b.fechaVencimiento?.toDate?.()?.getTime() ?? 0;
        return da - db;
      });
  }, [cobrosDelMes, search, carterasMap, clientesMap]);

  const conteoFiltros = useMemo(() => {
    const conteo: Record<FiltroCobro, number> = {
      vencido: 0, 'al-dia': 0, pagado: 0, adelanto: 0, cortesia: 0, 'pagado-antes': 0,
    };
    for (const cobro of cobrosOrdenados) conteo[tipoFiltroCobro(cobro)] += 1;
    return conteo;
  }, [cobrosOrdenados]);

  const filtrosTodos = FILTROS_UI.every(f => !filtros[f.id]);
  const cobrosTabla = useMemo(
    () => filtrosTodos ? cobrosOrdenados : cobrosOrdenados.filter(c => filtros[tipoFiltroCobro(c)]),
    [cobrosOrdenados, filtros, filtrosTodos],
  );

  const pendientesTabla = useMemo(() => cobrosTabla.filter(c => c.estado !== 'Pagado'), [cobrosTabla]);
  const pagadosTabla = useMemo(() => cobrosTabla.filter(c => c.estado === 'Pagado'), [cobrosTabla]);
  const pagadosCajaTabla = useMemo(
    () => pagadosTabla.filter(c => !esPagoAnticipado(c) && !c.esCortesia),
    [pagadosTabla],
  );
  const pagadosAnticipadosTabla = useMemo(
    () => pagadosTabla.filter(c => esPagoAnticipado(c)),
    [pagadosTabla],
  );
  const pagadosCortesiaTabla = useMemo(
    () => pagadosTabla.filter(c => c.esCortesia),
    [pagadosTabla],
  );
  const toggleFiltro = (id: FiltroCobro) => {
    setFiltros(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const activarTodos = () => setFiltros(FILTROS_VACIOS);

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
  const comisionDentroDeCaja = useMemo(() => {
    const ids = new Set(pagadosCaja.map(c => c.id));
    return liquidaciones.reduce((s, l) => {
      if (!ids.has(l.cobroId) || l.mesCobro !== mesSel || l.anioCobro !== anioSel) return s;
      return s + l.montoParticipacion;
    }, 0);
  }, [pagadosCaja, liquidaciones, mesSel, anioSel]);
  const cajaSinAliados = Math.max(0, totalCaja - comisionDentroDeCaja);

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

  const participacionAliados = useMemo(() => {
    const porAliado = new Map<string, { codigo: string; nombre: string; total: number; cantidad: number }>();
    let total = 0;
    let cantidad = 0;
    for (const cobro of cobrosOrdenados) {
      if (cobro.esCortesia || esPagoAnticipado(cobro)) continue;
      const cliente = clientesMap.get(cobro.clienteId);
      const info = resumenParticipacion(cliente, aliados);
      if (!info || !cliente?.aliadoId) continue;
      const base = cobro.valorCobro;
      const monto = calcularParticipacion(base, info.porcentaje);
      if (monto <= 0) continue;
      total += monto;
      cantidad += 1;
      const prev = porAliado.get(cliente.aliadoId) ?? {
        codigo: info.aliadoCodigo,
        nombre: info.aliadoNombre,
        total: 0,
        cantidad: 0,
      };
      prev.total += monto;
      prev.cantidad += 1;
      porAliado.set(cliente.aliadoId, prev);
    }
    return { total, cantidad, detalle: [...porAliado.values()] };
  }, [cobrosOrdenados, clientesMap, aliados]);

  const facturadoAliados = useMemo(() => {
    const porAliado = new Map<string, { codigo: string; nombre: string; total: number; cantidad: number }>();
    let total = 0;
    let cantidad = 0;
    for (const l of liquidaciones) {
      if (l.mesCobro !== mesSel || l.anioCobro !== anioSel) continue;
      total += l.montoParticipacion;
      cantidad += 1;
      const prev = porAliado.get(l.aliadoId) ?? {
        codigo: l.aliadoCodigo,
        nombre: l.aliadoNombre,
        total: 0,
        cantidad: 0,
      };
      prev.total += l.montoParticipacion;
      prev.cantidad += 1;
      porAliado.set(l.aliadoId, prev);
    }
    return { total, cantidad, detalle: [...porAliado.values()] };
  }, [liquidaciones, mesSel, anioSel]);

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
  const handleEditarPago = (cobro: CobroMensual, cartera: Cartera) => setPagoEditar({ cobro, cartera });

  const handleToggleActiva = (cartera: Cartera) => {
    const activa = esCarteraActiva(cartera);
    setConfirmConfig({
      isOpen: true,
      title: activa ? '¿Desactivar cartera?' : '¿Reactivar cartera?',
      message: activa
        ? `"${cartera.nombre}" dejará de aparecer en cobros futuros. El historial de meses anteriores se conserva.`
        : `"${cartera.nombre}" vuelve a contar desde hoy. Los meses en que estuvo apagada no se cobran.`,
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
            Los que no pagaron siguen como deuda. Puedes registrar el pago atrasado.
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
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1.15fr_0.8fr] gap-2">
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
                {formatCOP(totalGen)}
                {' − '}
                <span className={totalCortesiaNominal > 0 ? 'text-violet-700 font-semibold line-through decoration-violet-400/70' : ''}>
                  {formatCOP(totalCortesiaNominal)}
                </span>
                {' − '}
                <span className={totalAnticipadoNominal > 0 ? 'text-sky-700 font-semibold line-through decoration-sky-400/70' : ''}>
                  {formatCOP(totalAnticipadoNominal)}
                </span>
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
            <div className="min-w-0 pl-2 space-y-2">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-tight">En caja</p>
                <p className="text-base font-bold text-sky-700 tabular-nums mt-1">{formatCOP(totalCaja)}</p>
                <p className="text-[10px] text-slate-400 mt-1 tabular-nums leading-snug">
                  {formatCOP(totalPag)} + {formatCOP(totalAdelantadoRecibido)}
                </p>
              </div>
              <div className="border-t border-emerald-100 pt-2">
                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider leading-tight">En caja − aliados</p>
                <p className="text-base font-bold text-emerald-700 tabular-nums mt-1">{formatCOP(cajaSinAliados)}</p>
                <p className="text-[10px] text-slate-400 mt-1 tabular-nums leading-snug">
                  {formatCOP(totalCaja)} − {formatCOP(comisionDentroDeCaja)} · solo este mes
                </p>
              </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-sky-100 p-3 shadow-sm grid grid-cols-2 divide-x divide-sky-100 gap-2">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] text-sky-700 font-bold uppercase tracking-wider leading-tight">A cobrar aliados</p>
              <p className="text-base font-bold text-sky-800 tabular-nums mt-1">{formatCOP(participacionAliados.total)}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {participacionAliados.cantidad} cartera{participacionAliados.cantidad !== 1 ? 's' : ''} · {participacionAliados.detalle.length} aliado{participacionAliados.detalle.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="min-w-0 pl-2">
              <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider leading-tight">Facturado aliados</p>
              <p className="text-base font-bold text-indigo-800 tabular-nums mt-1">{formatCOP(facturadoAliados.total)}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {facturadoAliados.cantidad} pago{facturadoAliados.cantidad !== 1 ? 's' : ''} · {facturadoAliados.detalle.length} aliado{facturadoAliados.detalle.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
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

          <div className={`rounded-xl border p-3 ${pagadosAnticipados.length > 0 ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${pagadosAnticipados.length > 0 ? 'text-sky-700' : 'text-slate-500'}`}>Pagados antes</p>
            <p className={`text-base font-bold tabular-nums mt-1 ${pagadosAnticipados.length > 0 ? 'text-sky-800 line-through decoration-sky-400/70' : 'text-slate-500'}`}>
              {formatCOP(totalAnticipadoNominal)}
            </p>
            <p className={`text-[10px] mt-1 ${pagadosAnticipados.length > 0 ? 'text-sky-600/90' : 'text-slate-400'}`}>
              {pagadosAnticipados.length} cobro{pagadosAnticipados.length !== 1 ? 's' : ''} · pagaron en otro mes
            </p>
            <p className="text-[10px] text-slate-400">Sin caja en este mes</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="bg-white rounded-xl border border-indigo-200 px-3 py-2 shadow-sm min-w-[8.5rem]">
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider leading-tight">
            Activas en {MESES[mesSel - 1]}
          </p>
          <p className="text-base font-bold text-indigo-800 tabular-nums mt-0.5">{resumenCarteras.creadasEsteMes}</p>
          <p className="text-[10px] text-slate-400">carteras creadas en {anioSel}</p>
        </div>
        {resumenCarteras.porPais.map(([pais, cantidad]) => (
          <div key={pais} className="bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm min-w-[7rem]">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-tight flex items-center gap-1">
              <Globe size={10} className="text-slate-400 shrink-0" />
              <span className="truncate">{pais}</span>
            </p>
            <p className="text-base font-bold text-slate-800 tabular-nums mt-0.5">{cantidad}</p>
            <p className="text-[10px] text-slate-400">cartera{cantidad !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Buscador + tabs de vista */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cartera, cliente, empresa o país..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition" />
        </div>

        <div className="flex flex-col gap-3">
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

          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1.5 mr-1">
                <Filter size={11} /> Filtros
              </p>
              <label className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold cursor-pointer select-none ${
                filtrosTodos ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={filtrosTodos}
                  onChange={activarTodos}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                />
                Todos
                <span className="tabular-nums text-[10px] text-slate-400">{cobrosOrdenados.length}</span>
              </label>
              {FILTROS_UI.map(f => (
                <label
                  key={f.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold cursor-pointer select-none transition ${
                    filtros[f.id]
                      ? 'bg-white border-slate-300 text-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filtros[f.id]}
                    onChange={() => toggleFiltro(f.id)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                  />
                  <span className={`w-3 h-3 rounded border ${f.swatch}`} />
                  {f.swatch2 && <span className={`w-3 h-3 rounded border ${f.swatch2}`} />}
                  {f.label}
                  <span className="tabular-nums text-[10px] text-slate-400">{conteoFiltros[f.id]}</span>
                </label>
              ))}
            </div>
          </div>
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
        ) : cobrosTabla.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400 text-sm">
            Ningún cobro con esos filtros.
            <button type="button" onClick={activarTodos} className="ml-2 text-indigo-600 font-semibold hover:text-indigo-800">
              Ver todos
            </button>
          </div>
        ) : (
          <CobroTable
            cobros={cobrosTabla}
            carteras={carteras}
            clientesMap={clientesMap}
            aliados={aliados}
            onPago={handlePago}
            onCortesia={handleCortesia}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPagoAdelanto={handlePagoAdelanto}
            onEditarPago={handleEditarPago}
            onToggleActiva={handleToggleActiva}
            loadingId={loadingId}
            vistaUnificada
          />
        )
      ) : (
        <div className="space-y-3">
          {/* Pendientes */}
          {pendientesTabla.length > 0 && (
            <div className="space-y-2">
              <SectionHeader label="⚡ Pendientes de cobro" count={pendientesTabla.length}
                total={formatCOP(pendientesTabla.reduce((s, c) => s + c.valorCobro, 0))} color="rose"
                collapsed={colPend} onToggle={() => setColPend(v => !v)} />
              {!colPend && (
                <CobroTable cobros={pendientesTabla} carteras={carteras} clientesMap={clientesMap} aliados={aliados}
                  onPago={handlePago} onCortesia={handleCortesia} onEdit={handleEdit} onDelete={handleDelete}
                  onPagoAdelanto={handlePagoAdelanto} onEditarPago={handleEditarPago} onToggleActiva={handleToggleActiva} loadingId={loadingId} />
              )}
            </div>
          )}

          {/* Pagados */}
          {pagadosCajaTabla.length > 0 && (
            <div className="space-y-2">
              <SectionHeader label="✓ Cobrado en caja" count={pagadosCajaTabla.length}
                total={formatCOP(pagadosCajaTabla.reduce((s, c) => s + c.valorCobro + (c.montoAdelantado || 0), 0))} color="emerald"
                collapsed={colPag} onToggle={() => setColPag(v => !v)} />
              {!colPag && (
                <CobroTable cobros={pagadosCajaTabla} carteras={carteras} clientesMap={clientesMap} aliados={aliados}
                  onPago={handlePago} onCortesia={handleCortesia} onEdit={handleEdit} onDelete={handleDelete}
                  onPagoAdelanto={handlePagoAdelanto} onEditarPago={handleEditarPago} onToggleActiva={handleToggleActiva} loadingId={loadingId} />
              )}
            </div>
          )}

          {pagadosCortesiaTabla.length > 0 && (
            <div className="space-y-2">
              <SectionHeader label="Cortesías" count={pagadosCortesiaTabla.length}
                total={formatCOP(pagadosCortesiaTabla.reduce((s, c) => s + c.valorCobro, 0))} color="rose"
                collapsed={colPag} onToggle={() => setColPag(v => !v)} />
              {!colPag && (
                <CobroTable cobros={pagadosCortesiaTabla} carteras={carteras} clientesMap={clientesMap} aliados={aliados}
                  onPago={handlePago} onCortesia={handleCortesia} onEdit={handleEdit} onDelete={handleDelete}
                  onPagoAdelanto={handlePagoAdelanto} onEditarPago={handleEditarPago} onToggleActiva={handleToggleActiva} loadingId={loadingId} />
              )}
            </div>
          )}

          {pagadosAnticipadosTabla.length > 0 && (
            <div className="space-y-2">
              <SectionHeader label="⏩ Pagados antes (no suman a caja)" count={pagadosAnticipadosTabla.length}
                total={formatCOP(0)} color="rose"
                collapsed={colPag} onToggle={() => setColPag(v => !v)} />
              {!colPag && (
                <CobroTable cobros={pagadosAnticipadosTabla} carteras={carteras} clientesMap={clientesMap} aliados={aliados}
                  onPago={handlePago} onCortesia={handleCortesia} onEdit={handleEdit} onDelete={handleDelete}
                  onPagoAdelanto={handlePagoAdelanto} onEditarPago={handleEditarPago} onToggleActiva={handleToggleActiva} loadingId={loadingId} />
              )}
            </div>
          )}

          {cobrosOrdenados.length === 0 && search && (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400 text-sm">
              Sin resultados para "<strong>{search}</strong>"
            </div>
          )}
          {cobrosOrdenados.length > 0 && cobrosTabla.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400 text-sm">
              Ningún cobro con esos filtros.
              <button type="button" onClick={activarTodos} className="ml-2 text-indigo-600 font-semibold hover:text-indigo-800">
                Ver todos
              </button>
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

      <Modal isOpen={!!pagoEditar} onClose={() => setPagoEditar(null)}
        title="Editar pago" size="md">
        {pagoEditar && (
          <PagoAdelantoModal
            cartera={pagoEditar.cartera}
            cobro={pagoEditar.cobro}
            mesActual={pagoEditar.cobro.mes}
            anioActual={pagoEditar.cobro.anio}
            onClose={() => setPagoEditar(null)}
          />
        )}
      </Modal>

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
