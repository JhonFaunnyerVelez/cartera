import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CobroMensual } from '../types';
import {
  BadgePagoAnticipado,
  BadgeRecibioAdelanto,
  ValorConAdelanto,
  clasesFilaAdelanto,
  etiquetaMesRecibido,
} from '../components/carteras/AdelantoIndicators';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  TrendingUp,
  Download,
  CheckCircle2
} from 'lucide-react';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    maximumFractionDigits: 0 
  }).format(v);
}

function formatDate(ts: any) {
  if (!ts) return '—';
  // Si es un Timestamp de Firebase
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('es-CO', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function Recaudos() {
  const [recaudos, setRecaudos] = useState<CobroMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Consultar todos los cobros pagados, ordenados por fecha de pago descendente
    const q = query(
      collection(db, 'cobros_mensuales'),
      where('estado', '==', 'Pagado'),
      orderBy('fechaPago', 'desc'),
      limit(200) // Limitamos a los últimos 200 para rendimiento
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CobroMensual));
      setRecaudos(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching recaudos:', err);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return recaudos.filter(r => 
      r.clienteNombre?.toLowerCase().includes(s) || 
      r.carteraNombre?.toLowerCase().includes(s)
    );
  }, [recaudos, search]);

  const totalRecaudado = useMemo(() => {
    return filtered.reduce((acc, r) => {
      const realValor = r.esCortesia ? 0 : r.valorCobro;
      return acc + realValor + (r.montoAdelantado || 0);
    }, 0);
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Historial de Recaudos</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Registro cronológico de todos los pagos recibidos
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2">
            <TrendingUp size={16} />
            <div className="flex flex-col">
              <span className="text-[10px] opacity-80 uppercase font-bold tracking-wider leading-none">Total Visualizado</span>
              <span className="text-lg font-bold leading-tight">{formatCOP(totalRecaudado)}</span>
            </div>
          </div>
          <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm">
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por cliente o cartera..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-slate-100 transition">
            <Filter size={16} /> Filtros avanzados
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="text-slate-500">Fecha de Pago</th>
                <th className="text-slate-500">Cliente / Cartera</th>
                <th className="text-slate-500">Periodo</th>
                <th className="text-slate-500 text-right">Valor Recibido</th>
                <th className="text-slate-500">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Cargando historial...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No se encontraron recaudos.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const isAdelanto = (r.montoAdelantado || 0) > 0;
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50 transition group ${clasesFilaAdelanto(r)}`}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{formatDate(r.fechaPago)}</span>
                          <span className="text-[10px] text-slate-400">ID: {r.id.slice(-6)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                            <User size={12} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-800 truncate">{r.clienteNombre}</span>
                            <span className="text-[11px] text-slate-500 truncate">{r.carteraNombre}</span>
                            {r.esPagoAdelantado && (
                              <span className="mt-0.5"><BadgePagoAnticipado mesRecibido={etiquetaMesRecibido(r)} /></span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Calendar size={12} className="text-slate-400 flex-shrink-0" />
                          <span>{MESES[r.mes - 1]} {r.anio}</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <ValorConAdelanto
                          valorCobro={r.valorCobro}
                          montoAdelantado={r.montoAdelantado}
                          esCortesia={r.esCortesia}
                          esPagoAnticipadoFlag={r.esPagoAdelantado}
                          mesRecibido={etiquetaMesRecibido(r)}
                          alineacion="der"
                        />
                      </td>
                      <td>
                        {r.esPagoAdelantado ? (
                          <BadgePagoAnticipado mesRecibido={etiquetaMesRecibido(r)} />
                        ) : isAdelanto ? (
                          <BadgeRecibioAdelanto />
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 size={10} /> Mensual
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
