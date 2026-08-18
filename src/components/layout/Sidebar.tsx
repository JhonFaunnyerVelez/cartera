import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, LogOut, ChevronRight,
  TrendingUp, PanelLeftClose, PanelLeftOpen, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/carteras', label: 'Carteras', icon: Briefcase },
  { to: '/recaudos', label: 'Recaudos', icon: TrendingUp },
];

interface SidebarProps {
  variant: 'desktop' | 'mobile';
}

export default function Sidebar({ variant }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebarCollapsed, closeMobileMenu } = useLayout();
  const collapsed = variant === 'desktop' && sidebarCollapsed;
  const isMobile = variant === 'mobile';

  const handleSignOut = async () => {
    closeMobileMenu();
    await signOut();
    navigate('/login');
  };

  const navCls = collapsed
    ? 'justify-center px-0 py-2.5'
    : '';

  return (
    <aside
      className={`flex flex-col h-full shrink-0 transition-[width] duration-200 ease-out ${
        isMobile ? 'w-72' : collapsed ? 'w-[4.75rem]' : 'w-64'
      }`}
      style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)' }}
    >
      {/* Logo */}
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

      {/* Navigation */}
      <nav className={`flex-1 py-5 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && (
          <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
            Menú principal
          </p>
        )}
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${navCls}`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && (
              <>
                <span className="truncate">{label}</span>
                <ChevronRight size={14} className="ml-auto opacity-50 shrink-0" />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle — solo desktop */}
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

      {/* User Info + Logout */}
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
