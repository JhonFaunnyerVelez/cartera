import {
  Coins, Sun, TrendingUp, Briefcase, DollarSign, Gem,
  Building, Wallet, PiggyBank, BarChart3, Landmark, Sparkles,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Coins,
  Sun,
  TrendingUp,
  Briefcase,
  DollarSign,
  Gem,
  Building,
  Wallet,
  PiggyBank,
  BarChart3,
  Landmark,
  Sparkles,
};

export function getInversionIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Coins;
}
