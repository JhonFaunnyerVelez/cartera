import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface PuntoActivacionDia {
  dia: number;
  activadas: number;
  acumulado: number;
}

interface ActivacionesMesChartProps {
  puntos: PuntoActivacionDia[];
  mesLabel: string;
  anio: number;
  diaLimiteAcumulado: number;
  /** Día del mes equivalente a hoy (p. ej. 9), también en meses anteriores. */
  diaHoy: number;
  esMesVistaActual: boolean;
}

export default function ActivacionesMesChart({
  puntos,
  mesLabel,
  anio,
  diaLimiteAcumulado,
  diaHoy,
  esMesVistaActual,
}: ActivacionesMesChartProps) {
  const etiquetaDia = esMesVistaActual ? 'Hoy' : `Día ${diaHoy}`;
  const etiquetaChip = esMesVistaActual ? `Hoy · día ${diaHoy}` : `Como hoy · día ${diaHoy}`;
  const etiquetaAcumulado = esMesVistaActual
    ? 'Acumulado hasta hoy'
    : `Acumulado hasta día ${diaHoy}`;

  const data = puntos.map(p => ({
    ...p,
    acumuladoVista: p.dia <= diaLimiteAcumulado ? p.acumulado : null,
    esHoy: p.dia === diaHoy,
    esFuturo: p.dia > diaLimiteAcumulado,
  }));

  const totalMes = puntos.reduce((s, p) => s + p.activadas, 0);
  const acumuladoHoy = puntos.find(p => p.dia === diaLimiteAcumulado)?.acumulado
    ?? puntos.filter(p => p.dia <= diaLimiteAcumulado).at(-1)?.acumulado
    ?? 0;
  const activadasHoy = puntos.find(p => p.dia === diaHoy)?.activadas ?? 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Activaciones · {mesLabel} {anio}
          </p>
          <p className="text-sm font-semibold text-slate-800 mt-0.5">
            Carteras activadas por día
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1.5">
            <p className="text-[10px] font-bold uppercase text-indigo-700">Este mes</p>
            <p className="text-sm font-bold text-indigo-800 tabular-nums">{totalMes}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
            <p className="text-[10px] font-bold uppercase text-amber-800">{etiquetaChip}</p>
            <p className="text-sm font-bold text-amber-900 tabular-nums">
              {esMesVistaActual
                ? `${activadasHoy} nuevas`
                : `${acumuladoHoy} acumuladas`}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1.5">
            <p className="text-[10px] font-bold uppercase text-emerald-700">{etiquetaAcumulado}</p>
            <p className="text-sm font-bold text-emerald-800 tabular-nums">{acumuladoHoy}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-2 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Días anteriores
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> {etiquetaDia}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-200" /> Después del día {diaHoy}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded bg-emerald-500" /> {etiquetaAcumulado}
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval={4}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
              }}
              labelFormatter={(dia) => {
                const n = Number(dia);
                if (n === diaHoy) {
                  return esMesVistaActual ? `Hoy · día ${dia}` : `Como hoy · día ${dia}`;
                }
                return `Día ${dia}`;
              }}
              formatter={(value, name) => {
                const n = typeof value === 'number' ? value : Number(value ?? 0);
                if (name === 'activadas') return [n, 'Activadas del día'];
                if (name === 'acumuladoVista') return [n, 'Acumulado hasta ese día'];
                return [n, String(name)];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) =>
                value === 'activadas' ? 'Activadas del día' : etiquetaAcumulado
              }
            />

            <ReferenceLine
              x={diaHoy}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{
                value: etiquetaDia,
                position: 'top',
                fill: '#b45309',
                fontSize: 11,
                fontWeight: 700,
              }}
            />

            <Bar
              dataKey="activadas"
              name="activadas"
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
            >
              {data.map((entry) => (
                <Cell
                  key={`bar-${entry.dia}`}
                  fill={
                    entry.esHoy
                      ? '#f59e0b'
                      : entry.esFuturo
                      ? '#c7d2fe'
                      : '#6366f1'
                  }
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="acumuladoVista"
              name="acumuladoVista"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props as {
                  cx?: number;
                  cy?: number;
                  payload?: { esHoy?: boolean; dia?: number };
                };
                if (cx == null || cy == null) return null;
                const esHoy = payload?.esHoy;
                return (
                  <circle
                    key={`dot-${payload?.dia}`}
                    cx={cx}
                    cy={cy}
                    r={esHoy ? 5 : 2.5}
                    fill={esHoy ? '#f59e0b' : '#059669'}
                    stroke="#fff"
                    strokeWidth={esHoy ? 2 : 1}
                  />
                );
              }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
