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

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/verificacion" element={<VerificacionPage />} />
          <Route path="/2fa" element={<TwoFactorPage />} />
          
          {/* Protected Routes */}
          <Route 
            element={
              <ProtectedRoute>
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
            <Route path="/ajustes" element={<AjustesPage />} />
          </Route>
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
