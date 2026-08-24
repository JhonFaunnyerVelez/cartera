import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Settings, ExternalLink } from 'lucide-react';
import { useInversiones } from '../hooks/useInversiones';
import { useAllMovimientosInversiones } from '../hooks/useMovimientosInversion';
import type { InversionColorName, InversionConfig, InversionLabels } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { INVERSION_COLOR_OPTIONS } from '../utils/inversionTheme';
import { DEFAULT_INVERSION_LABELS, INVERSION_ICON_OPTIONS } from '../constants/inversionesDefault';
import { getInversionTheme, slugifyInversion } from '../utils/inversionTheme';
import { getInversionIcon } from '../utils/inversionIcons';
import { contarMovimientosPorInversion, inversionTieneMovimientos } from '../services/inversionMovimientos';

const emptyForm = (): Omit<InversionConfig, 'id'> & { id?: string } => ({
  slug: '',
  nombre: '',
  descripcion: '',
  color: 'amber',
  icon: 'Coins',
  orden: 99,
  activo: true,
  labels: { ...DEFAULT_INVERSION_LABELS },
});

export default function AdminInversiones() {
  const { inversiones, loading, guardarInversion, eliminarInversion } = useInversiones();
  const { movimientos, loading: loadingMov } = useAllMovimientosInversiones();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<InversionConfig | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<{ nombre: string; cantidad: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pendingDeleteRef = useRef<InversionConfig | null>(null);

  const movimientosPorInversion = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of inversiones) {
      map[inv.id] = contarMovimientosPorInversion(inv.id, movimientos);
    }
    return map;
  }, [inversiones, movimientos]);

  const openCreate = () => {
    setForm(emptyForm());
    setIsEditing(false);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (inv: InversionConfig) => {
    setForm({ ...inv, labels: { ...DEFAULT_INVERSION_LABELS, ...inv.labels } });
    setIsEditing(true);
    setError('');
    setModalOpen(true);
  };

  const updateLabel = (key: keyof InversionLabels, value: string) => {
    setForm(prev => ({ ...prev, labels: { ...prev.labels, [key]: value } }));
  };

  const handleSave = async () => {
    const nombre = form.nombre.trim();
    if (!nombre) {
      setError('El nombre es requerido.');
      return;
    }

    const slug = (form.slug || slugifyInversion(nombre)).trim();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('El identificador solo puede tener letras minúsculas, números y guiones.');
      return;
    }

    const id = isEditing ? (form.id || slug) : slug;
    const duplicado = inversiones.find(i => i.slug === slug && i.id !== id);
    if (duplicado) {
      setError('Ya existe una inversión con ese identificador.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const data: InversionConfig = {
        id,
        slug,
        nombre,
        descripcion: form.descripcion.trim(),
        color: form.color,
        icon: form.icon,
        orden: form.orden,
        activo: form.activo,
        labels: form.labels,
      };
      await guardarInversion(data);
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (inv: InversionConfig) => {
    const cantidad = movimientosPorInversion[inv.id] ?? 0;
    if (cantidad > 0) {
      setBlockedDelete({ nombre: inv.nombre, cantidad });
      return;
    }
    pendingDeleteRef.current = inv;
    setConfirmDelete(inv);
  };

  const handleDelete = async () => {
    const inv = pendingDeleteRef.current;
    if (!inv) return;

    setDeleting(true);
    try {
      const tiene = await inversionTieneMovimientos(inv);
      if (tiene) {
        pendingDeleteRef.current = null;
        setConfirmDelete(null);
        setBlockedDelete({
          nombre: inv.nombre,
          cantidad: movimientosPorInversion[inv.id] ?? 1,
        });
        return;
      }
      await eliminarInversion(inv.id);
      pendingDeleteRef.current = null;
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading || loadingMov) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-slate-500 text-sm">
            Configura las inversiones que aparecen en el menú. Cada una tiene su propia página de movimientos.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shrink-0"
        >
          <Plus size={16} /> Nueva inversión
        </button>
      </div>

      <div className="grid gap-4">
        {inversiones.map(inv => {
          const theme = getInversionTheme(inv.color);
          const Icon = getInversionIcon(inv.icon);
          const cantidadMov = movimientosPorInversion[inv.id] ?? 0;
          const puedeEliminar = cantidadMov === 0;
          return (
            <div key={inv.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${theme.primary} flex items-center justify-center shrink-0`}>
                <Icon size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-800">{inv.nombre}</h3>
                  {!inv.activo && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">Inactiva</span>
                  )}
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Orden {inv.orden}</span>
                </div>
                {inv.descripcion && <p className="text-slate-500 text-sm mt-0.5">{inv.descripcion}</p>}
                <p className="text-slate-400 text-xs mt-1">/inversiones/{inv.slug}</p>
                {cantidadMov > 0 && (
                  <p className="text-amber-600 text-xs mt-1 font-medium">
                    {cantidadMov} movimiento{cantidadMov !== 1 ? 's' : ''} registrado{cantidadMov !== 1 ? 's' : ''} — no se puede eliminar
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {inv.activo && (
                  <Link
                    to={`/inversiones/${inv.slug}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    <ExternalLink size={14} /> Ver
                  </Link>
                )}
                <button
                  onClick={() => openEdit(inv)}
                  className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => requestDelete(inv)}
                  disabled={!puedeEliminar}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                    puedeEliminar
                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                  title={puedeEliminar ? 'Eliminar' : 'No se puede eliminar: tiene movimientos registrados'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}

        {inversiones.length === 0 && (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-100">
            <Settings size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No hay inversiones configuradas.</p>
            <button onClick={openCreate} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">
              Crear la primera
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? 'Editar inversión' : 'Nueva inversión'}
        size="md"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {error && (
            <div className="px-3 py-2 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre *</label>
            <input
              value={form.nombre}
              onChange={e => setForm(prev => ({
                ...prev,
                nombre: e.target.value,
                slug: isEditing ? prev.slug : slugifyInversion(e.target.value),
              }))}
              placeholder="Ej. Inversión Oro"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Identificador (URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">/inversiones/</span>
              <input
                value={form.slug}
                onChange={e => setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                disabled={isEditing}
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Color</label>
              <select
                value={form.color}
                onChange={e => setForm(prev => ({ ...prev, color: e.target.value as InversionColorName }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {INVERSION_COLOR_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Icono</label>
              <select
                value={form.icon}
                onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {INVERSION_ICON_OPTIONS.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Orden en menú</label>
              <input
                type="number"
                min={1}
                value={form.orden}
                onChange={e => setForm(prev => ({ ...prev, orden: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={e => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                />
                <span className="text-sm text-slate-700 font-medium">Activa en menú</span>
              </label>
            </div>
          </div>

          <details className="border border-slate-200 rounded-xl overflow-hidden">
            <summary className="px-4 py-3 text-sm font-semibold text-slate-700 cursor-pointer bg-slate-50">
              Textos personalizados (opcional)
            </summary>
            <div className="p-4 space-y-3 border-t border-slate-100">
              {([
                ['balanceNeto', 'Etiqueta balance neto'],
                ['ingresosTitulo', 'Título sección ingresos'],
                ['gastosTitulo', 'Título sección gastos'],
                ['ingresoPlaceholder', 'Placeholder ingreso'],
                ['gastoPlaceholder', 'Placeholder gasto'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                  <input
                    value={form.labels[key]}
                    onChange={e => updateLabel(key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              ))}
            </div>
          </details>

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60"
            >
              {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="¿Eliminar inversión?"
        message={`Se eliminará la configuración de "${confirmDelete?.nombre}". Solo puedes hacer esto si no tiene movimientos registrados.`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        type="danger"
      />

      <ConfirmModal
        isOpen={!!blockedDelete}
        onClose={() => setBlockedDelete(null)}
        onConfirm={() => setBlockedDelete(null)}
        title="No se puede eliminar"
        message={`"${blockedDelete?.nombre}" tiene ${blockedDelete?.cantidad} movimiento${blockedDelete?.cantidad !== 1 ? 's' : ''} registrado${blockedDelete?.cantidad !== 1 ? 's' : ''}. Desactívala en su lugar para ocultarla del menú.`}
        confirmText="Entendido"
        cancelText="Cerrar"
        type="info"
      />
    </div>
  );
}
