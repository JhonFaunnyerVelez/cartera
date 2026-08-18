import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Users, Clock, ArrowRight } from 'lucide-react';
import { useClientes } from '../hooks/useClientes';
import { useCarteras, diasParaVencer } from '../hooks/useCarteras';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ResumenAnualPanel from '../components/dashboard/ResumenAnualPanel';
import { esCarteraActiva } from '../utils/activo';

function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
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

  const carterasActivas = useMemo(() => carteras.filter(esCarteraActiva), [carteras]);
  const totalClientes = clientes.filter(c => c.activo !== false).length;

  const proximosAVencer = useMemo(() => {
    return carterasActivas
      .filter((c) => {
        const dias = diasParaVencer(c.fechaVencimientoMensual);
        return dias >= 0 && dias <= 5;
      })
      .sort((a, b) =>
        diasParaVencer(a.fechaVencimientoMensual) - diasParaVencer(b.fechaVencimientoMensual)
      );
  }, [carterasActivas]);

  const enMora = useMemo(() => carterasActivas.filter((c) => c.estado === 'Mora'), [carterasActivas]);

  if (loadingClientes || loadingCarteras) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">
          Ganancia anual, recaudo por mes y alertas operativas de tu cartera.
        </p>
      </div>

      <ResumenAnualPanel />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Clientes activos"
          value={totalClientes}
          subtitle={`${carterasActivas.length} cartera${carterasActivas.length !== 1 ? 's' : ''} activas`}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Carteras en mora"
          value={enMora.length}
          subtitle={enMora.length > 0 ? formatCOP(enMora.reduce((s, c) => s + c.valorCartera, 0)) + ' pendientes' : 'Sin mora registrada'}
          icon={AlertCircle}
          color="rose"
        />
      </div>

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
            Ver cobros <ArrowRight size={14} />
          </Link>
        </div>

        {proximosAVencer.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            <Clock size={28} className="mx-auto mb-2 opacity-30" />
            No hay carteras próximas a vencer
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="text-slate-500">Cliente</th>
                  <th className="text-slate-500">Valor mensual</th>
                  <th className="text-slate-500">Vencimiento</th>
                  <th className="text-slate-500">Días restantes</th>
                  <th className="text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {proximosAVencer.map((cartera) => {
                  const dias = diasParaVencer(cartera.fechaVencimientoMensual);
                  const cliente = clientes.find((c) => c.id === cartera.clienteId);
                  return (
                    <tr key={cartera.id} className="hover:bg-slate-50 transition">
                      <td>
                        <p className="font-medium text-slate-800">{cartera.clienteNombre || cliente?.nombre || '-'}</p>
                        <p className="text-slate-400 text-[11px]">{cliente?.empresa || ''}</p>
                      </td>
                      <td className="text-slate-700 font-medium">{formatCOP(cartera.valorCartera)}</td>
                      <td className="text-slate-500">{formatDateCurrentMonth(cartera.fechaVencimientoMensual)}</td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          dias === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {dias === 0 ? '¡Hoy!' : `${dias} día${dias !== 1 ? 's' : ''}`}
                        </span>
                      </td>
                      <td><Badge estado={cartera.estado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
            <table className="data-table">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="text-slate-500">Cliente</th>
                  <th className="text-slate-500">Valor mensual</th>
                  <th className="text-slate-500">Venció</th>
                  <th className="text-slate-500">Días en mora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {enMora.map((cartera) => {
                  const diasVencidos = Math.abs(diasParaVencer(cartera.fechaVencimientoMensual));
                  const cliente = clientes.find((c) => c.id === cartera.clienteId);
                  return (
                    <tr key={cartera.id} className="hover:bg-rose-50/30 transition">
                      <td>
                        <p className="font-medium text-slate-800">{cartera.clienteNombre || cliente?.nombre || '-'}</p>
                        <p className="text-slate-400 text-[11px]">{cliente?.empresa || ''}</p>
                      </td>
                      <td className="text-slate-700 font-medium">{formatCOP(cartera.valorCartera)}</td>
                      <td className="text-slate-500">{formatDateCurrentMonth(cartera.fechaVencimientoMensual)}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
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
