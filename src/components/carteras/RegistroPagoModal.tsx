import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { CobroMensual } from '../../types';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

interface Props {
  cobro: CobroMensual;
  onClose: () => void;
  onConfirm: (monto: number) => Promise<void>;
}

export default function RegistroPagoModal({ cobro, onClose, onConfirm }: Props) {
  const valorEsperado = cobro.valorCobro;
  const [monto, setMonto] = useState(String(valorEsperado));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMonto(String(valorEsperado));
    setError('');
  }, [cobro.id, valorEsperado]);

  const handleConfirm = async () => {
    const valor = Number(monto);
    if (!monto || isNaN(valor) || valor <= 0) {
      setError('Ingresa un monto válido mayor a cero.');
      return;
    }
    if (valor > valorEsperado) {
      setError(`El monto no puede superar ${formatCOP(valorEsperado)}.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onConfirm(valor);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar el pago.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-left">
        <p className="font-semibold text-emerald-800 text-sm">{cobro.carteraNombre}</p>
        <p className="text-emerald-600 text-xs mt-0.5">{cobro.clienteNombre}</p>
      </div>

      <div className="text-left">
        <label htmlFor="monto-pago" className="block text-sm font-medium text-slate-700 mb-1.5">
          Monto recibido (COP)
        </label>
        <input
          id="monto-pago"
          type="number"
          min={1}
          max={valorEsperado}
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value);
            setError('');
          }}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
        <p className="text-xs text-slate-400 mt-1.5">
          Valor del cobro: {formatCOP(valorEsperado)} — puedes bajarlo si paga menos
        </p>
      </div>

      {Number(monto) > 0 && Number(monto) < valorEsperado && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-left">
          Pago parcial: se registrarán {formatCOP(Number(monto))} de {formatCOP(valorEsperado)}.
        </p>
      )}

      {error && (
        <p className="text-rose-600 text-sm bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg text-left">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Registrando...
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Registrar pago
            </>
          )}
        </button>
      </div>
    </div>
  );
}
