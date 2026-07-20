import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useCarteras } from '../../hooks/useCarteras';
import type { Cliente, Cartera } from '../../types';
import { esClienteActivo } from '../../utils/activo';

interface CarteraFormProps {
  onClose: () => void;
  clientes: Cliente[];
  initial?: Cartera | null;
  defaultClienteId?: string;
}

function toDateInputValue(ts?: Timestamp): string {
  if (!ts) return '';
  return ts.toDate().toISOString().split('T')[0];
}

function toTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr + 'T00:00:00'));
}

export default function CarteraForm({ onClose, clientes, initial, defaultClienteId }: CarteraFormProps) {
  const { addCartera, updateCartera } = useCarteras();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Ordenar clientes alfabéticamente para el desplegable
  const clientesOrdenados = [...clientes]
    .filter(c => esClienteActivo(c) || c.id === initial?.clienteId || c.id === defaultClienteId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const [form, setForm] = useState({
    nombre: initial?.nombre || '',
    clienteId: initial?.clienteId || defaultClienteId || (clientesOrdenados[0]?.id || ''),
    valorCartera: initial?.valorCartera?.toString() || '',
    costoTotal: initial?.costoTotal?.toString() || '',
    fechaVencimientoMensual: toDateInputValue(initial?.fechaVencimientoMensual),
    fechaRenovacion: toDateInputValue(initial?.fechaRenovacion),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre de la cartera es requerido.'); return; }
    if (!form.clienteId) { setError('Selecciona un cliente.'); return; }
    if (!form.valorCartera || isNaN(Number(form.valorCartera))) { setError('Ingresa un valor mensual válido.'); return; }
    if (!form.fechaVencimientoMensual) { setError('Selecciona la fecha de vencimiento.'); return; }

    setLoading(true);
    setError('');

    try {
      const cliente = clientes.find((c) => c.id === form.clienteId);
      const payload = {
        nombre: form.nombre.trim(),
        clienteId: form.clienteId,
        clienteNombre: cliente?.nombre || '',
        valorCartera: Number(form.valorCartera),
        costoTotal: Number(form.costoTotal || 0),
        fechaVencimientoMensual: toTimestamp(form.fechaVencimientoMensual),
        fechaRenovacion: form.fechaRenovacion
          ? toTimestamp(form.fechaRenovacion)
          : Timestamp.fromDate(new Date()),
      };

      if (initial) {
        await updateCartera(initial.id, payload);
      } else {
        await addCartera(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la cartera.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition";
  const labelCls = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Nombre de la cartera */}
      <div>
        <label className={labelCls}>Nombre de la cartera *</label>
        <input
          name="nombre" value={form.nombre} onChange={handleChange} required
          placeholder="Ej: Plan Premium, Suscripción Anual..."
          className={inputCls}
        />
      </div>

      {/* Cliente Selector */}
      <div>
        <label className={labelCls}>Cliente *</label>
        <select name="clienteId" value={form.clienteId} onChange={handleChange} className={inputCls}>
          {clientesOrdenados.length === 0 && <option value="">— Sin clientes registrados —</option>}
          {clientesOrdenados.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.empresa ? `· ${c.empresa}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Valor mensual (COP) *</label>
          <input type="number" name="valorCartera" value={form.valorCartera} onChange={handleChange}
            placeholder="0" min="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Costo total (COP)</label>
          <input type="number" name="costoTotal" value={form.costoTotal} onChange={handleChange}
            placeholder="0" min="0" className={inputCls} />
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Día de pago mensual *</label>
          <input type="date" name="fechaVencimientoMensual"
            value={form.fechaVencimientoMensual} onChange={handleChange} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fecha de renovación</label>
          <input type="date" name="fechaRenovacion"
            value={form.fechaRenovacion} onChange={handleChange} className={inputCls} />
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-700">
        💡 El estado se calcula automáticamente. Al asignar la cartera se generará un cobro para el mes actual.
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60">
          {loading ? 'Guardando...' : initial ? 'Actualizar' : 'Asignar Cartera'}
        </button>
      </div>
    </form>
  );
}
