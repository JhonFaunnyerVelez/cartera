import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, AlertCircle, Users, Clock, ArrowRight } from 'lucide-react';
import { useClientes } from '../hooks/useClientes';
import { useCarteras, diasParaVencer } from '../hooks/useCarteras';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(ts: any): string {
  if (!ts) return '-';
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateCurrentMonth(ts: any): string {
  if (!ts) return '-';
  const d = ts.toDate();
  const hoy = new Date();
  d.setFullYear(hoy.getFullYear());
  d.setMonth(hoy.getMonth());
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const { clientes, loading: loadingClientes } = useClientes();
  const { carteras, loading: loadingCarteras } = useCarteras();

  // ── KPI 1: Deudas pendientes (suma de valorCartera de carteras en Mora) ──
  const deudasPendientes = useMemo(() =>
    carteras
      .filter((c) => c.estado === 'Mora')
      .reduce((sum, c) => sum + c.valorCartera, 0),
    [carteras]
  );

  // ── KPI 2: Acumulado del mes (suma de carteras 'Al día' como ingreso estimado) ──
  const acumuladoMes = useMemo(() =>
    carteras
      .filter((c) => c.estado === 'Al día' || c.estado === 'Próximo a vencer')
      .reduce((sum, c) => sum + c.valorCartera, 0),
    [carteras]
  );

  // ── KPI 3: Total clientes activos ──
  const totalClientes = clientes.length;

  // ── Tabla: Próximos a vencer (≤ 5 días y no vencidos) ──
  const proximosAVencer = useMemo(() => {
    return carteras
      .filter((c) => {
        const dias = diasParaVencer(c.fechaVencimientoMensual);
        return dias >= 0 && dias <= 5;
      })
      .sort((a, b) =>
        diasParaVencer(a.fechaVencimientoMensual) - diasParaVencer(b.fechaVencimientoMensual)
      );
  }, [carteras]);

  // ── Carteras en mora ──
  const enMora = useMemo(() => carteras.filter((c) => c.estado === 'Mora'), [carteras]);

  if (loadingClientes || loadingCarteras) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Resumen general</h2>
        <p className="text-slate-500 text-sm mt-1">
          Vista consolidada de tu cartera de clientes y suscripciones.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          title="Acumulado estimado del mes"
          value={formatCOP(acumuladoMes)}
          subtitle={`${carteras.filter(c => c.estado !== 'Mora').length} carteras activas`}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Deudas pendientes"
          value={formatCOP(deudasPendientes)}
          subtitle={`${enMora.length} cartera${enMora.length !== 1 ? 's' : ''} en mora`}
          icon={AlertCircle}
          color="rose"
        />
        <StatCard
          title="Clientes activos"
          value={totalClientes}
          subtitle={`${carteras.length} cartera${carteras.length !== 1 ? 's' : ''} registradas`}
          icon={Users}
          color="indigo"
        />
      </div>

      {/* Próximos a Vencer */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Próximos a vencer</h3>
              <p className="text-slate-400 text-xs">Carteras que vencen en los próximos 5 días</p>
            </div>
          </div>
          <Link to="/carteras" className="text-indigo-600 text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all">
            Ver todo <ArrowRight size={14} />
          </Link>
        </div>

        {proximosAVencer.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <Clock size={32} className="mx-auto mb-3 opacity-30" />
            No hay carteras próximas a vencer
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor mensual</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vencimiento</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Días restantes</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {proximosAVencer.map((cartera) => {
                  const dias = diasParaVencer(cartera.fechaVencimientoMensual);
                  const cliente = clientes.find((c) => c.id === cartera.clienteId);
                  return (
                    <tr key={cartera.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800 text-sm">{cartera.clienteNombre || cliente?.nombre || '-'}</p>
                        <p className="text-slate-400 text-xs">{cliente?.empresa || ''}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-700 text-sm font-medium">
                        {formatCOP(cartera.valorCartera)}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {formatDateCurrentMonth(cartera.fechaVencimientoMensual)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          dias === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {dias === 0 ? '¡Hoy!' : `${dias} día${dias !== 1 ? 's' : ''}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge estado={cartera.estado} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Carteras en Mora */}
      {enMora.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-rose-100 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-rose-50 bg-rose-50/50">
            <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
              <AlertCircle size={16} className="text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Carteras en mora</h3>
              <p className="text-slate-500 text-xs">{enMora.length} cartera{enMora.length !== 1 ? 's' : ''} con pagos vencidos</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor mensual</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Venció</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Días en mora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {enMora.map((cartera) => {
                  const diasVencidos = Math.abs(diasParaVencer(cartera.fechaVencimientoMensual));
                  const cliente = clientes.find((c) => c.id === cartera.clienteId);
                  return (
                    <tr key={cartera.id} className="hover:bg-rose-50/30 transition">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800 text-sm">{cartera.clienteNombre || cliente?.nombre || '-'}</p>
                        <p className="text-slate-400 text-xs">{cliente?.empresa || ''}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-700 text-sm font-medium">{formatCOP(cartera.valorCartera)}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{formatDateCurrentMonth(cartera.fechaVencimientoMensual)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          {diasVencidos} día{diasVencidos !== 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
