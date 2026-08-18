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
} from 'lucide-react';
import { useAllCobros } from '../../hooks/useAllCobros';
import { useCarteras } from '../../hooks/useCarteras';
import LoadingSpinner from '../ui/LoadingSpinner';
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
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
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

function FilaResumen({ resumen }: { resumen: ResumenMensual }) {
  const sinDatos = resumen.cantidadCobros === 0;
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
        </div>
      </td>
      <td className="font-semibold text-slate-700">{formatCOP(resumen.totalEsperado)}</td>
      <td>
        <p className="font-bold text-emerald-600">{formatCOP(resumen.totalCaja)}</p>
        {!sinDatos && (
          <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${resumen.pctRecaudo}%` }} />
          </div>
        )}
      </td>
      <td className="font-semibold text-rose-500">{formatCOP(resumen.totalPorCobrar)}</td>
      <td className="text-slate-600">{resumen.pctRecaudo}%</td>
      <td>
        <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
          {resumen.cantidadPagados}/{resumen.cantidadCobros}
        </span>
      </td>
    </tr>
  );
}

export default function ResumenAnualPanel() {
  const { mes: mesActual, anio: anioActual } = getMesAnioActual();
  const { cobros, loading: loadingCobros } = useAllCobros();
  const { carteras, loading: loadingCarteras } = useCarteras();

  const aniosDisponibles = useMemo(() => obtenerAniosDisponibles(cobros), [cobros]);
  const [anioFiltro, setAnioFiltro] = useState<number>(anioActual);

  const resumenes = useMemo(
    () => buildResumenesAnio(anioFiltro, cobros, carteras),
    [anioFiltro, cobros, carteras]
  );

  const resumenesVisibles = useMemo(() => [...resumenes].reverse(), [resumenes]);
  const totales = useMemo(() => sumarTotales(resumenes), [resumenes]);
  const totalesGenerales = useMemo(
    () => sumarTotales(buildResumenesHistoricos(cobros, carteras)),
    [cobros, carteras]
  );

  const resumenMesActual = useMemo(
    () => resumenes.find(r => r.mes === mesActual && r.anio === anioActual),
    [resumenes, mesActual, anioActual]
  );

  if (loadingCobros || loadingCarteras) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Resumen anual</h3>
          <p className="text-slate-500 text-sm">Ganancia, lo esperado y lo pendiente — calculado por fechas.</p>
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

      <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
        <span><strong className="text-slate-800">Histórico total:</strong> {formatCOP(totalesGenerales.totalCaja)} en caja</span>
        <span>Esperado acumulado: {formatCOP(totalesGenerales.totalEsperado)}</span>
        <span>Pendiente acumulado: {formatCOP(totalesGenerales.totalPorCobrar)}</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <History size={16} className="text-slate-500" />
          <h4 className="font-semibold text-slate-800 text-sm">Mes a mes — {anioFiltro}</h4>
          <span className="text-xs text-slate-400 ml-auto">Enero → Diciembre</span>
        </div>

        {resumenesVisibles.every(r => r.cantidadCobros === 0) ? (
          <div className="py-12 text-center">
            <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">Sin datos para {anioFiltro}.</p>
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
                  <FilaResumen key={r.id} resumen={r} />
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
    </div>
  );
}
