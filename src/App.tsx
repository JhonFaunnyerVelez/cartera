import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import ClienteDetalle from './pages/ClienteDetalle';
import Carteras from './pages/Carteras';
import Recaudos from './pages/Recaudos';
import Aliados from './pages/Aliados';
import AliadoDetalle from './pages/AliadoDetalle';
import InversionPage from './pages/InversionPage';
import AdminInversiones from './pages/AdminInversiones';
import DashboardGeneral from './pages/DashboardGeneral';
import LoadingSpinner from './components/ui/LoadingSpinner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard-general" element={<DashboardGeneral />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/:id" element={<ClienteDetalle />} />
        <Route path="/carteras" element={<Carteras />} />
        <Route path="/aliados" element={<Aliados />} />
        <Route path="/aliados/:id" element={<AliadoDetalle />} />
        <Route path="/recaudos" element={<Recaudos />} />
        <Route path="/inversiones/:slug" element={<InversionPage />} />
        <Route path="/admin/inversiones" element={<AdminInversiones />} />
        {/* Rutas legacy → redirección */}
        <Route path="/inversion-oro" element={<Navigate to="/inversiones/oro" replace />} />
        <Route path="/sueldo-cosolar" element={<Navigate to="/inversiones/cosolar" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
