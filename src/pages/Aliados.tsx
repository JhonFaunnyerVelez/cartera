import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Handshake, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useAliados, type AliadoInput } from '../hooks/useAliados';
import { useClientes } from '../hooks/useClientes';
import { useLiquidacionesAliado } from '../hooks/useLiquidacionesAliado';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Aliado, TipoCuentaAliado } from '../types';
import { mesDeFactura, sumarMes } from '../utils/participacionAliado';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const emptyForm = (): AliadoInput => ({
  nombre: '',
  codigo: '',
  bancoNombre: '',
  tipoCuenta: 'Ahorros',
  numeroCuenta: '',
  titular: '',
  activo: true,
});

export default function Aliados() {
  const { aliados, loading, addAliado, updateAliado, deleteAliado } = useAliados();
  const { clientes } = useClientes();
  const { liquidaciones, loading: loadingLiq } = useLiquidacionesAliado();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Aliado | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const hoy = new Date();
  const [mesSel, setMesSel] = useState(hoy.getMonth() + 1);
  const [anioSel, setAnioSel] = useState(hoy.getFullYear());
  const [confirmDelete, setConfirmDelete] = useState<Aliado | null>(null);
  const [blocked, setBlocked] = useState('');

  const empresasPorAliado = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of clientes) {
      if (!c.aliadoId) continue;
      map[c.aliadoId] = (map[c.aliadoId] || 0) + 1;
    }
    return map;
  }, [clientes]);

  const facturadoMes = useMemo(
    () => liquidaciones.filter(l => {
      const f = mesDeFactura(l);
      return f.mes === mesSel && f.anio === anioSel;
    }),
    [liquidaciones, mesSel, anioSel],
  );
  const aPagarMes = useMemo(
    () => liquidaciones.filter(l => l.mesPago === mesSel && l.anioPago === anioSel),
    [liquidaciones, mesSel, anioSel],
  );

  const sumaPorAliado = (items: typeof facturadoMes) => {
    const map: Record<string, number> = {};
    for (const l of items) map[l.aliadoId] = (map[l.aliadoId] || 0) + l.montoParticipacion;
    return map;
  };
  const facturadoPorAliado = sumaPorAliado(facturadoMes);
  const aPagarPorAliado = sumaPorAliado(aPagarMes);

  const irMes = (delta: number) => {
    const sig = sumarMes(mesSel, anioSel, delta);
    setMesSel(sig.mes);
    setAnioSel(sig.anio);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
  };

  const openEdit = (a: Aliado) => {
    setEditing(a);
    setForm({
      nombre: a.nombre,
      codigo: a.codigo,
      bancoNombre: a.bancoNombre,
      tipoCuenta: a.tipoCuenta,
      numeroCuenta: a.numeroCuenta,
      titular: a.titular,
      activo: a.activo !== false,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = form.codigo.trim().toUpperCase();
    if (!form.nombre.trim() || !codigo) {
      setError('Nombre y código son obligatorios.');
      return;
    }
    if (!form.bancoNombre.trim() || !form.numeroCuenta.trim() || !form.titular.trim()) {
      setError('Completa el banco, la cuenta y el titular.');
      return;
    }
    const duplicado = aliados.find(a => a.codigo.toUpperCase() === codigo && a.id !== editing?.id);
    if (duplicado) {
      setError('Ya existe un aliado con ese código.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, codigo, nombre: form.nombre.trim() };
      if (editing) await updateAliado(editing.id, payload);
      else await addAliado(payload);
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el aliado.');
    } finally {
      setSaving(false);
    }
  };

  const pedirEliminar = (a: Aliado) => {
    const usadas = empresasPorAliado[a.id] || 0;
    if (usadas > 0) {
      setBlocked(`"${a.nombre}" tiene ${usadas} empresa${usadas === 1 ? '' : 's'} asignada${usadas === 1 ? '' : 's'}. Quita el aliado de esas empresas antes de eliminarlo.`);
      return;
    }
    setConfirmDelete(a);
  };

  if (loading || loadingLiq) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Handshake size={20} className="text-indigo-600" /> Aliados
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Entra al aliado para ver sus referidos, lo facturado y el pago de los primeros 5 días.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1">
            <button type="button" onClick={() => irMes(-1)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center" aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800 min-w-[9rem] text-center">{MESES[mesSel - 1]} {anioSel}</span>
            <button type="button" onClick={() => irMes(1)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center" aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
          >
            <Plus size={16} /> Nuevo aliado
          </button>
        </div>
      </div>

      {aliados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-14 text-center">
          <Handshake size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">Aún no hay aliados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-indigo-600 text-left">
                  <th className="text-white">Código</th>
                  <th className="text-white">Aliado</th>
                  <th className="text-white">Banco</th>
                  <th className="text-white">Referidos</th>
                  <th className="text-white">Facturado</th>
                  <th className="text-white">A pagar 1–5</th>
                  <th className="text-white text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {aliados.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-indigo-50/40">
                    <td>
                      <Link to={`/aliados/${a.id}`} className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                        {a.codigo}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/aliados/${a.id}`} className="font-semibold text-slate-800 text-sm hover:text-indigo-600">
                        {a.nombre}
                      </Link>
                    </td>
                    <td className="text-xs text-slate-600">
                      {a.bancoNombre}
                      <span className="block text-[10px] text-slate-400">{a.tipoCuenta} · {a.numeroCuenta}</span>
                    </td>
                    <td className="text-sm font-semibold text-slate-700">{empresasPorAliado[a.id] || 0}</td>
                    <td className="text-sm font-bold text-indigo-700 tabular-nums">{formatCOP(facturadoPorAliado[a.id] || 0)}</td>
                    <td className="text-sm font-bold text-emerald-700 tabular-nums">{formatCOP(aPagarPorAliado[a.id] || 0)}</td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <Link to={`/aliados/${a.id}`} className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center hover:bg-indigo-100" title="Ver detalle">
                          <Eye size={13} />
                        </Link>
                        <button type="button" onClick={() => openEdit(a)} className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center" title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => pedirEliminar(a)} className="w-7 h-7 rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50 flex items-center justify-center" title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar aliado' : 'Nuevo aliado'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input className={inputCls} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Ana Pérez" />
            </div>
            <div>
              <label className={labelCls}>Código *</label>
              <input className={inputCls} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="Ej: ALI-01" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Banco *</label>
            <input className={inputCls} value={form.bancoNombre} onChange={e => setForm(f => ({ ...f, bancoNombre: e.target.value }))} placeholder="Ej: Bancolombia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo de cuenta *</label>
              <select className={inputCls} value={form.tipoCuenta} onChange={e => setForm(f => ({ ...f, tipoCuenta: e.target.value as TipoCuentaAliado }))}>
                <option value="Ahorros">Ahorros</option>
                <option value="Corriente">Corriente</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Número *</label>
              <input className={inputCls} value={form.numeroCuenta} onChange={e => setForm(f => ({ ...f, numeroCuenta: e.target.value }))} placeholder="000-000000-00" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Titular *</label>
            <input className={inputCls} value={form.titular} onChange={e => setForm(f => ({ ...f, titular: e.target.value }))} placeholder="Nombre del titular" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) deleteAliado(confirmDelete.id); }}
        title="¿Eliminar aliado?"
        message={confirmDelete ? `Se eliminará a ${confirmDelete.nombre} (${confirmDelete.codigo}).` : ''}
        type="danger"
      />

      <ConfirmModal
        isOpen={!!blocked}
        onClose={() => setBlocked('')}
        onConfirm={() => setBlocked('')}
        title="No se puede eliminar"
        message={blocked}
        type="info"
        confirmText="Entendido"
      />
    </div>
  );
}
