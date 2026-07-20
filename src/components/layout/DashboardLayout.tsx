import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { LayoutProvider, useLayout } from '../../context/LayoutContext';

function LayoutShell() {
  const { sidebarCollapsed, mobileMenuOpen, closeMobileMenu } = useLayout();

  return (
    <div className="flex h-full min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <div
        className={`hidden lg:block fixed left-0 top-0 h-full z-30 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[4.75rem]' : 'w-64'
        }`}
      >
        <Sidebar variant="desktop" />
      </div>

      {/* Sidebar mobile drawer */}
      <div className="lg:hidden" aria-hidden={!mobileMenuOpen}>
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={mobileMenuOpen ? 0 : -1}
          className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ease-out ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={closeMobileMenu}
        />
        <div
          className={`fixed left-0 top-0 h-full z-50 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
        >
          <Sidebar variant="mobile" />
        </div>
      </div>

      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-[margin] duration-200 ${
          sidebarCollapsed ? 'lg:ml-[4.75rem]' : 'lg:ml-64'
        }`}
      >
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <LayoutProvider>
      <LayoutShell />
    </LayoutProvider>
  );
}
