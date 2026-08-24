import { useState, useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CalendarDays, Plus, Pencil, Trash2,
  TrendingUp, TrendingDown, DollarSign, Clock, Filter, History,
  ArrowDownCircle, ArrowUpCircle, Search,
} from 'lucide-react';
import { useInversiones } from '../hooks/useInversiones';
import { useMovimientosInversion, useAllMovimientosInversion } from '../hooks/useMovimientosInversion';
import type { InversionConfig, MovimientoInversion, TipoMovimientoInversion } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import MovimientoInversionForm from '../components/inversion/MovimientoInversionForm';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getInversionTheme } from '../utils/inversionTheme';
import {
  buildResumenesInversionAnio,
  buildResumenesInversionHistoricos,
  calcularResumenInversionMes,
  obtenerAniosDisponiblesInversion,
  sumarTotalesInversion,
} from '../utils/resumenInversion';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

function formatFecha(ts: MovimientoInversion['fecha']) {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function TablaMovimientos({
  items, tipo, onEdit, onDelete, loadingId,
}: {
  items: MovimientoInversion[];
  tipo: TipoMovimientoInversion;
  onEdit: (m: MovimientoInversion) => void;
  onDelete: (m: MovimientoInversion) => void;
  loadingId: string | null;
}) {
  const esIngreso = tipo === 'ingreso';
  const colorMonto = esIngreso ? 'text-emerald-600' : 'text-rose-600';

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-slate-400 text-sm">
        {esIngreso ? 'Sin ingresos registrados' : 'Sin gastos registrados'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100 text-left">
            <th className="text-slate-500">Fecha</th>
            <th className="text-slate-500">Descripción</th>
            <th className="text-slate-500">Monto</th>
            <th className="text-slate-500 w-20">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map(m => (
            <tr key={m.id} className="hover:bg-slate-50/70 transition">
              <td className="text-slate-600 text-sm whitespace-nowrap">{formatFecha(m.fecha)}</td>
              <td>
                <p className="font-medium text-slate-800">{m.descripcion}</p>
                {m.notas && <p className="text-xs text-slate-400 mt-0.5">{m.notas}</p>}
              </td>
              <td className={`font-bold ${colorMonto}`}>{formatCOP(m.monto)}</td>
              <td>
                <div className="flex items-center gap-1">
                  <button onClick={() => onEdit(m)} disabled={loadingId === m.id} title="Editar"
                    className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center transition">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => onDelete(m)} disabled={loadingId === m.id} title="Eliminar"
                    className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 ring-1 ring-rose-200 flex items-center justify-center transition">
                    <Trash2 size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InversionContent({ inversion }: { inversion: InversionConfig }) {
  const theme = getInversionTheme(inversion.color);
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  const [mesSel, setMesSel] = useState(mesActual);
  const [anioSel, setAnioSel] = useState(anioActual);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<TipoMovimientoInversion>('ingreso');
  const [editMov, setEditMov] = useState<MovimientoInversion | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [anioFiltro, setAnioFiltro] = useState(anioActual);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const esMesActualSel = mesSel === mesActual && anioSel === anioActual;
  const esMesFuturo = anioSel > anioActual || (anioSel === anioActual && mesSel > mesActual);

  const irMesAnterior = () => {
    if (mesSel === 1) { setMesSel(12); setAnioSel(a => a - 1); }
    else setMesSel(m => m - 1);
  };
  const irMesSiguiente = () => {
    if (mesSel === 12) { setMesSel(1); setAnioSel(a => a + 1); }
    else setMesSel(m => m + 1);
  };
  const irHoy = () => { setMesSel(mesActual); setAnioSel(anioActual); };

  const { movimientos, loading, deleteMovimiento } = useMovimientosInversion(inversion.id, mesSel, anioSel);
  const { movimientos: todosMovimientos, loading: loadingAll } = useAllMovimientosInversion(inversion.id);

  const filtrados = useMemo(() => {
    if (!search.trim()) return movimientos;
    const q = search.toLowerCase();
    return movimientos.filter(m => [m.descripcion, m.notas].join(' ').toLowerCase().includes(q));
  }, [movimientos, search]);

  const ingresos = useMemo(() => filtrados.filter(m => m.tipo === 'ingreso'), [filtrados]);
  const gastos = useMemo(() => filtrados.filter(m => m.tipo === 'gasto'), [filtrados]);

  const resumenMes = useMemo(
    () => calcularResumenInversionMes(movimientos, mesSel, anioSel),
    [movimientos, mesSel, anioSel]
  );

  const aniosDisponibles = useMemo(() => obtenerAniosDisponiblesInversion(todosMovimientos), [todosMovimientos]);
  const resumenesAnio = useMemo(
    () => buildResumenesInversionAnio(anioFiltro, todosMovimientos),
    [anioFiltro, todosMovimientos]
  );
  const resumenesVisibles = useMemo(() => [...resumenesAnio].reverse(), [resumenesAnio]);
  const totalesAnio = useMemo(() => sumarTotalesInversion(resumenesAnio), [resumenesAnio]);
  const totalesHistoricos = useMemo(
    () => sumarTotalesInversion(buildResumenesInversionHistoricos(todosMovimientos)),
    [todosMovimientos]
  );
  const resumenMesActual = useMemo(
    () => resumenesAnio.find(r => r.mes === mesActual && r.anio === anioActual),
    [resumenesAnio, mesActual, anioActual]
  );

  const openAdd = (tipo: TipoMovimientoInversion) => {
    setEditMov(null);
    setModalTipo(tipo);
    setModalOpen(true);
  };

  const openEdit = (m: MovimientoInversion) => {
    setEditMov(m);
    setModalTipo(m.tipo);
    setModalOpen(true);
  };

  const handleDelete = (m: MovimientoInversion) => {
    setConfirmConfig({
      isOpen: true,
      title: '¿Eliminar movimiento?',
      message: `Se eliminará "${m.descripcion}" por ${formatCOP(m.monto)}. Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setLoadingId(m.id);
        try { await deleteMovimiento(m.id); }
        finally { setLoadingId(null); }
      },
    });
  };

  if (loading && loadingAll) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {inversion.descripcion && (
        <p className="text-slate-500 text-sm -mt-2">{inversion.descripcion}</p>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Histórico acumulado</h3>
          <p className="text-slate-500 text-sm">{inversion.labels.historicoSubtitulo}</p>
        </div>
        <div className={`bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} rounded-2xl p-5 shadow-lg ${theme.shadow} text-white`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted} mb-1`}>
            {inversion.labels.balanceNeto} total
          </p>
          <p className="text-3xl font-bold mb-4">{formatCOP(totalesHistoricos.balance)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className={`text-[10px] font-semibold ${theme.textMuted} uppercase`}>Ingresos</p>
              <p className="text-lg font-bold">{formatCOP(totalesHistoricos.totalIngresos)}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className={`text-[10px] font-semibold ${theme.textMuted} uppercase`}>Gastos</p>
              <p className="text-lg font-bold">{formatCOP(totalesHistoricos.totalGastos)}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className={`text-[10px] font-semibold ${theme.textMuted} uppercase`}>Movimientos</p>
              <p className="text-lg font-bold">{totalesHistoricos.cantidadMovimientos}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Resumen anual</h3>
            <p className="text-slate-500 text-sm">{inversion.labels.resumenSubtitulo}</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <label htmlFor={`anio-${inversion.slug}`} className="text-xs font-semibold text-slate-500">Año</label>
            <select
              id={`anio-${inversion.slug}`}
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
          <div className={`rounded-2xl border p-4 flex items-center gap-3 shadow-sm ${theme.primary} border-transparent text-white`}>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <DollarSign size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{inversion.labels.balanceNeto} {anioFiltro}</p>
              <p className="text-lg font-bold">{formatCOP(totalesAnio.balance)}</p>
              <p className="text-[10px] text-white/80">{totalesAnio.mesesConDatos} meses con datos</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3 shadow-sm bg-white border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ingresos {anioFiltro}</p>
              <p className="text-lg font-bold text-emerald-600">{formatCOP(totalesAnio.totalIngresos)}</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3 shadow-sm bg-white border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <TrendingDown size={18} className="text-rose-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gastos {anioFiltro}</p>
              <p className="text-lg font-bold text-rose-600">{formatCOP(totalesAnio.totalGastos)}</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3 shadow-sm bg-white border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Movimientos</p>
              <p className="text-lg font-bold text-slate-800">{totalesAnio.cantidadMovimientos}</p>
            </div>
          </div>
        </div>

        {resumenMesActual && anioFiltro === anioActual && (
          <div className={`bg-white rounded-2xl border ${theme.borderLight} shadow-sm overflow-hidden`}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              <Clock size={16} className={theme.text} />
              <span className="font-semibold text-slate-800 text-sm">
                Mes en curso — {MESES[mesActual - 1]} {anioActual}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
              {[
                { label: 'Ingresos', value: formatCOP(resumenMesActual.totalIngresos), color: 'text-emerald-600', icon: TrendingUp },
                { label: 'Gastos', value: formatCOP(resumenMesActual.totalGastos), color: 'text-rose-600', icon: TrendingDown },
                { label: inversion.labels.balanceNeto, value: formatCOP(resumenMesActual.balance), color: theme.text, icon: DollarSign },
                { label: 'Movimientos', value: String(resumenMesActual.cantidadMovimientos), color: 'text-slate-700', icon: Clock },
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
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <History size={16} className="text-slate-500" />
            <h4 className="font-semibold text-slate-800 text-sm">Mes a mes — {anioFiltro}</h4>
          </div>
          {resumenesVisibles.every(r => r.cantidadMovimientos === 0) ? (
            <div className="py-12 text-center">
              <CalendarDays size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">Sin datos para {anioFiltro}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-left">
                    <th className="text-slate-500">Mes</th>
                    <th className="text-slate-500">Ingresos</th>
                    <th className="text-slate-500">Gastos</th>
                    <th className="text-slate-500">{inversion.labels.balanceNeto}</th>
                    <th className="text-slate-500">Movimientos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resumenesVisibles.map(r => {
                    const sinDatos = r.cantidadMovimientos === 0;
                    return (
                      <tr key={r.id} className={`hover:bg-slate-50/70 transition ${r.esMesActual ? theme.rowHighlight : ''} ${sinDatos ? 'opacity-50' : ''}`}>
                        <td>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">{MESES[r.mes - 1]}</p>
                            {r.esMesActual && (
                              <span className={`text-[10px] font-bold ${theme.badgeBg} ${theme.badgeText} px-1.5 py-0.5 rounded-full uppercase`}>Actual</span>
                            )}
                          </div>
                        </td>
                        <td className="font-semibold text-emerald-600">{formatCOP(r.totalIngresos)}</td>
                        <td className="font-semibold text-rose-600">{formatCOP(r.totalGastos)}</td>
                        <td className={`font-bold ${r.balance >= 0 ? theme.text : 'text-rose-600'}`}>{formatCOP(r.balance)}</td>
                        <td>
                          <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{r.cantidadMovimientos}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-sm">
                    <td className="text-slate-700">Total {anioFiltro}</td>
                    <td className="text-emerald-700">{formatCOP(totalesAnio.totalIngresos)}</td>
                    <td className="text-rose-600">{formatCOP(totalesAnio.totalGastos)}</td>
                    <td className={theme.textDark}>{formatCOP(totalesAnio.balance)}</td>
                    <td className="text-slate-600">{totalesAnio.cantidadMovimientos}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Movimientos del mes</h3>
            <p className="text-slate-500 text-sm">{inversion.labels.movimientosSubtitulo}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={irMesAnterior} className={`w-9 h-9 rounded-xl bg-white border border-slate-200 ${theme.navHover} text-slate-500 flex items-center justify-center transition shadow-sm`}>
              <ChevronLeft size={18} />
            </button>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm shadow-sm transition-all ${
              esMesActualSel ? `${theme.primary} border-transparent text-white ${theme.shadow}` :
              esMesFuturo ? 'bg-purple-50 border-purple-200 text-purple-700' :
              'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              <CalendarDays size={15} />
              <span className="font-bold whitespace-nowrap">{MESES[mesSel - 1]} {anioSel}</span>
              {esMesActualSel && (
                <span className="text-[10px] font-bold bg-white/25 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Actual</span>
              )}
            </div>
            <button onClick={irMesSiguiente} className={`w-9 h-9 rounded-xl bg-white border border-slate-200 ${theme.navHover} text-slate-500 flex items-center justify-center transition shadow-sm`}>
              <ChevronRight size={18} />
            </button>
            {!esMesActualSel && (
              <button onClick={irHoy} className={`text-xs font-semibold ${theme.text} hover:underline transition px-1`}>Hoy</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <ArrowUpCircle size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ingresos</p>
              <p className="text-lg font-bold text-emerald-600">{formatCOP(resumenMes.totalIngresos)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-rose-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <ArrowDownCircle size={18} className="text-rose-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gastos</p>
              <p className="text-lg font-bold text-rose-600">{formatCOP(resumenMes.totalGastos)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Movimientos</p>
              <p className="text-lg font-bold text-slate-800">{resumenMes.cantidadMovimientos}</p>
            </div>
          </div>
          <div className={`${theme.primary} rounded-2xl p-4 flex items-center gap-3 shadow-lg ${theme.shadow}`}>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <DollarSign size={18} className="text-white" />
            </div>
            <div className="text-white">
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">{inversion.labels.balanceNeto}</p>
              <p className="text-lg font-bold">{formatCOP(resumenMes.balance)}</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por descripción..."
            className={`w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${theme.ring} transition`}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-rose-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <TrendingDown size={16} className="text-rose-500" />
              <h3 className="font-semibold text-slate-800 text-sm">{inversion.labels.gastosTitulo}</h3>
              <button onClick={() => openAdd('gasto')}
                className="ml-auto flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                <Plus size={14} /> Agregar
              </button>
            </div>
            <TablaMovimientos items={gastos} tipo="gasto" onEdit={openEdit} onDelete={handleDelete} loadingId={loadingId} />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-500" />
              <h3 className="font-semibold text-slate-800 text-sm">{inversion.labels.ingresosTitulo}</h3>
              <button onClick={() => openAdd('ingreso')}
                className="ml-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                <Plus size={14} /> Agregar
              </button>
            </div>
            <TablaMovimientos items={ingresos} tipo="ingreso" onEdit={openEdit} onDelete={handleDelete} loadingId={loadingId} />
          </div>
        </div>
      </section>

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditMov(null); }}
        title={editMov ? 'Editar movimiento' : modalTipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar gasto'}
        size="sm"
      >
        <MovimientoInversionForm
          inversion={inversion}
          onClose={() => { setModalOpen(false); setEditMov(null); }}
          tipo={modalTipo}
          mes={mesSel}
          anio={anioSel}
          initial={editMov}
        />
      </Modal>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(c => ({ ...c, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type="danger"
      />
    </div>
  );
}

export default function InversionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { loading, getBySlug } = useInversiones();

  if (loading) return <LoadingSpinner />;

  const inversion = slug ? getBySlug(slug) : undefined;
  if (!inversion || !inversion.activo) {
    return <Navigate to="/" replace />;
  }

  return <InversionContent inversion={inversion} />;
}
