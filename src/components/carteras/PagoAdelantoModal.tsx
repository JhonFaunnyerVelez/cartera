import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, CheckCircle2 } from 'lucide-react';
import { editarPago, mesesRegistradosDelPago, registrarPagoAdelantado } from '../../services/pagoAdelantado';
import { useClientes } from '../../hooks/useClientes';
import { useAliados } from '../../hooks/useAliados';
import type { Cartera, CobroMensual } from '../../types';
import { calcularParticipacion } from '../../utils/participacionAliado';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

interface Props {
  cartera: Cartera;
  mesActual: number;
  anioActual: number;
  cobro?: CobroMensual;
  onClose: () => void;
}

export default function PagoAdelantoModal({ cartera, mesActual, anioActual, cobro, onClose }: Props) {
  const editando = !!cobro;
  const mesesIniciales = cobro ? mesesRegistradosDelPago(cobro) : 2;
  const [meses, setMeses] = useState(mesesIniciales);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const { clientes } = useClientes();
  const { aliados } = useAliados();

  useEffect(() => {
    setMeses(cobro ? mesesRegistradosDelPago(cobro) : 2);
    setResultado(null);
    setError('');
  }, [cobro?.id, cartera.id]);

  const totalAPagar = cartera.valorCartera * meses;
  const cliente = clientes.find(c => c.id === cartera.clienteId);
  const aliado = aliados.find(a => a.id === cliente?.aliadoId);
  const porcentaje = cliente?.porcentajeParticipacion || 0;
  const comisionMes = aliado && porcentaje > 0 ? calcularParticipacion(cartera.valorCartera, porcentaje) : 0;

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const res = cobro
        ? await editarPago(cartera, cobro, meses)
        : await registrarPagoAdelantado(cartera, mesActual, anioActual, meses);
      setResultado(res.periodos);
    } catch (e: any) {
      setError(e.message || (editando ? 'Error al editar el pago.' : 'Error al registrar el pago.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {resultado ? (
        /* ── Éxito ── */
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg mb-1">{editando ? '¡Pago actualizado!' : '¡Pago registrado!'}</h3>
          <p className="text-slate-500 text-sm mb-4">
            {formatCOP(totalAPagar)} {editando ? 'quedan' : 'pagados'} por {meses} {meses === 1 ? 'mes' : 'meses'}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {resultado.map((p) => (
              <span key={p} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
                ✓ {p}
              </span>
            ))}
          </div>
          <button onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">
            Cerrar
          </button>
        </div>
      ) : (
        /* ── Formulario ── */
        <>
          {/* Info de la cartera */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <p className="font-semibold text-indigo-800 text-sm">{cartera.nombre}</p>
            <p className="text-indigo-600 text-xs mt-0.5">{cartera.clienteNombre} · {formatCOP(cartera.valorCartera)}/mes</p>
          </div>

          {/* Selector de meses */}
          <div>
            {editando && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-3">
                Este pago ya está registrado ({mesesIniciales} {mesesIniciales === 1 ? 'cuota' : 'cuotas'}).
                Cambia las cuotas y se ajustan los meses siguientes, sin borrar el pago.
              </div>
            )}

            <label className="block text-sm font-medium text-slate-700 mb-2">
              {editando ? '¿Cuántas cuotas quedaron pagadas?' : '¿Cuántos meses paga por adelantado?'}
            </label>
            {/* Botones rápidos */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[1, 2, 3, 6].map((n) => (
                <button key={n} onClick={() => setMeses(n)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition border ${
                    meses === n
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  {n} {n === 1 ? 'mes' : 'meses'}
                </button>
              ))}
            </div>
            {/* Input manual */}
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-400" />
              <input
                type="number" min={1} max={24} value={meses}
                onChange={e => setMeses(Math.max(1, Math.min(24, Number(e.target.value))))}
                className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-slate-500 text-sm">meses (máx. 24)</span>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Valor por mes</span>
              <span className="font-semibold text-slate-800">{formatCOP(cartera.valorCartera)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Meses a pagar</span>
              <span className="font-semibold text-slate-800">{meses}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between">
              <span className="font-semibold text-slate-700">{editando ? 'Total del pago' : 'Total a registrar'}</span>
              <span className="font-bold text-emerald-600 text-lg">{formatCOP(totalAPagar)}</span>
            </div>
            {comisionMes > 0 && aliado && (
              <div className="border-t border-sky-200 pt-2 text-xs text-sky-800 space-y-0.5">
                <p className="font-semibold">{aliado.codigo} · {aliado.nombre} · {porcentaje}%</p>
                <p>Comisión de cada mes: {formatCOP(comisionMes)}. No se acumula el adelanto.</p>
                <p>Queda facturada en cada mes adelantado y se paga del 1 al 5 del mes siguiente.</p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-rose-600 text-sm bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-60">
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> {editando ? 'Guardando...' : 'Registrando...'}</>
                : editando
                  ? `Guardar ${meses} ${meses === 1 ? 'cuota' : 'cuotas'}`
                  : `Registrar pago de ${meses} ${meses === 1 ? 'mes' : 'meses'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
