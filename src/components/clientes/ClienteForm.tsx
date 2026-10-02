import { useState } from 'react';
import { Phone } from 'lucide-react';
import { useClientes } from '../../hooks/useClientes';
import { useAliados } from '../../hooks/useAliados';
import type { Cliente } from '../../types';

interface ClienteFormProps {
  onClose: () => void;
  initial?: Cliente | null;
}

const PAISES = ['Colombia', 'México', 'Argentina', 'Chile', 'Perú', 'Venezuela', 'Ecuador', 'Bolivia', 'España', 'Otro'];
const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition";
const labelCls = "block text-sm font-medium text-slate-700 mb-1";

export default function ClienteForm({ onClose, initial }: ClienteFormProps) {
  const { addCliente, updateCliente } = useClientes();
  const { aliados } = useAliados();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    nombre:   initial?.nombre   || '',
    empresa:  initial?.empresa  || '',
    ruta:     initial?.ruta     || '',
    pais:     initial?.pais     || 'Colombia',
    whatsapp: initial?.whatsapp || '',
    aliadoId: initial?.aliadoId || '',
    porcentajeParticipacion: initial?.porcentajeParticipacion != null ? String(initial.porcentajeParticipacion) : '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es requerido.'); return; }
    const porcentaje = form.aliadoId ? Number(form.porcentajeParticipacion) : null;
    if (form.aliadoId && (porcentaje == null || isNaN(porcentaje) || porcentaje <= 0 || porcentaje > 100)) {
      setError('Indica un porcentaje de participación entre 1 y 100.');
      return;
    }
    setLoading(true);
    setError('');
    const payload = {
      nombre: form.nombre,
      empresa: form.empresa,
      ruta: form.ruta,
      pais: form.pais,
      whatsapp: form.whatsapp,
      aliadoId: form.aliadoId || null,
      porcentajeParticipacion: form.aliadoId ? porcentaje : null,
    };
    try {
      if (initial) {
        await updateCliente(initial.id, payload);
      } else {
        await addCliente(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div>
        <label className={labelCls}>Nombre completo *</label>
        <input name="nombre" value={form.nombre} onChange={handleChange} required
          placeholder="Ej: Juan García" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Empresa</label>
          <input name="empresa" value={form.empresa} onChange={handleChange}
            placeholder="Ej: TechCorp SAS" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>WhatsApp</label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="whatsapp" value={form.whatsapp} onChange={handleChange}
              placeholder="+57 300 000 0000" className={`${inputCls} pl-9`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Ruta / Segmento</label>
          <input name="ruta" value={form.ruta} onChange={handleChange}
            placeholder="Ej: Norte, Sur, Online..." className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>País</label>
          <select name="pais" value={form.pais} onChange={handleChange} className={inputCls}>
            {PAISES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Aliado</label>
          <select
            name="aliadoId"
            value={form.aliadoId}
            onChange={handleChange}
            className={inputCls}
          >
            <option value="">Sin aliado</option>
            {aliados.filter(a => a.activo !== false).map(a => (
              <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>% participación</label>
          <input
            name="porcentajeParticipacion"
            type="number"
            min={1}
            max={100}
            step="0.01"
            value={form.porcentajeParticipacion}
            onChange={handleChange}
            disabled={!form.aliadoId}
            placeholder={form.aliadoId ? 'Ej: 10' : 'Elige un aliado'}
            className={inputCls}
          />
        </div>
      </div>
      {form.aliadoId && (
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
          Código del aliado: <span className="font-bold">{aliados.find(a => a.id === form.aliadoId)?.codigo}</span>
          {' '}— ese porcentaje del pago de cartera se transfiere a su banco del 1 al 5 del mes siguiente.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60">
          {loading ? 'Guardando...' : initial ? 'Actualizar' : 'Crear Cliente'}
        </button>
      </div>
    </form>
  );
}
