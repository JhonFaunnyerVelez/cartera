import { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, LogOut, ChevronRight,
  TrendingUp, PanelLeftClose, PanelLeftOpen, X, PieChart, Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { useInversiones } from '../../hooks/useInversiones';
import { getInversionIcon } from '../../utils/inversionIcons';
import type { LucideIcon } from 'lucide-react';

type MenuItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
type MenuBlock = { title: string; items: MenuItem[] };

const staticBlocks: MenuBlock[] = [
  {
    title: 'General',
    items: [
      { to: '/dashboard-general', label: 'Dashboard General', icon: PieChart },
    ],
  },
  {
    title: 'CartéraApp',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/carteras', label: 'Carteras', icon: Briefcase },
      { to: '/recaudos', label: 'Recaudos', icon: TrendingUp },
    ],
  },
];

interface SidebarProps {
  variant: 'desktop' | 'mobile';
}

export default function Sidebar({ variant }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebarCollapsed, closeMobileMenu } = useLayout();
  const { activas: inversiones } = useInversiones();
  const collapsed = variant === 'desktop' && sidebarCollapsed;
  const isMobile = variant === 'mobile';

  const handleSignOut = async () => {
    closeMobileMenu();
    await signOut();
    navigate('/login');
  };

  const navCls = collapsed ? 'justify-center px-0 py-2.5' : '';

  const menuBlocks = useMemo(() => {
    const blocks: MenuBlock[] = [...staticBlocks];

    if (inversiones.length > 0) {
      blocks.push({
        title: 'Inversiones',
        items: inversiones.map(inv => ({
          to: `/inversiones/${inv.slug}`,
          label: inv.nombre,
          icon: getInversionIcon(inv.icon),
        })),
      });
    }

    blocks.push({
      title: 'Administración',
      items: [
        { to: '/admin/inversiones', label: 'Configurar inversiones', icon: Settings },
      ],
    });

    return blocks;
  }, [inversiones]);

  return (
    <aside
      className={`flex flex-col h-full shrink-0 transition-[width] duration-200 ease-out ${
        isMobile ? 'w-72' : collapsed ? 'w-[4.75rem]' : 'w-64'
      }`}
      style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)' }}
    >
      <div className={`border-b border-white/10 flex items-center ${collapsed ? 'px-3 py-4 justify-center' : 'px-5 py-5 justify-between gap-2'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'min-w-0'}`}>
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shrink-0">
            <Briefcase size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-white font-bold text-base leading-none truncate">CartéraApp</h1>
              <p className="text-indigo-300 text-xs mt-0.5 truncate">Gestión de Clientes</p>
            </div>
          )}
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={closeMobileMenu}
            className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-indigo-200"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className={`flex-1 py-5 overflow-y-auto ${collapsed ? 'px-2 space-y-3' : 'px-3 space-y-5'}`}>
        {menuBlocks.map((block, blockIdx) => (
          <div key={`${block.title}-${blockIdx}`}>
            {blockIdx > 0 && (
              <div className={`${collapsed ? 'my-2 mx-1' : 'mb-3 mt-1'} border-t border-white/10`} />
            )}
            {!collapsed && (
              <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
                {block.title}
              </p>
            )}
            <div className="space-y-1">
              {block.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''} ${navCls}`
                  }
                >
                  <item.icon size={18} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      <ChevronRight size={14} className="ml-auto opacity-50 shrink-0" />
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!isMobile && (
        <div className={`px-3 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={`sidebar-link w-full text-indigo-200 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Colapsar menú</span>}
          </button>
        </div>
      )}

      <div className={`border-t border-white/10 ${collapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 min-w-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-9 h-9 rounded-full ring-2 ring-indigo-400 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.displayName || 'Usuario'}</p>
              <p className="text-indigo-300 text-xs truncate">{user?.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-2" title={user?.displayName || 'Usuario'}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full ring-2 ring-indigo-400" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleSignOut}
          title="Cerrar sesión"
          className={`sidebar-link text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 w-full ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
