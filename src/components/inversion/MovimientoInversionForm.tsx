import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useMovimientosInversion } from '../../hooks/useMovimientosInversion';
import type { InversionConfig, MovimientoInversion, TipoMovimientoInversion } from '../../types';
import { getInversionTheme } from '../../utils/inversionTheme';

interface MovimientoInversionFormProps {
  inversion: InversionConfig;
  onClose: () => void;
  tipo: TipoMovimientoInversion;
  mes: number;
  anio: number;
  initial?: MovimientoInversion | null;
}

function fechaToInput(ts?: Timestamp): string {
  if (!ts?.toDate) return new Date().toISOString().slice(0, 10);
  return ts.toDate().toISOString().slice(0, 10);
}

function periodoFromFecha(fechaStr: string): { mes: number; anio: number } {
  const d = new Date(fechaStr + 'T12:00:00');
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
}

export default function MovimientoInversionForm({
  inversion, onClose, tipo, mes, anio, initial,
}: MovimientoInversionFormProps) {
  const { addMovimiento, updateMovimiento } = useMovimientosInversion(inversion.id, mes, anio);
  const theme = getInversionTheme(inversion.color);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    monto: initial?.monto?.toString() || '',
    descripcion: initial?.descripcion || '',
    fecha: fechaToInput(initial?.fecha),
    notas: initial?.notas || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion.trim()) {
      setError('La descripción es requerida.');
      return;
    }
    if (!form.monto || isNaN(Number(form.monto)) || Number(form.monto) <= 0) {
      setError('Ingresa un monto válido mayor a cero.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fecha = Timestamp.fromDate(new Date(form.fecha + 'T12:00:00'));
      const { mes: mesMov, anio: anioMov } = periodoFromFecha(form.fecha);
      const notasTrim = form.notas.trim();
      const payload = {
        tipo,
        monto: Number(form.monto),
        descripcion: form.descripcion.trim(),
        mes: mesMov,
        anio: anioMov,
        fecha,
        ...(notasTrim ? { notas: notasTrim } : {}),
      };

      if (initial) {
        await updateMovimiento(initial.id, payload, !notasTrim);
      } else {
        await addMovimiento(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el movimiento.');
    } finally {
      setLoading(false);
    }
  };

  const labelTipo = tipo === 'ingreso'
    ? inversion.labels.ingresoFormLabel
    : 'Gasto / Salida';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-3 py-2 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
        <p className={`text-sm font-semibold ${tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {labelTipo}
        </p>
      </div>

      <div>
        <label htmlFor="monto" className="block text-xs font-semibold text-slate-500 mb-1">Monto (COP)</label>
        <input
          id="monto"
          name="monto"
          type="number"
          min="1"
          value={form.monto}
          onChange={handleChange}
          placeholder="Ej. 150000"
          className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${theme.ring}`}
        />
      </div>

      <div>
        <label htmlFor="descripcion" className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
        <input
          id="descripcion"
          name="descripcion"
          type="text"
          value={form.descripcion}
          onChange={handleChange}
          placeholder={tipo === 'ingreso' ? inversion.labels.ingresoPlaceholder : inversion.labels.gastoPlaceholder}
          className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${theme.ring}`}
        />
      </div>

      <div>
        <label htmlFor="fecha" className="block text-xs font-semibold text-slate-500 mb-1">Fecha</label>
        <input
          id="fecha"
          name="fecha"
          type="date"
          value={form.fecha}
          onChange={handleChange}
          className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${theme.ring}`}
        />
      </div>

      <div>
        <label htmlFor="notas" className="block text-xs font-semibold text-slate-500 mb-1">Notas (opcional)</label>
        <textarea
          id="notas"
          name="notas"
          value={form.notas}
          onChange={handleChange}
          rows={2}
          className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${theme.ring} resize-none`}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-60 ${
            tipo === 'ingreso'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-rose-600 hover:bg-rose-700'
          }`}
        >
          {loading ? 'Guardando...' : initial ? 'Actualizar' : 'Registrar'}
        </button>
      </div>
    </form>
  );
}
