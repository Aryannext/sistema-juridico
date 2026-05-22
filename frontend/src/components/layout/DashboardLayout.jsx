import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Users, Briefcase, LogOut, LayoutDashboard, Shield } from 'lucide-react';
import { Toaster } from 'sonner';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-white">
      <Toaster richColors />
      {/* Sidebar */}
      <div className="w-64 bg-black border-r border-neutral-800 flex flex-col">
        <div className="p-6 border-b border-neutral-800">
          <h2 className="text-xl font-bold tracking-tight">SGPA</h2>
          <p className="text-sm text-neutral-400">{user?.nombre}</p>
          <span className="text-xs bg-neutral-800 px-2 py-1 rounded mt-2 inline-block">
            {user?.rol}
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link to="/clientes" className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors">
            <Users size={20} />
            <span>Clientes</span>
          </Link>
          <Link to="/procesos" className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors">
            <Briefcase size={20} />
            <span>Expedientes</span>
          </Link>
          {user?.rol === 'ADMINISTRADOR' && (
            <Link to="/auditoria" className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors">
              <Shield size={20} />
              <span>Auditoría</span>
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-neutral-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-red-400 hover:bg-red-900/20 rounded-md transition-colors"
          >
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
