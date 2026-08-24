import { useMemo, useState } from 'react';
import {
  Calendar,
  TrendingUp,
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  History,
  DollarSign,
  Filter,
  Pencil,
} from 'lucide-react';
import { useAllCobros } from '../../hooks/useAllCobros';
import { useCarteras } from '../../hooks/useCarteras';
import { useCajaManual } from '../../hooks/useCajaManual';
import LoadingSpinner from '../ui/LoadingSpinner';
import Modal from '../ui/Modal';
import {
  buildResumenesAnio,
  buildResumenesHistoricos,
  obtenerAniosDisponibles,
  sumarTotales,
  type ResumenMensual,
} from '../../utils/resumenMensual';
import { getMesAnioActual } from '../../utils/activo';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function KpiCard({
  label, value, sub, iconBg, iconColor, icon: Icon, highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  iconBg: string;
  iconColor: string;
  icon: typeof TrendingUp;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 shadow-sm ${
      highlight ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        highlight ? 'bg-white/20' : iconBg
      }`}>
        <Icon size={18} className={highlight ? 'text-white' : iconColor} />
      </div>
      <div className="min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-white/80' : 'text-slate-500'}`}>
          {label}
        </p>
        <p className={`text-lg font-bold truncate ${highlight ? 'text-white' : 'text-slate-800'}`}>{value}</p>
        {sub && <p className={`text-[10px] mt-0.5 ${highlight ? 'text-white/80' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </div>
  );
}

function FilaResumen({
  resumen,
  onEditCaja,
}: {
  resumen: ResumenMensual;
  onEditCaja?: (resumen: ResumenMensual) => void;
}) {
  const sinDatos = resumen.cantidadCobros === 0 && !resumen.esCajaManual;
  const puedeEditarCaja = resumen.esMesPasado && resumen.cantidadCobros === 0;
  const rowCls = resumen.esMesActual
    ? 'bg-indigo-50/60'
    : resumen.esMesFuturo
    ? 'bg-purple-50/40'
    : '';

  return (
    <tr className={`hover:bg-slate-50/70 transition ${rowCls} ${sinDatos ? 'opacity-50' : ''}`}>
      <td>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800">{MESES[resumen.mes - 1]}</p>
          {resumen.esMesActual && (
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full uppercase">
              Actual
            </span>
          )}
          {resumen.esMesFuturo && (
            <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full uppercase">
              Proyección
            </span>
          )}
          {resumen.esCajaManual && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase">
              Manual
            </span>
          )}
        </div>
      </td>
      <td className="font-semibold text-slate-700">{formatCOP(resumen.totalEsperado)}</td>
      <td>
        <div className="flex items-center gap-2">
          <div>
            <p className="font-bold text-emerald-600">{formatCOP(resumen.totalCaja)}</p>
            {resumen.cantidadCobros > 0 && (
              <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${resumen.pctRecaudo}%` }} />
              </div>
            )}
          </div>
          {puedeEditarCaja && onEditCaja && (
            <button
              type="button"
              onClick={() => onEditCaja(resumen)}
              title="Registrar caja manual"
              className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 ring-1 ring-indigo-200 flex items-center justify-center transition shrink-0"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </td>
      <td className="font-semibold text-rose-500">{formatCOP(resumen.totalPorCobrar)}</td>
      <td className="text-slate-600">{resumen.pctRecaudo}%</td>
      <td>
        <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
          {resumen.esCajaManual ? '—' : `${resumen.cantidadPagados}/${resumen.cantidadCobros}`}
        </span>
      </td>
    </tr>
  );
}

export default function ResumenAnualPanel() {
  const { mes: mesActual, anio: anioActual } = getMesAnioActual();
  const { cobros, loading: loadingCobros } = useAllCobros();
  const { carteras, loading: loadingCarteras } = useCarteras();
  const { mapa: cajaManual, loading: loadingCaja, guardarCaja, eliminarCaja } = useCajaManual();

  const aniosDisponibles = useMemo(
    () => obtenerAniosDisponibles(cobros, cajaManual),
    [cobros, cajaManual]
  );
  const [anioFiltro, setAnioFiltro] = useState<number>(anioActual);
  const [editResumen, setEditResumen] = useState<ResumenMensual | null>(null);
  const [montoCaja, setMontoCaja] = useState('');
  const [guardando, setGuardando] = useState(false);

  const resumenes = useMemo(
    () => buildResumenesAnio(anioFiltro, cobros, carteras, cajaManual),
    [anioFiltro, cobros, carteras, cajaManual]
  );

  const resumenesVisibles = useMemo(() => [...resumenes].reverse(), [resumenes]);
  const totales = useMemo(() => sumarTotales(resumenes), [resumenes]);
  const totalesGenerales = useMemo(
    () => sumarTotales(buildResumenesHistoricos(cobros, carteras, cajaManual)),
    [cobros, carteras, cajaManual]
  );

  const resumenMesActual = useMemo(
    () => resumenes.find(r => r.mes === mesActual && r.anio === anioActual),
    [resumenes, mesActual, anioActual]
  );

  const abrirEditCaja = (resumen: ResumenMensual) => {
    setEditResumen(resumen);
    setMontoCaja(resumen.totalCaja > 0 ? String(resumen.totalCaja) : '');
  };

  const handleGuardarCaja = async () => {
    if (!editResumen) return;
    const monto = Number(montoCaja);
    if (!montoCaja || isNaN(monto) || monto <= 0) return;

    setGuardando(true);
    try {
      await guardarCaja(editResumen.mes, editResumen.anio, monto);
      setEditResumen(null);
      setMontoCaja('');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarCaja = async () => {
    if (!editResumen) return;
    setGuardando(true);
    try {
      await eliminarCaja(editResumen.mes, editResumen.anio);
      setEditResumen(null);
      setMontoCaja('');
    } finally {
      setGuardando(false);
    }
  };

  if (loadingCobros || loadingCarteras || loadingCaja) return <LoadingSpinner />;

  const hayDatosAnio = resumenesVisibles.some(r => r.cantidadCobros > 0 || r.esCajaManual);

  return (
    <div className="space-y-8">
      {/* Histórico acumulado */}
      <section className="space-y-3">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Histórico acumulado</h3>
          <p className="text-slate-500 text-sm">Total recaudado en caja — incluye meses registrados a mano.</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 shadow-lg shadow-indigo-200 text-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1">Total en caja</p>
          <p className="text-3xl font-bold mb-4">{formatCOP(totalesGenerales.totalCaja)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-indigo-200 uppercase">Esperado</p>
              <p className="text-lg font-bold">{formatCOP(totalesGenerales.totalEsperado)}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-indigo-200 uppercase">Por cobrar</p>
              <p className="text-lg font-bold">{formatCOP(totalesGenerales.totalPorCobrar)}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-indigo-200 uppercase">Pagos en caja</p>
              <p className="text-lg font-bold">{totalesGenerales.cantidadPagados}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Resumen anual */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Resumen anual</h3>
            <p className="text-slate-500 text-sm">
              Ganancia, lo esperado y lo pendiente — filtra por año.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <label htmlFor="anio-dashboard" className="text-xs font-semibold text-slate-500">Año</label>
            <select
              id="anio-dashboard"
              value={anioFiltro}
              onChange={e => setAnioFiltro(Number(e.target.value))}
              className="text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              {aniosDisponibles.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={`Ganancia ${anioFiltro}`}
            value={formatCOP(totales.totalCaja)}
            sub={`${totales.mesesConDatos} meses con movimiento`}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            icon={DollarSign}
            highlight
          />
          <KpiCard
            label="Total esperado"
            value={formatCOP(totales.totalEsperado)}
            sub={`Año ${anioFiltro}`}
            iconBg="bg-slate-100"
            iconColor="text-slate-700"
            icon={Briefcase}
          />
          <KpiCard
            label="Por cobrar"
            value={formatCOP(totales.totalPorCobrar)}
            sub={`${totales.cantidadPendientes} pendientes`}
            iconBg="bg-rose-50"
            iconColor="text-rose-600"
            icon={AlertCircle}
          />
          <KpiCard
            label="% recaudo"
            value={`${totales.pctRecaudo}%`}
            sub={`${totales.cantidadPagados} pagos en caja`}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            icon={TrendingUp}
          />
        </div>

        {resumenMesActual && anioFiltro === anioActual && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              <Clock size={16} className="text-indigo-500" />
              <span className="font-semibold text-slate-800 text-sm">
                Mes en curso — {MESES[mesActual - 1]} {anioActual}
              </span>
              <span className="ml-auto text-xs text-indigo-600">Actualizado al registrar pagos</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
              {[
                { label: 'Debían pagar', value: formatCOP(resumenMesActual.totalEsperado), color: 'text-slate-700', icon: Briefcase },
                { label: 'En caja', value: formatCOP(resumenMesActual.totalCaja), color: 'text-emerald-600', icon: TrendingUp },
                { label: 'Por cobrar', value: formatCOP(resumenMesActual.totalPorCobrar), color: 'text-rose-600', icon: AlertCircle },
                { label: 'Recaudo', value: `${resumenMesActual.pctRecaudo}%`, color: 'text-indigo-600', icon: CheckCircle2 },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="p-4 text-center">
                  <Icon size={18} className={`mx-auto mb-1.5 ${color}`} />
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <History size={16} className="text-slate-500" />
            <h4 className="font-semibold text-slate-800 text-sm">Mes a mes — {anioFiltro}</h4>
            <span className="text-xs text-slate-400 ml-auto">
              Usa el lápiz en meses pasados para registrar caja manual
            </span>
          </div>

          {!hayDatosAnio ? (
            <div className="py-12 text-center">
              <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">Sin datos para {anioFiltro}.</p>
              <p className="text-slate-400 text-xs mt-1">Registra la caja manual en meses anteriores con el lápiz.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-left">
                    <th className="text-slate-500">Mes</th>
                    <th className="text-slate-500">Debían pagar</th>
                    <th className="text-slate-500">En caja</th>
                    <th className="text-slate-500">Por cobrar</th>
                    <th className="text-slate-500">% recaudo</th>
                    <th className="text-slate-500">Pagados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resumenesVisibles.map(r => (
                    <FilaResumen key={r.id} resumen={r} onEditCaja={abrirEditCaja} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-sm">
                    <td className="text-slate-700">Total {anioFiltro}</td>
                    <td className="text-slate-800">{formatCOP(totales.totalEsperado)}</td>
                    <td className="text-emerald-700">{formatCOP(totales.totalCaja)}</td>
                    <td className="text-rose-600">{formatCOP(totales.totalPorCobrar)}</td>
                    <td className="text-indigo-700">{totales.pctRecaudo}%</td>
                    <td className="text-slate-600">{totales.cantidadPagados}/{totales.cantidadCobros}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>

      <Modal
        isOpen={!!editResumen}
        onClose={() => { setEditResumen(null); setMontoCaja(''); }}
        title={editResumen ? `Caja manual — ${MESES[editResumen.mes - 1]} ${editResumen.anio}` : ''}
        size="sm"
      >
        {editResumen && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Registra cuánto entró en caja ese mes antes de usar la app.
            </p>
            <div>
              <label htmlFor="monto-caja" className="block text-xs font-semibold text-slate-500 mb-1">
                Monto en caja (COP)
              </label>
              <input
                id="monto-caja"
                type="number"
                min="1"
                value={montoCaja}
                onChange={e => setMontoCaja(e.target.value)}
                placeholder="Ej. 3500000"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex gap-2 pt-1">
              {editResumen.esCajaManual && (
                <button
                  type="button"
                  onClick={handleEliminarCaja}
                  disabled={guardando}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition disabled:opacity-60"
                >
                  Quitar
                </button>
              )}
              <button
                type="button"
                onClick={() => { setEditResumen(null); setMontoCaja(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarCaja}
                disabled={guardando}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
