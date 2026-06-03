import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: 'indigo' | 'emerald' | 'rose' | 'amber';
  trend?: { value: string; positive: boolean };
}

const colorMap = {
  indigo: {
    bg: 'bg-indigo-50',
    icon: 'bg-indigo-100 text-indigo-600',
    title: 'text-indigo-600',
    border: 'border-indigo-100',
  },
  emerald: {
    bg: 'bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-600',
    title: 'text-emerald-600',
    border: 'border-emerald-100',
  },
  rose: {
    bg: 'bg-rose-50',
    icon: 'bg-rose-100 text-rose-600',
    title: 'text-rose-600',
    border: 'border-rose-100',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-100 text-amber-600',
    title: 'text-amber-600',
    border: 'border-amber-100',
  },
};

export default function StatCard({ title, value, subtitle, icon: Icon, color, trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border ${c.border} flex items-start gap-4 hover:shadow-md transition-shadow`}>
      <div className={`w-12 h-12 rounded-xl ${c.icon} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${c.title} mb-1`}>{title}</p>
        <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        {trend && (
          <span className={`inline-flex items-center text-xs mt-1 font-medium ${trend.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend.positive ? '▲' : '▼'} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
