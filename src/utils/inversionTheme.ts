import type { InversionColorName } from '../types';

export interface InversionTheme {
  gradientFrom: string;
  gradientTo: string;
  shadow: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  borderLight: string;
  ring: string;
  badgeBg: string;
  badgeText: string;
  rowHighlight: string;
  navHover: string;
  text: string;
  textDark: string;
  iconBg: string;
  iconColor: string;
}

export const INVERSION_THEMES: Record<InversionColorName, InversionTheme> = {
  amber: {
    gradientFrom: 'from-amber-600',
    gradientTo: 'to-amber-700',
    shadow: 'shadow-amber-200',
    textMuted: 'text-amber-200',
    primary: 'bg-amber-600',
    primaryHover: 'hover:bg-amber-700',
    borderLight: 'border-amber-100',
    ring: 'focus:ring-amber-300',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    rowHighlight: 'bg-amber-50/60',
    navHover: 'hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600',
    text: 'text-amber-600',
    textDark: 'text-amber-700',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  sky: {
    gradientFrom: 'from-sky-600',
    gradientTo: 'to-sky-700',
    shadow: 'shadow-sky-200',
    textMuted: 'text-sky-200',
    primary: 'bg-sky-600',
    primaryHover: 'hover:bg-sky-700',
    borderLight: 'border-sky-100',
    ring: 'focus:ring-sky-300',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    rowHighlight: 'bg-sky-50/60',
    navHover: 'hover:bg-sky-50 hover:border-sky-300 hover:text-sky-600',
    text: 'text-sky-600',
    textDark: 'text-sky-700',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  emerald: {
    gradientFrom: 'from-emerald-600',
    gradientTo: 'to-emerald-700',
    shadow: 'shadow-emerald-200',
    textMuted: 'text-emerald-200',
    primary: 'bg-emerald-600',
    primaryHover: 'hover:bg-emerald-700',
    borderLight: 'border-emerald-100',
    ring: 'focus:ring-emerald-300',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    rowHighlight: 'bg-emerald-50/60',
    navHover: 'hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600',
    text: 'text-emerald-600',
    textDark: 'text-emerald-700',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  violet: {
    gradientFrom: 'from-violet-600',
    gradientTo: 'to-violet-700',
    shadow: 'shadow-violet-200',
    textMuted: 'text-violet-200',
    primary: 'bg-violet-600',
    primaryHover: 'hover:bg-violet-700',
    borderLight: 'border-violet-100',
    ring: 'focus:ring-violet-300',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    rowHighlight: 'bg-violet-50/60',
    navHover: 'hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600',
    text: 'text-violet-600',
    textDark: 'text-violet-700',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  rose: {
    gradientFrom: 'from-rose-600',
    gradientTo: 'to-rose-700',
    shadow: 'shadow-rose-200',
    textMuted: 'text-rose-200',
    primary: 'bg-rose-600',
    primaryHover: 'hover:bg-rose-700',
    borderLight: 'border-rose-100',
    ring: 'focus:ring-rose-300',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    rowHighlight: 'bg-rose-50/60',
    navHover: 'hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600',
    text: 'text-rose-600',
    textDark: 'text-rose-700',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  orange: {
    gradientFrom: 'from-orange-600',
    gradientTo: 'to-orange-700',
    shadow: 'shadow-orange-200',
    textMuted: 'text-orange-200',
    primary: 'bg-orange-600',
    primaryHover: 'hover:bg-orange-700',
    borderLight: 'border-orange-100',
    ring: 'focus:ring-orange-300',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    rowHighlight: 'bg-orange-50/60',
    navHover: 'hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600',
    text: 'text-orange-600',
    textDark: 'text-orange-700',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  teal: {
    gradientFrom: 'from-teal-600',
    gradientTo: 'to-teal-700',
    shadow: 'shadow-teal-200',
    textMuted: 'text-teal-200',
    primary: 'bg-teal-600',
    primaryHover: 'hover:bg-teal-700',
    borderLight: 'border-teal-100',
    ring: 'focus:ring-teal-300',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
    rowHighlight: 'bg-teal-50/60',
    navHover: 'hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600',
    text: 'text-teal-600',
    textDark: 'text-teal-700',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
  indigo: {
    gradientFrom: 'from-indigo-600',
    gradientTo: 'to-indigo-700',
    shadow: 'shadow-indigo-200',
    textMuted: 'text-indigo-200',
    primary: 'bg-indigo-600',
    primaryHover: 'hover:bg-indigo-700',
    borderLight: 'border-indigo-100',
    ring: 'focus:ring-indigo-300',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
    rowHighlight: 'bg-indigo-50/60',
    navHover: 'hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600',
    text: 'text-indigo-600',
    textDark: 'text-indigo-700',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
};

export const INVERSION_COLOR_OPTIONS: { value: InversionColorName; label: string }[] = [
  { value: 'amber', label: 'Ámbar' },
  { value: 'sky', label: 'Cielo' },
  { value: 'emerald', label: 'Esmeralda' },
  { value: 'violet', label: 'Violeta' },
  { value: 'rose', label: 'Rosa' },
  { value: 'orange', label: 'Naranja' },
  { value: 'teal', label: 'Teal' },
  { value: 'indigo', label: 'Índigo' },
];

export function getInversionTheme(color: InversionColorName): InversionTheme {
  return INVERSION_THEMES[color] ?? INVERSION_THEMES.amber;
}

export function slugifyInversion(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
