import { useState } from 'react';
import { Phone } from 'lucide-react';
import { useClientes } from '../../hooks/useClientes';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    nombre:   initial?.nombre   || '',
    empresa:  initial?.empresa  || '',
    ruta:     initial?.ruta     || '',
    pais:     initial?.pais     || 'Colombia',
    whatsapp: initial?.whatsapp || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es requerido.'); return; }
    setLoading(true);
    setError('');
    try {
      if (initial) {
        await updateCliente(initial.id, form);
      } else {
        await addCliente(form);
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
