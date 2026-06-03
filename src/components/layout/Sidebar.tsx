import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, LogOut, ChevronRight, CalendarClock, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/carteras', label: 'Carteras', icon: Briefcase },
  { to: '/recaudos', label: 'Recaudos', icon: TrendingUp },
  { to: '/cierres', label: 'Cierres Mensuales', icon: CalendarClock },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-20"
      style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)' }}>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg">
            <Briefcase size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-none">CartéraApp</h1>
            <p className="text-indigo-300 text-xs mt-0.5">Gestión de Clientes</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
          Menú principal
        </p>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
            <ChevronRight size={14} className="ml-auto opacity-50" />
          </NavLink>
        ))}
      </nav>

      {/* User Info + Logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          {user?.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ''} className="w-9 h-9 rounded-full ring-2 ring-indigo-400" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.displayName || 'Usuario'}</p>
            <p className="text-indigo-300 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="w-full sidebar-link text-rose-300 hover:bg-rose-500/20 hover:text-rose-200">
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
