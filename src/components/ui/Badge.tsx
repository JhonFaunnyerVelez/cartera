import type { EstadoCartera } from '../../types';

interface BadgeProps {
  estado: EstadoCartera;
}

const config: Record<EstadoCartera, { label: string; classes: string; dot: string }> = {
  'Al día': {
    label: 'Al día',
    classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
  },
  'Próximo a vencer': {
    label: 'Próximo a vencer',
    classes: 'bg-amber-100 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
  },
  Mora: {
    label: 'En mora',
    classes: 'bg-rose-100 text-rose-700 border border-rose-200',
    dot: 'bg-rose-500',
  },
};

export default function Badge({ estado }: BadgeProps) {
  const { label, classes, dot } = config[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
