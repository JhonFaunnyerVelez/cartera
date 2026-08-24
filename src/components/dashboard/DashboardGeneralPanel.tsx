import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, DollarSign, Filter, History, Clock,
  CalendarDays, ArrowRight,
} from 'lucide-react';
import { useAllCobros } from '../../hooks/useAllCobros';
import { useCarteras } from '../../hooks/useCarteras';
import { useCajaManual } from '../../hooks/useCajaManual';
import { useInversiones } from '../../hooks/useInversiones';
import { useAllMovimientosInversiones } from '../../hooks/useMovimientosInversion';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  buildResumenGeneralAnio,
  calcularTotalesGeneral,
  calcularTotalesGeneralHistoricos,
  obtenerAniosDisponiblesGeneral,
} from '../../utils/resumenGeneral';
import { getMesAnioActual } from '../../utils/activo';
import { getInversionTheme } from '../../utils/inversionTheme';
import { getInversionIcon } from '../../utils/inversionIcons';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

function KpiCard({
  label, value, sub, iconBg, iconColor, icon: Icon, highlight, href,
}: {
  label: string;
  value: string;
  sub?: string;
  iconBg: string;
  iconColor: string;
  icon: typeof DollarSign;
  highlight?: boolean;
  href?: string;
}) {
  const content = (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 shadow-sm h-full transition ${
      highlight ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 hover:border-slate-200'
    } ${href ? 'hover:shadow-md' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        highlight ? 'bg-white/20' : iconBg
      }`}>
        <Icon size={18} className={highlight ? 'text-white' : iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-white/80' : 'text-slate-500'}`}>
          {label}
        </p>
        <p className={`text-lg font-bold truncate ${highlight ? 'text-white' : 'text-slate-800'}`}>{value}</p>
        {sub && <p className={`text-[10px] mt-0.5 ${highlight ? 'text-white/80' : 'text-slate-400'}`}>{sub}</p>}
      </div>
      {href && !highlight && (
        <ArrowRight size={14} className="text-slate-300 shrink-0" />
      )}
    </div>
  );

  if (href) {
    return <Link to={href} className="block">{content}</Link>;
  }
  return content;
}

export default function DashboardGeneralPanel() {
  const { mes: mesActual, anio: anioActual } = getMesAnioActual();
  const { cobros, loading: lCobros } = useAllCobros();
  const { carteras, loading: lCarteras } = useCarteras();
  const { mapa: cajaManual, loading: lCaja } = useCajaManual();
  const { activas: inversiones, loading: lInv } = useInversiones();
  const { movimientos, loading: lMov } = useAllMovimientosInversiones();

  const aniosDisponibles = useMemo(
    () => obtenerAniosDisponiblesGeneral(cobros, movimientos, cajaManual),
    [cobros, movimientos, cajaManual]
  );
  const [anioFiltro, setAnioFiltro] = useState(anioActual);

  const resumenes = useMemo(
    () => buildResumenGeneralAnio(anioFiltro, cobros, carteras, inversiones, movimientos, cajaManual),
    [anioFiltro, cobros, carteras, inversiones, movimientos, cajaManual]
  );
  const resumenesVisibles = useMemo(() => [...resumenes].reverse(), [resumenes]);
  const totalesAnio = useMemo(() => calcularTotalesGeneral(resumenes), [resumenes]);
  const totalesHistoricos = useMemo(
    () => calcularTotalesGeneralHistoricos(cobros, carteras, inversiones, movimientos, cajaManual),
    [cobros, carteras, inversiones, movimientos, cajaManual]
  );
  const resumenMesActual = useMemo(
    () => resumenes.find(r => r.mes === mesActual && r.anio === anioActual),
    [resumenes, mesActual, anioActual]
  );

  if (lCobros || lCarteras || lCaja || lInv || lMov) return <LoadingSpinner />;

  const kpiCols = 2 + inversiones.length;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Histórico acumulado</h3>
          <p className="text-slate-500 text-sm">Total de ganancias de todas las fuentes, sin filtro de año.</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 shadow-lg shadow-indigo-200 text-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1">Total general</p>
          <p className="text-3xl font-bold mb-4">{formatCOP(totalesHistoricos.totalGeneral)}</p>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${inversiones.length > 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-indigo-200 uppercase">CartéraApp</p>
              <p className="text-lg font-bold">{formatCOP(totalesHistoricos.gananciaCartera)}</p>
            </div>
            {inversiones.map(inv => {
              const theme = getInversionTheme(inv.color);
              return (
                <div key={inv.id} className="bg-white/10 rounded-xl px-4 py-3">
                  <p className={`text-[10px] font-semibold ${theme.textMuted} uppercase`}>{inv.nombre}</p>
                  <p className="text-lg font-bold">{formatCOP(totalesHistoricos.gananciasInversion[inv.id] || 0)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Resumen consolidado</h3>
            <p className="text-slate-500 text-sm">
              CartéraApp{inversiones.length > 0 ? ` + ${inversiones.length} inversión${inversiones.length !== 1 ? 'es' : ''}` : ''} — filtra por año.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <label htmlFor="anio-general" className="text-xs font-semibold text-slate-500">Año</label>
            <select
              id="anio-general"
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

        <div className={`grid grid-cols-2 gap-4 ${kpiCols <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-4'}`}>
          <KpiCard
            label={`CartéraApp ${anioFiltro}`}
            value={formatCOP(totalesAnio.gananciaCartera)}
            sub="Recaudo en caja"
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            icon={Briefcase}
            href="/carteras"
          />
          {inversiones.map(inv => {
            const theme = getInversionTheme(inv.color);
            const Icon = getInversionIcon(inv.icon);
            return (
              <KpiCard
                key={inv.id}
                label={`${inv.nombre} ${anioFiltro}`}
                value={formatCOP(totalesAnio.gananciasInversion[inv.id] || 0)}
                sub={inv.labels.balanceNeto}
                iconBg={theme.iconBg}
                iconColor={theme.iconColor}
                icon={Icon}
                href={`/inversiones/${inv.slug}`}
              />
            );
          })}
          <KpiCard
            label={`Total ${anioFiltro}`}
            value={formatCOP(totalesAnio.totalGeneral)}
            sub={`${totalesAnio.mesesConDatos} meses con ingresos`}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            icon={DollarSign}
            highlight
          />
        </div>

        {resumenMesActual && anioFiltro === anioActual && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              <Clock size={16} className="text-indigo-500" />
              <span className="font-semibold text-slate-800 text-sm">
                Mes en curso — {MESES[mesActual - 1]} {anioActual}
              </span>
            </div>
            <div className={`grid grid-cols-2 divide-x divide-y lg:divide-y-0 divide-slate-100 ${kpiCols <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-4'}`}>
              <div className="p-4 text-center">
                <Briefcase size={18} className="mx-auto mb-1.5 text-indigo-600" />
                <p className="text-base font-bold text-indigo-600">{formatCOP(resumenMesActual.gananciaCartera)}</p>
                <p className="text-slate-500 text-xs mt-0.5">CartéraApp</p>
              </div>
              {inversiones.map(inv => {
                const theme = getInversionTheme(inv.color);
                const Icon = getInversionIcon(inv.icon);
                return (
                  <div key={inv.id} className="p-4 text-center">
                    <Icon size={18} className={`mx-auto mb-1.5 ${theme.text}`} />
                    <p className={`text-base font-bold ${theme.text}`}>
                      {formatCOP(resumenMesActual.gananciasInversion[inv.id] || 0)}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5 truncate px-1">{inv.nombre}</p>
                  </div>
                );
              })}
              <div className="p-4 text-center">
                <DollarSign size={18} className="mx-auto mb-1.5 text-emerald-600" />
                <p className="text-base font-bold text-emerald-600">{formatCOP(resumenMesActual.totalGeneral)}</p>
                <p className="text-slate-500 text-xs mt-0.5">Total mes</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <History size={16} className="text-slate-500" />
            <h4 className="font-semibold text-slate-800 text-sm">Mes a mes — {anioFiltro}</h4>
            <span className="text-xs text-slate-400 ml-auto hidden sm:inline">Todas las fuentes</span>
          </div>

          {resumenesVisibles.every(r => r.totalGeneral === 0) ? (
            <div className="py-12 text-center">
              <CalendarDays size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">Sin ganancias registradas para {anioFiltro}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-left">
                    <th className="text-slate-500">Mes</th>
                    <th className="text-slate-500">CartéraApp</th>
                    {inversiones.map(inv => (
                      <th key={inv.id} className="text-slate-500">{inv.nombre}</th>
                    ))}
                    <th className="text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resumenesVisibles.map(r => {
                    const sinDatos = r.totalGeneral === 0;
                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50/70 transition ${r.esMesActual ? 'bg-indigo-50/60' : ''} ${sinDatos ? 'opacity-50' : ''}`}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">{MESES[r.mes - 1]}</p>
                            {r.esMesActual && (
                              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full uppercase">
                                Actual
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="font-semibold text-indigo-600">{formatCOP(r.gananciaCartera)}</td>
                        {inversiones.map(inv => {
                          const theme = getInversionTheme(inv.color);
                          return (
                            <td key={inv.id} className={`font-semibold ${theme.text}`}>
                              {formatCOP(r.gananciasInversion[inv.id] || 0)}
                            </td>
                          );
                        })}
                        <td className="font-bold text-emerald-700">{formatCOP(r.totalGeneral)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-sm">
                    <td className="text-slate-700">Total {anioFiltro}</td>
                    <td className="text-indigo-700">{formatCOP(totalesAnio.gananciaCartera)}</td>
                    {inversiones.map(inv => {
                      const theme = getInversionTheme(inv.color);
                      return (
                        <td key={inv.id} className={theme.textDark}>
                          {formatCOP(totalesAnio.gananciasInversion[inv.id] || 0)}
                        </td>
                      );
                    })}
                    <td className="text-emerald-700">{formatCOP(totalesAnio.totalGeneral)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
