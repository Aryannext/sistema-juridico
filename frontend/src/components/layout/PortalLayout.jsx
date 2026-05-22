import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Briefcase, LogOut, LayoutDashboard, Settings, User, Scale, Bell, Menu, X } from 'lucide-react';
import { Toaster } from 'sonner';
import api from '../../api/axios';

export default function PortalLayout() {
  const [showNotif, setShowNotif] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const checkNotifs = async () => {
      try {
        const res = await api.get('/notificaciones');
        setHasUnread(res.data.length > 0);
      } catch (error) {
        console.error('Error fetching notifs for layout:', error);
      }
    };
    if (user) {
      checkNotifs();
    }
  }, [location.pathname, user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isCurrent = (path) => location.pathname === path;

  const menuItems = [
    { path: '/portal', label: 'My Cases', icon: LayoutDashboard },
    { path: '/portal/ajustes', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white font-sans overflow-hidden dark relative">
      <Toaster richColors theme="dark" />
      
      {/* Background decorations for depth */}
      <div className="absolute top-[10%] left-[-5%] w-[30%] h-[30%] bg-[#DFB971]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] lg:hidden" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 w-72 bg-neutral-950/90 lg:bg-neutral-950/40 backdrop-blur-xl border-r border-white/10 flex flex-col z-[60] shadow-[8px_0_32px_0_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out`}>
        
        {/* Brand */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(223,185,113,0.1)]">
              <Scale size={24} className="text-[#DFB971]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-widest uppercase">
                <span className="bg-gradient-to-r from-[#DFB971] via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">SGPA</span>
              </h2>
              <p className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase font-medium">Client Portal</p>
            </div>
          </div>
          <button 
            className="lg:hidden p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-white/5"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">Main Menu</p>
            {menuItems.map((item) => {
              const active = isCurrent(item.path);
              return (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                    active 
                    ? 'bg-white/10 text-[#DFB971] border border-white/10 shadow-[0_0_15px_rgba(223,185,113,0.1)]' 
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon size={18} className={active ? 'text-[#DFB971]' : ''} />
                  <span className="font-medium text-sm tracking-wide">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#C29B4F] to-[#FFF1C6] p-[2px]">
              <div className="w-full h-full rounded-full bg-neutral-900 flex items-center justify-center border border-black">
                <span className="text-[#DFB971] font-bold text-sm">
                  {user?.nombre?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.nombre}</p>
              <p className="text-xs text-[#DFB971] tracking-wider uppercase font-semibold">{user?.rol}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all duration-300 border border-transparent hover:border-red-900/50 cursor-pointer"
          >
            <LogOut size={16} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-white/10 bg-neutral-950/20 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 relative z-40">
          <div className="flex items-center gap-3 text-neutral-400 text-sm">
            <button 
              className="lg:hidden p-2 -ml-2 text-neutral-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-white font-semibold tracking-wide">Portal Workspace</span>
          </div>
          <div className="flex items-center gap-4 relative">
            <button 
              onClick={() => setShowNotif(!showNotif)}
              className="p-2 text-neutral-400 hover:text-[#DFB971] hover:bg-[#DFB971]/10 rounded-full transition-colors cursor-pointer relative" 
              title="Centro de Notificaciones"
            >
              <Bell size={18} />
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-[#0a0a0c] shadow-[0_0_5px_rgba(244,63,94,0.8)]"></span>
              )}
            </button>

            {showNotif && (
              <div className="absolute top-full right-0 mt-3 w-72 bg-neutral-950/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] z-50 animate-fade-in">
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                  <h3 className="text-white font-bold text-sm">Notificaciones</h3>
                  <Bell size={14} className="text-[#DFB971]" />
                </div>
                <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                  Las notificaciones del portal se gestionan en el panel principal.
                </p>
                <button 
                  onClick={() => {
                    setShowNotif(false);
                    navigate('/portal');
                  }} 
                  className="w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-bold py-2 rounded-xl text-xs transition-transform transform hover:scale-[1.02] shadow-[0_4px_15px_rgba(223,185,113,0.3)] cursor-pointer"
                >
                  Ir al Resumen
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Outlet Content */}
        <main className="flex-1 overflow-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
