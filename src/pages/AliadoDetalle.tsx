import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Landmark } from 'lucide-react';
import { useAliados } from '../hooks/useAliados';
import { useClientes } from '../hooks/useClientes';
import { useCarteras } from '../hooks/useCarteras';
import { useLiquidacionesAliado } from '../hooks/useLiquidacionesAliado';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { calcularParticipacion, etiquetaMes, mesDeFactura, sumarMes } from '../utils/participacionAliado';
import { esCarteraActiva } from '../utils/activo';

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function AliadoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { aliados, loading } = useAliados();
  const { clientes } = useClientes();
  const { carteras } = useCarteras();
  const { liquidaciones, loading: loadingLiq, marcarPagadas } = useLiquidacionesAliado();
  const hoy = new Date();
  const [mesSel, setMesSel] = useState(hoy.getMonth() + 1);
  const [anioSel, setAnioSel] = useState(hoy.getFullYear());
  const [marcando, setMarcando] = useState(false);

  const aliado = aliados.find(a => a.id === id);
  const referidos = useMemo(
    () => clientes.filter(c => c.aliadoId === id),
    [clientes, id],
  );

  const filasReferidos = useMemo(() => {
    return referidos.map(cliente => {
      const propias = carteras.filter(c => c.clienteId === cliente.id && esCarteraActiva(c));
      const valor = propias.reduce((s, c) => s + c.valorCartera, 0);
      const pct = cliente.porcentajeParticipacion || 0;
      return {
        cliente,
        carteras: propias.length,
        valor,
        participacion: calcularParticipacion(valor, pct),
      };
    });
  }, [referidos, carteras]);

  const delAliado = useMemo(
    () => liquidaciones.filter(l => l.aliadoId === id),
    [liquidaciones, id],
  );
  const facturado = delAliado.filter(l => {
    const f = mesDeFactura(l);
    return f.mes === mesSel && f.anio === anioSel;
  });
  const aPagar = delAliado.filter(l => l.mesPago === mesSel && l.anioPago === anioSel);
  const pendientesPago = aPagar.filter(l => l.estado !== 'Pagado');

  const irMes = (delta: number) => {
    const sig = sumarMes(mesSel, anioSel, delta);
    setMesSel(sig.mes);
    setAnioSel(sig.anio);
  };

  const marcar = async () => {
    setMarcando(true);
    try {
      await marcarPagadas(pendientesPago.map(l => l.id));
    } finally {
      setMarcando(false);
    }
  };

  if (loading || loadingLiq) return <LoadingSpinner />;
  if (!aliado) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">No se encontró el aliado.</p>
        <Link to="/aliados" className="text-indigo-600 text-sm mt-3 inline-block">Volver a aliados</Link>
      </div>
    );
  }

  const totalFacturado = facturado.reduce((s, l) => s + l.montoParticipacion, 0);
  const totalAPagar = aPagar.reduce((s, l) => s + l.montoParticipacion, 0);

  return (
    <div className="space-y-6">
      <Link to="/aliados" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium">
        <ArrowLeft size={16} /> Aliados
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 inline-flex px-2 py-0.5 rounded-lg">{aliado.codigo}</p>
            <h1 className="text-xl font-bold text-slate-800 mt-2">{aliado.nombre}</h1>
            <p className="text-sm text-slate-500 mt-2 flex items-start gap-1.5">
              <Landmark size={15} className="mt-0.5 text-slate-400 shrink-0" />
              <span>{aliado.bancoNombre} · {aliado.tipoCuenta} · {aliado.numeroCuenta}<br />Titular: {aliado.titular}</span>
            </p>
          </div>
          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 self-start">
            <button type="button" onClick={() => irMes(-1)} className="w-8 h-8 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center" aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800 min-w-[9rem] text-center">{MESES[mesSel - 1]} {anioSel}</span>
            <button type="button" onClick={() => irMes(1)} className="w-8 h-8 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center" aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-indigo-700">Facturado en {MESES[mesSel - 1]}</p>
            <p className="text-lg font-bold text-indigo-800 tabular-nums mt-1">{formatCOP(totalFacturado)}</p>
            <p className="text-[10px] text-slate-500 mt-1">Se paga del 1 al 5 de {etiquetaMes(sumarMes(mesSel, anioSel, 1).mes, sumarMes(mesSel, anioSel, 1).anio)}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">A pagar del 1 al 5</p>
            <p className="text-lg font-bold text-emerald-800 tabular-nums mt-1">{formatCOP(totalAPagar)}</p>
            {pendientesPago.length > 0 && (
              <button type="button" onClick={marcar} disabled={marcando} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-60">
                <CheckCircle2 size={13} /> {marcando ? 'Guardando...' : 'Marcar pagado'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-slate-800">Referidos</h2>
        {filasReferidos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Este aliado no tiene empresas asignadas.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="text-slate-500">Empresa</th>
                    <th className="text-slate-500">Cliente</th>
                    <th className="text-slate-500">%</th>
                    <th className="text-slate-500">Carteras</th>
                    <th className="text-slate-500">A cobrar</th>
                  </tr>
                </thead>
                <tbody>
                  {filasReferidos.map(fila => (
                    <tr key={fila.cliente.id} className="border-b border-slate-100">
                      <td className="font-semibold text-slate-800 text-sm">{fila.cliente.empresa || '—'}</td>
                      <td className="text-sm text-slate-600">{fila.cliente.nombre}</td>
                      <td className="text-sm font-semibold text-sky-700">{fila.cliente.porcentajeParticipacion || 0}%</td>
                      <td className="text-sm text-slate-600">{fila.carteras}</td>
                      <td className="text-sm font-bold text-sky-800 tabular-nums">{formatCOP(fila.participacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-slate-800">Facturado en {MESES[mesSel - 1]} {anioSel}</h2>
        {facturado.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No hay membresías facturadas este mes.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
            {facturado.map(item => (
              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.empresa || item.clienteNombre}</p>
                  <p className="text-[11px] text-slate-400">{item.carteraNombre} · {item.porcentaje}% de {formatCOP(item.montoRecibido)}</p>
                </div>
                <span className="font-bold text-indigo-700 tabular-nums">{formatCOP(item.montoParticipacion)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-slate-800">Pago del 1 al 5 de {MESES[mesSel - 1]} {anioSel}</h2>
        {aPagar.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Nada por transferir en estos primeros 5 días.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
            {aPagar.map(item => (
              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.empresa || item.clienteNombre}</p>
                  <p className="text-[11px] text-slate-400">
                    Facturado en {etiquetaMes(mesDeFactura(item).mes, mesDeFactura(item).anio)}
                    {item.estado === 'Pagado' ? ' · pagado' : ' · pendiente'}
                  </p>
                </div>
                <span className="font-bold text-emerald-700 tabular-nums">{formatCOP(item.montoParticipacion)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
