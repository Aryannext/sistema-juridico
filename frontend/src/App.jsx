import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerificacionPage from './pages/auth/VerificacionPage';
import TwoFactorPage from './pages/auth/TwoFactorPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardIndex from './pages/dashboard/DashboardIndex';
import ClientesList from './pages/clientes/ClientesList';
import ClienteFicha from './pages/clientes/ClienteFicha';
import ProcesosList from './pages/procesos/ProcesosList';
import ProcesoDetalle from './pages/procesos/ProcesoDetalle';
import AuditoriaList from './pages/auditoria/AuditoriaList';
import AjustesPage from './pages/admin/AjustesPage';
import UsuariosPage from './pages/admin/UsuariosPage';
import ReportesPage from './pages/admin/ReportesPage';

// Client Portal Pages
import PortalLayout from './components/layout/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalProcesoDetalle from './pages/portal/PortalProcesoDetalle';
import PortalAjustes from './pages/portal/PortalAjustes';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    if (user.rol === 'CLIENTE') {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return user.rol === 'CLIENTE' ? <Navigate to="/portal" replace /> : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router basename="/sistema-juridico">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/verificacion" element={<VerificacionPage />} />
          <Route path="/2fa" element={<TwoFactorPage />} />
          
          {/* Admin & Lawyer Protected Routes */}
          <Route 
            element={
              <ProtectedRoute allowedRoles={['ADMINISTRADOR', 'ABOGADO', 'ASISTENTE']}>
                <DashboardLayout />
              </ProtectedRoute>
            } 
          >
            <Route path="/dashboard" element={<DashboardIndex />} />
            <Route path="/clientes" element={<ClientesList />} />
            <Route path="/clientes/:id" element={<ClienteFicha />} />
            <Route path="/procesos" element={<ProcesosList />} />
            <Route path="/procesos/:id" element={<ProcesoDetalle />} />
            <Route path="/auditoria" element={<AuditoriaList />} />
            <Route path="/admin/usuarios" element={<UsuariosPage />} />
            <Route path="/admin/reportes" element={<ReportesPage />} />
            <Route path="/ajustes" element={<AjustesPage />} />
          </Route>

          {/* Client Portal Protected Routes */}
          <Route 
            element={
              <ProtectedRoute allowedRoles={['CLIENTE']}>
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal" element={<PortalDashboard />} />
            <Route path="/portal/procesos/:id" element={<PortalProcesoDetalle />} />
            <Route path="/portal/ajustes" element={<PortalAjustes />} />
          </Route>
          
          <Route path="/" element={<RootRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
