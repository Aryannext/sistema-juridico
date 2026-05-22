import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, Briefcase, Shield, Activity, ArrowRight, UserPlus, 
  FilePlus, ExternalLink, Calendar, HeartHandshake 
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ clientes: 0, procesos: 0, logsCount: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notificaciones, setNotificaciones] = useState([]);
  const [loadingNotificaciones, setLoadingNotificaciones] = useState(false);

  const fetchNotificaciones = async () => {
    try {
      setLoadingNotificaciones(true);
      const res = await api.get('/notificaciones');
      setNotificaciones(res.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotificaciones(false);
    }
  };

  const handleGestionarNotificacion = async (id) => {
    try {
      const res = await api.put(`/notificaciones/${id}/gestionar`);
      toast.success(res.data.message || 'Alerta gestionada con éxito');
      fetchNotificaciones();
    } catch (error) {
      console.error('Error managing notification:', error);
      const errMsg = error.response?.data?.error || 'Error al gestionar la notificación';
      toast.error(errMsg);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch clients count, processes count, and recent audit logs
        const [clientesRes, procesosRes] = await Promise.all([
          api.get('/clientes'),
          api.get('/procesos')
        ]);

        let logs = [];
        // Fetch audit logs if admin
        if (user?.rol === 'ADMINISTRADOR') {
          const logsRes = await api.get('/admin/auditoria').catch(() => null);
          if (logsRes) {
            logs = logsRes.data.slice(0, 5); // Take top 5
          }
        }

        setStats({
          clientes: clientesRes.data.length,
          procesos: procesosRes.data.length,
          logsCount: logs.length
        });
        setRecentLogs(logs);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    fetchNotificaciones();
  }, [user]);

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border border-neutral-800 p-8 md:p-10 shadow-2xl">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <span className="text-xs uppercase font-extrabold tracking-wider bg-white/10 text-white px-3 py-1 rounded-full border border-white/10">
            {user?.rol === 'ADMINISTRADOR' ? 'Panel de Control Principal' : 'Escritorio de Trabajo'}
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent pt-2">
            Bienvenido, {user?.nombre}
          </h1>
          <p className="text-neutral-400 text-sm md:text-base">
            SGPA te permite gestionar tus expedientes de forma segura, auditable y con total transparencia. Tu consultorio jurídico está al día.
          </p>
        </div>
        
        {/* Abstract background graphics */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/[0.02] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      </div>

      {/* Alertas Críticas de Alta Prioridad */}
      {notificaciones.filter(n => n.prioridad === 'ALTA').length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm uppercase font-extrabold tracking-wider text-rose-500 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span>Alertas Críticas Activas</span>
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {notificaciones
              .filter(n => n.prioridad === 'ALTA')
              .map((notif) => (
                <div
                  key={notif.id_notificacion}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/20 via-neutral-950 to-rose-950/10 border border-rose-500/25 p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-rose-500/40"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 mt-0.5 font-bold text-lg">
                      !
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white leading-relaxed">{notif.mensaje}</h4>
                      <p className="text-xs text-neutral-400">
                        Generado el {new Date(notif.created_at).toLocaleString()} • Canal: {notif.canal || 'Email'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleGestionarNotificacion(notif.id_notificacion)}
                    className="px-4 py-2 bg-rose-950/30 border border-rose-500/30 hover:bg-rose-500 hover:text-black hover:border-transparent text-rose-400 font-bold rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap self-end sm:self-center"
                  >
                    Marcar Gestionada / Leída
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Stat: Clients */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Clientes Totales</p>
            <h3 className="text-3xl font-extrabold text-white">{loading ? '...' : stats.clientes}</h3>
            <button 
              onClick={() => navigate('/clientes')}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors pt-2 cursor-pointer"
            >
              <span>Ver listado</span>
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5">
            <Users size={22} />
          </div>
        </div>

        {/* Stat: Processes */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Expedientes Activos</p>
            <h3 className="text-3xl font-extrabold text-white">{loading ? '...' : stats.procesos}</h3>
            <button 
              onClick={() => navigate('/procesos')}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors pt-2 cursor-pointer"
            >
              <span>Ver listado</span>
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <Briefcase size={22} />
          </div>
        </div>

        {/* Stat: Action Banner */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Seguridad & Auditoría</p>
            <h3 className="text-3xl font-extrabold text-white">{loading ? '...' : user?.rol === 'ADMINISTRADOR' ? stats.logsCount + ' Recientes' : 'Activo'}</h3>
            {user?.rol === 'ADMINISTRADOR' ? (
              <button 
                onClick={() => navigate('/auditoria')}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors pt-2 cursor-pointer"
              >
                <span>Ver bitácora</span>
                <ArrowRight size={12} />
              </button>
            ) : (
              <span className="text-xs text-neutral-500 inline-block pt-2">Cumpliendo normas de seguridad</span>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-neutral-900 text-neutral-400 flex items-center justify-center border border-neutral-800">
            <Shield size={22} />
          </div>
        </div>

      </div>

      {/* Grid: Actions & Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Actions Panel */}
        <div className="lg:col-span-1 bg-gradient-to-b from-neutral-950 to-neutral-900/60 border border-neutral-900 rounded-3xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={20} className="text-neutral-400" />
            <span>Accesos Rápidos</span>
          </h2>
          
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => navigate('/clientes')}
              className="flex items-center justify-between p-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 hover:border-neutral-700 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/10">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Nuevo Cliente</h4>
                  <p className="text-[11px] text-neutral-500">Natural o Jurídico</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-neutral-600 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => navigate('/procesos')}
              className="flex items-center justify-between p-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 hover:border-neutral-700 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/10">
                  <FilePlus size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Nuevo Radicado</h4>
                  <p className="text-[11px] text-neutral-500">Expediente Jurídico</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-neutral-600 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Audit Logs (Admin only) or General Activity Info */}
        <div className="lg:col-span-2 bg-gradient-to-b from-neutral-950 to-neutral-900/60 border border-neutral-900 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield size={20} className="text-neutral-400" />
              <span>{user?.rol === 'ADMINISTRADOR' ? 'Bitácora de Auditoría Reciente' : 'Seguridad del Sistema'}</span>
            </h2>
            {user?.rol === 'ADMINISTRADOR' && recentLogs.length > 0 && (
              <button
                onClick={() => navigate('/auditoria')}
                className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Ver todo</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          {user?.rol === 'ADMINISTRADOR' ? (
            loading ? (
              <div className="space-y-3">
                {[1, 2].map(n => (
                  <div key={n} className="h-12 bg-neutral-900 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="text-center py-10 rounded-2xl bg-neutral-900/20 border border-neutral-900">
                <p className="text-neutral-500 text-sm">No hay registros de auditoría aún.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div
                    key={log.id_bitacora}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-neutral-900 border border-neutral-800/80 gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{log.accion}</span>
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px]">
                          {log.modulo}
                        </span>
                      </div>
                      <p className="text-neutral-400">{log.detalle}</p>
                    </div>

                    <div className="text-right text-neutral-500 shrink-0">
                      <p className="font-semibold text-neutral-400">{log.usuario?.nombre}</p>
                      <p className="text-[10px] mt-0.5">{new Date(log.create_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <HeartHandshake size={20} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-white">Transparencia e Inmutabilidad</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Todas tus acciones de creación, actualización y eliminación de expedientes y clientes quedan registradas automáticamente con tu IP y usuario. Esta bitácora asegura que tu información sea auditable en cualquier momento por el administrador de tu consultorio.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
