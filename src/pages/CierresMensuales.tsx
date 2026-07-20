import { useState } from 'react';
import {
  Calendar,
  TrendingUp,
  AlertCircle,
  Briefcase,
  Play,
  CheckCircle2,
  Clock,
  History,
} from 'lucide-react';
import { useCierres } from '../hooks/useCierres';
import { useCobros } from '../hooks/useCobros';
import { useAuth } from '../context/AuthContext';
import { ejecutarCierreMensual } from '../services/cierreMensual';
import LoadingSpinner from '../components/ui/LoadingSpinner';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Modal de confirmación interno ──────────────────────────────────────────────
function ConfirmModal({
  isOpen, onClose, onConfirm, mesLabel, loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mesLabel: string;
  loading: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6" style={{ animation: 'modalIn 0.2s ease-out' }}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={22} className="text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">¿Ejecutar cierre de {mesLabel}?</h3>
            <p className="text-slate-500 text-sm mt-1">
              Esta acción <strong>no se puede deshacer</strong>. Se calcularán los totales del mes,
              se guardarán en el historial y se generarán los cobros del próximo mes.
            </p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm mb-5">
          <p className="font-semibold mb-1">¿Qué ocurrirá?</p>
          <ul className="space-y-1 text-xs list-disc list-inside">
            <li>Los cobros "Pendiente" de {mesLabel} pasarán a estado "Mora"</li>
            <li>Se creará un registro histórico con el cierre del mes</li>
            <li>Se generarán automáticamente los cobros del mes siguiente</li>
          </ul>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50 order-2 sm:order-1">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition disabled:opacity-60 order-1 sm:order-2">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Ejecutando...</>
            ) : (
              <><Play size={14} /> Confirmar cierre</>
            )}
          </button>
        </div>
        <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(-8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function CierresMensuales() {
  const { user } = useAuth();
  const { cierres, loading: loadingCierres } = useCierres();

  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  const { cobros, loading: loadingCobros } = useCobros(mesActual, anioActual);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState<null | { recaudado: number; mora: number; carteras: number; mesSig: string }>(null);
  const [error, setError] = useState('');

  // KPIs del mes actual en curso
  const cobradoMes = cobros.filter(c => c.estado === 'Pagado').reduce((s, c) => s + c.valorCobro, 0);
  const moraMes    = cobros.filter(c => c.estado !== 'Pagado').reduce((s, c) => s + c.valorCobro, 0);
  const pendientesCount = cobros.filter(c => c.estado === 'Pendiente').length;

  // ¿Ya existe el cierre del mes actual?
  const cierreActualExiste = cierres.some(c => c.mes === mesActual && c.anio === anioActual);

  const handleCierre = async () => {
    setEjecutando(true);
    setError('');
    try {
      const res = await ejecutarCierreMensual(mesActual, anioActual, user?.email || 'desconocido');
      setResultado({
        recaudado: res.totalRecaudado,
        mora: res.totalMora,
        carteras: res.cantidadCarteras,
        mesSig: `${MESES[res.mesSiguiente - 1]} ${res.anioSiguiente}`,
      });
      setConfirmOpen(false);
    } catch (e: any) {
      setError(e.message || 'Error al ejecutar el cierre.');
      setConfirmOpen(false);
    } finally {
      setEjecutando(false);
    }
  };

  if (loadingCierres || loadingCobros) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cierres Mensuales</h2>
          <p className="text-slate-500 text-sm mt-1">
            Historial de cierres de caja y control de cobros por período.
          </p>
        </div>
        {!cierreActualExiste && (
          <button
            onClick={() => { setResultado(null); setError(''); setConfirmOpen(true); }}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <Play size={15} /> Ejecutar Cierre de {MESES[mesActual - 1]}
          </button>
        )}
        {cierreActualExiste && (
          <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-sm font-medium border border-emerald-200">
            <CheckCircle2 size={16} /> Cierre de {MESES[mesActual - 1]} ejecutado
          </div>
        )}
      </div>

      {/* Error / Resultado */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}
      {resultado && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-2">
            <CheckCircle2 size={18} /> Cierre ejecutado exitosamente
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-slate-500 text-xs">Recaudado</p><p className="font-bold text-slate-800">{formatCOP(resultado.recaudado)}</p></div>
            <div><p className="text-slate-500 text-xs">En mora</p><p className="font-bold text-rose-600">{formatCOP(resultado.mora)}</p></div>
            <div><p className="text-slate-500 text-xs">Cobros generados para</p><p className="font-bold text-slate-800">{resultado.mesSig}</p></div>
          </div>
        </div>
      )}

      {/* ── Estado del mes actual ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock size={18} className="text-indigo-500" />
          <h3 className="font-semibold text-slate-800">Mes en curso — {MESES[mesActual - 1]} {anioActual}</h3>
          <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{cobros.length} cobros</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          {[
            { label: 'Recaudado', value: formatCOP(cobradoMes), color: 'text-emerald-600', icon: TrendingUp },
            { label: 'Por cobrar / Mora', value: formatCOP(moraMes), color: 'text-rose-600', icon: AlertCircle },
            { label: 'Pendientes de pago', value: pendientesCount, color: 'text-amber-600', icon: Briefcase },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="p-5 text-center">
              <Icon size={20} className={`mx-auto mb-2 ${color}`} />
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-slate-500 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Historial de cierres ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <History size={18} className="text-slate-500" />
          <h3 className="font-semibold text-slate-800">Historial de cierres</h3>
        </div>

        {cierres.length === 0 ? (
          <div className="py-14 text-center">
            <Calendar size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No hay cierres registrados aún.</p>
            <p className="text-slate-400 text-xs mt-1">El primer cierre se guardará cuando ejecutes el botón de arriba.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="text-slate-500">Período</th>
                  <th className="text-slate-500">Recaudado</th>
                  <th className="text-slate-500">En mora</th>
                  <th className="text-slate-500">Carteras</th>
                  <th className="text-slate-500">Ejecutado por</th>
                  <th className="text-slate-500">Fecha de cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cierres.map((cierre) => {
                  const total = cierre.totalRecaudado + cierre.totalMora;
                  const pct = total > 0 ? Math.round((cierre.totalRecaudado / total) * 100) : 0;
                  return (
                    <tr key={cierre.id} className="hover:bg-slate-50/70 transition">
                      <td>
                        <p className="font-semibold text-slate-800">
                          {MESES[cierre.mes - 1]} {cierre.anio}
                        </p>
                        <p className="text-slate-400 text-[11px]">Período {cierre.id}</p>
                      </td>
                      <td>
                        <p className="font-bold text-emerald-600">{formatCOP(cierre.totalRecaudado)}</p>
                        <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-slate-400 text-[11px]">{pct}% del total</p>
                      </td>
                      <td className="font-semibold text-rose-500">{formatCOP(cierre.totalMora)}</td>
                      <td>
                        <span className="bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {cierre.cantidadCarterasActivas}
                        </span>
                      </td>
                      <td className="text-slate-500">{cierre.ejecutadoPor}</td>
                      <td className="text-slate-400">
                        {cierre.fechaEjecucionCierre?.toDate?.()?.toLocaleDateString('es-CO', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de confirmación ─────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleCierre}
        mesLabel={`${MESES[mesActual - 1]} ${anioActual}`}
        loading={ejecutando}
      />
    </div>
  );
}
