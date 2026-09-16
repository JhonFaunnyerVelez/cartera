import type { CobroMensual } from '../../types';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

/** Cobro de un mes futuro ya pagado en un mes anterior → no entra a la caja de ESTE mes. */
export function esPagoAnticipado(cobro: CobroMensual): boolean {
  return cobro.esPagoAdelantado === true;
}

/** En el mes donde se recibió el dinero, incluye valor por meses futuros pagados juntos. */
export function tieneAdelantoRecibido(cobro: CobroMensual): boolean {
  return (cobro.montoAdelantado || 0) > 0;
}

/** Suma a la caja del mes que estás viendo. */
export function sumaACajaMes(cobro: CobroMensual): number {
  if (cobro.estado !== 'Pagado' || cobro.esCortesia) return 0;
  if (esPagoAnticipado(cobro)) return 0;
  return cobro.valorCobro + (cobro.montoAdelantado || 0);
}

export function etiquetaMesRecibido(cobro: CobroMensual): string | null {
  if (!cobro.mesRecibido || !cobro.anioRecibido) return null;
  return `${MESES[cobro.mesRecibido - 1]} ${cobro.anioRecibido}`;
}

export function clasesFilaCortesia(cobro: CobroMensual): string {
  if (cobro.esCortesia) return 'border-l-4 border-l-violet-500 bg-violet-50/80';
  return '';
}

export function clasesFilaAdelanto(cobro: CobroMensual): string {
  if (cobro.esCortesia) return clasesFilaCortesia(cobro);
  if (esPagoAnticipado(cobro)) return 'border-l-4 border-l-sky-500 bg-sky-50/80';
  if (tieneAdelantoRecibido(cobro)) return 'border-l-4 border-l-emerald-500';
  return '';
}

/** Mes futuro ya pagado antes — NO suma a caja de este mes. */
export function BadgePagoAnticipado({ mesRecibido }: { mesRecibido?: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 whitespace-nowrap"
      title="El dinero ya entró a caja en otro mes. Este cobro solo marca el período como pagado."
    >
      ⏩ Pagado antes{mesRecibido ? ` · ${mesRecibido}` : ''}
    </span>
  );
}

/** En el mes actual se recibió dinero extra por meses futuros. */
export function BadgeRecibioAdelanto() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 whitespace-nowrap"
      title="Parte de este pago corresponde a meses futuros y sí suma a la caja de este mes."
    >
      💰 Pago con adelanto
    </span>
  );
}

/** @deprecated use BadgePagoAnticipado */
export const BadgePagoAdelantado = BadgePagoAnticipado;

export function MontoAdelantadoExtra({ monto, alineacion = 'izq' }: { monto: number; alineacion?: 'izq' | 'der' }) {
  return (
    <span
      className={`text-[10px] font-bold text-sky-900 bg-sky-100 border border-sky-300 px-1.5 py-0.5 rounded mt-0.5 w-fit ${
        alineacion === 'der' ? 'ml-auto' : ''
      }`}
      title="Dinero recibido HOY por meses futuros — suma a la caja de este mes"
    >
      + {formatCOP(monto)} adelanto (caja)
    </span>
  );
}

export function ValorConAdelanto({
  valorCobro,
  montoAdelantado,
  esCortesia,
  esPagoAnticipadoFlag,
  mesRecibido,
  alineacion = 'izq',
}: {
  valorCobro: number;
  montoAdelantado?: number | null;
  esCortesia?: boolean;
  esPagoAnticipadoFlag?: boolean;
  mesRecibido?: string | null;
  alineacion?: 'izq' | 'der';
}) {
  const extra = montoAdelantado || 0;
  const wrapCls = alineacion === 'der' ? 'flex flex-col items-end' : 'flex flex-col';

  if (esPagoAnticipadoFlag) {
    return (
      <div className={wrapCls}>
        <span className="font-bold text-sky-600 line-through decoration-sky-400/70">{formatCOP(valorCobro)}</span>
        <span className="text-[10px] font-semibold text-sky-700">
          Sin caja{mesRecibido ? ` · pagado en ${mesRecibido}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className={wrapCls}>
      <span className={`font-bold ${esCortesia ? 'text-violet-500 line-through decoration-violet-400/70' : 'text-emerald-600'}`}>
        {formatCOP(valorCobro)}
      </span>
      {esCortesia && (
        <span className="text-[10px] font-extrabold text-violet-700 uppercase tracking-tighter">Cortesía</span>
      )}
      {extra > 0 && <MontoAdelantadoExtra monto={extra} alineacion={alineacion} />}
    </div>
  );
}
