import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, Search, Users, ChevronRight,
  Building2, Globe, MapPin, Pencil, Trash2,
  Briefcase, DollarSign, Phone, ChevronUp, ChevronDown, ChevronsUpDown, Eye,
} from 'lucide-react';
import { useClientes } from '../hooks/useClientes';
import { useCarteras } from '../hooks/useCarteras';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import ClienteForm from '../components/clientes/ClienteForm';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Cliente } from '../types';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

const AVATAR_COLORS = [
  'bg-indigo-500','bg-violet-500','bg-rose-500','bg-amber-500',
  'bg-emerald-500','bg-sky-500','bg-pink-500','bg-teal-500',
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type SortKey = 'nombre' | 'empresa' | 'carteras' | 'valor';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={13} className="opacity-40" />;
  return dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
}

export default function Clientes() {
  const { clientes, loading: loadingClientes, deleteCliente } = useClientes();
  const { carteras, loading: loadingCarteras } = useCarteras();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Estado para el modal de confirmación bonito
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const carterasPorCliente = useMemo(() => {
    const map: Record<string, { count: number; total: number; nombres: string[] }> = {};
    for (const c of carteras) {
      if (!map[c.clienteId]) map[c.clienteId] = { count: 0, total: 0, nombres: [] };
      map[c.clienteId].count++;
      map[c.clienteId].total += c.valorCartera;
      if (c.nombre) map[c.clienteId].nombres.push(c.nombre);
    }
    return map;
  }, [carteras]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clientes
      .filter(c => [c.nombre, c.empresa, c.pais, c.ruta, c.whatsapp ?? ''].join(' ').toLowerCase().includes(q))
      .sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';
        if (sortKey === 'nombre')   { valA = a.nombre; valB = b.nombre; }
        if (sortKey === 'empresa')  { valA = a.empresa || ''; valB = b.empresa || ''; }
        if (sortKey === 'carteras') { valA = carterasPorCliente[a.id]?.count ?? 0; valB = carterasPorCliente[b.id]?.count ?? 0; }
        if (sortKey === 'valor')    { valA = carterasPorCliente[a.id]?.total ?? 0; valB = carterasPorCliente[b.id]?.total ?? 0; }
        if (typeof valA === 'string') {
          const cmp = valA.localeCompare(valB as string, 'es');
          return sortDir === 'asc' ? cmp : -cmp;
        }
        return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });
  }, [clientes, search, sortKey, sortDir, carterasPorCliente]);

  const openNewModal  = () => { setEditingCliente(null); setIsModalOpen(true); };
  const openEditModal = (c: Cliente) => { setEditingCliente(c); setIsModalOpen(true); };
  const closeModal    = () => { setIsModalOpen(false); setEditingCliente(null); };
  const handleDelete  = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '¿Eliminar cliente?',
      message: 'Esta acción borrará al cliente y TODAS sus carteras asociadas. No se puede deshacer.',
      type: 'danger',
      onConfirm: async () => {
        setDeletingId(id);
        try { await deleteCliente(id); } finally { setDeletingId(null); }
      }
    });
  };

  if (loadingClientes || loadingCarteras) return <LoadingSpinner />;

  const totalValor = carteras.reduce((s, c) => s + c.valorCartera, 0);

  // Helper para el th ordenable
  const Th = ({ label, col, center }: { label: string; col: SortKey; center?: boolean }) => (
    <th
      onClick={() => handleSort(col)}
      className={`text-white cursor-pointer select-none hover:bg-indigo-700 transition ${center ? 'text-center' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label} <SortIcon col={col} active={sortKey === col} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Clientes</h2>
          <p className="text-slate-500 text-sm mt-1">
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} ·{' '}
            {carteras.length} cartera{carteras.length !== 1 ? 's' : ''} ·{' '}
            <span className="font-semibold text-indigo-600">{formatCOP(totalValor)}/mes</span>
          </p>
        </div>
        <button onClick={openNewModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
          <UserPlus size={16} /> Nuevo Cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, empresa, país, ruta o WhatsApp..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            {search ? 'No se encontraron resultados' : 'Aún no hay clientes registrados'}
          </p>
          {!search && (
            <button onClick={openNewModal} className="mt-4 text-indigo-600 text-sm font-medium hover:underline">
              Agregar el primer cliente →
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-indigo-600 text-left">
                  <Th label="Cliente"   col="nombre" />
                  <Th label="Empresa"   col="empresa" />
                  <Th label="Carteras"  col="carteras" />
                  <Th label="Valor/mes" col="valor" />
                  <th className="text-white text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cliente, idx) => {
                  const info = carterasPorCliente[cliente.id] ?? { count: 0, total: 0, nombres: [] };
                  return (
                    <tr key={cliente.id}
                      className={`border-b border-slate-100 transition group hover:bg-indigo-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>

                      {/* Nombre */}
                      <td>
                        <Link to={`/clientes/${cliente.id}`} className="flex items-center gap-2 group/name">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm ${avatarColor(cliente.nombre)}`}>
                            {cliente.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm group-hover/name:text-indigo-600 transition leading-tight">
                              {cliente.nombre}
                            </p>
                            <span className="text-slate-400 text-xs flex items-center gap-0.5 mt-0.5">
                              Ver detalle <ChevronRight size={11} className="opacity-0 group-hover/name:opacity-100 transition" />
                            </span>
                          </div>
                        </Link>
                      </td>

                      {/* Contacto */}
                      <td>
                        <div className="space-y-0.5">
                          {cliente.empresa && (
                            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-medium">
                              <Building2 size={11} className="text-slate-400" /> {cliente.empresa}
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {cliente.pais && (
                              <span className="flex items-center gap-1 text-slate-500 text-xs">
                                <Globe size={10} className="text-slate-400" /> {cliente.pais}
                              </span>
                            )}
                            {cliente.ruta && (
                              <span className="flex items-center gap-1 text-slate-500 text-xs">
                                <MapPin size={10} className="text-slate-400" /> {cliente.ruta}
                              </span>
                            )}
                          </div>
                          {cliente.whatsapp && (
                            <a href={`https://wa.me/${cliente.whatsapp.replace(/\D/g, '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                              <Phone size={11} /> {cliente.whatsapp}
                            </a>
                          )}
                          {!cliente.empresa && !cliente.pais && !cliente.ruta && !cliente.whatsapp && (
                            <span className="text-slate-300 text-xs italic">Sin info</span>
                          )}
                        </div>
                      </td>

                      {/* Carteras */}
                      <td>
                        {info.count === 0 ? (
                          <span className="text-slate-300 text-xs italic">Sin carteras</span>
                        ) : (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Briefcase size={12} className="text-indigo-400" />
                              <span className="text-slate-700 text-xs font-semibold">
                                {info.count} cartera{info.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {info.nombres.map(n => (
                                <span key={n} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-xs font-medium">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td>
                        {info.total > 0 ? (
                          <div className="flex items-center gap-1">
                            <DollarSign size={12} className="text-emerald-500 flex-shrink-0" />
                            <span className="font-bold text-emerald-700 text-sm">{formatCOP(info.total)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td>
                        <div className="flex items-center gap-1">
                          <Link to={`/clientes/${cliente.id}`}
                            className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center hover:bg-indigo-100 transition-all"
                            title="Ver detalles"
                          >
                            <Eye size={13} />
                          </Link>
                          <button onClick={() => openEditModal(cliente)}
                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-all"
                            title="Editar cliente"
                          >
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(cliente.id)} disabled={deletingId === cliente.id}
                            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 border border-rose-100 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-all disabled:opacity-50"
                            title="Eliminar cliente"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}>
        <ClienteForm onClose={closeModal} initial={editingCliente} />
      </Modal>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />
    </div>
  );
}
