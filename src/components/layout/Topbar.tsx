import { useLocation } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { useInversiones } from '../../hooks/useInversiones';

const staticTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard-general': 'Dashboard General',
  '/clientes': 'Gestión de Clientes',
  '/carteras': 'Cobros del Mes',
  '/aliados': 'Aliados',
  '/recaudos': 'Recaudos',
  '/admin/inversiones': 'Administración — Inversiones',
};

export default function Topbar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { setMobileMenuOpen } = useLayout();
  const { inversiones } = useInversiones();

  let title = staticTitles[pathname];

  if (!title && pathname.startsWith('/inversiones/')) {
    const slug = pathname.split('/')[2];
    const inv = inversiones.find(i => i.slug === slug);
    title = inv?.nombre || 'Inversión';
  }

  if (!title && pathname.startsWith('/aliados/')) title = 'Detalle del aliado';

  if (!title) {
    title = pathname.startsWith('/clientes/') ? 'Detalle del Cliente' : 'CartéraApp';
  }

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-20 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 shrink-0"
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h2 className="text-slate-800 font-semibold text-base sm:text-lg truncate">{title}</h2>
          <p className="text-slate-400 text-[10px] sm:text-xs truncate hidden xs:block sm:block">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 transition flex items-center justify-center text-slate-500">
          <Bell size={16} />
        </button>
        {user?.photoURL && (
          <img src={user.photoURL} alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-indigo-200" />
        )}
      </div>
    </header>
  );
}
