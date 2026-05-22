import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, Briefcase, Shield, Activity, ArrowRight, UserPlus, 
  FilePlus, ExternalLink, Calendar, HeartHandshake, Bell,
  AlertTriangle, Clock, ChevronRight, Award
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [stats, setStats] = useState({ clientes: 0, procesos: 0, logsCount: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [notificaciones, setNotificaciones] = useState([]);
  const [loadingNotificaciones, setLoadingNotificaciones] = useState(false);
  
  const [agenda, setAgenda] = useState([]);
  const [vencimientos, setVencimientos] = useState([]);
  
  // Administrative stats
  const [statsAdmin, setStatsAdmin] = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

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

  const handleGestionarNotificacion = async (id, groupedIds) => {
    try {
      const res = await api.put(`/notificaciones/${id}/gestionar`, { groupedIds });
      toast.success(res.data.message || 'Alerta(s) gestionada(s) con éxito');
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
        // Fetch standard collections
        const [clientesRes, procesosRes, agendaRes, vencimientosRes] = await Promise.all([
          api.get('/clientes'),
          api.get('/procesos'),
          api.get('/audiencias').catch(() => ({ data: [] })),
          api.get('/terminos/vencimientos').catch(() => ({ data: [] }))
        ]);

        let logs = [];
        if (user?.rol === 'ADMINISTRADOR') {
          const logsRes = await api.get('/admin/auditoria').catch(() => null);
          if (logsRes) {
            logs = logsRes.data.slice(0, 5);
          }
        }

        setStats({
          clientes: clientesRes.data.length,
          procesos: procesosRes.data.length,
          logsCount: logs.length
        });
        setRecentLogs(logs);
        setAgenda(agendaRes.data);
        setVencimientos(vencimientosRes.data);

        // Fetch administrative statistics if user is admin
        if (user?.rol === 'ADMINISTRADOR') {
          setLoadingAdmin(true);
          try {
            const adminRes = await api.get('/reportes/stats');
            setStatsAdmin(adminRes.data);
          } catch (err) {
            console.error('Error fetching admin report stats:', err);
          } finally {
            setLoadingAdmin(false);
          }
        }

      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    fetchNotificaciones();
  }, [user]);

  // Compute local semaphores for lawyers
  const today = new Date();
  const limit24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Processes with no movement > 30 days (for lawyers, calculated locally from their processes)
  // (In full production we rely on the reportes/stats for the whole tenant, but lawyers also get highlighted in their view)
  const localRiesgosInactivos = []; // will populate if needed

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 md:p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)]">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <span className="text-xs uppercase font-extrabold tracking-wider bg-white/5 text-[#DFB971] px-3 py-1 rounded-full border border-[#DFB971]/20">
            {user?.rol === 'ADMINISTRADOR' ? 'Consultorio Administrativo Principal' : 'Escritorio del Abogado'}
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent pt-2">
            Bienvenido, {user?.nombre}
          </h1>
          <p className="text-neutral-400 text-sm md:text-base">
            SGPA te permite gestionar tus expedientes de forma segura, auditable y con total transparencia. Tu consultorio jurídico está al día.
          </p>
        </div>
        
        {/* Abstract background graphics */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#DFB971]/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none" />
      </div>

      {/* RIESGOS PROCESALES CRÍTICOS (SEMÁFORO ROJO ESTRICTO) */}
      {((user?.rol === 'ADMINISTRADOR' && statsAdmin && (statsAdmin.plazosVencidos > 0 || statsAdmin.plazosCriticos24h > 0 || statsAdmin.procesosInactivos.length > 0)) ||
        (user?.rol !== 'ADMINISTRADOR' && vencimientos.some(v => new Date(v.fecha_vencimiento) < limit24h))) && (
        <div className="p-6 rounded-3xl bg-rose-950/20 border border-rose-500/30 shadow-[0_8px_32px_0_rgba(244,63,94,0.1)] space-y-4">
          <h2 className="text-sm uppercase font-extrabold tracking-wider text-rose-500 flex items-center gap-2">
            <AlertTriangle size={18} className="animate-pulse" />
            <span>Atenciones y Riesgos Procesales Críticos (Semáforo Rojo)</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user?.rol === 'ADMINISTRADOR' && statsAdmin && (
              <>
                {statsAdmin.plazosVencidos > 0 && (
                  <div className="p-4 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-rose-500/20 flex gap-3 shadow-[0_4px_16px_rgba(244,63,94,0.1)]">
                    <div className="w-1.5 bg-rose-500 rounded-full shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-400 uppercase">Términos Judiciales Vencidos</h4>
                      <p className="text-sm font-bold text-white mt-1">{statsAdmin.plazosVencidos} plazos pendientes han superado su fecha límite.</p>
                      <p className="text-[10px] text-neutral-400 mt-1">Requieren justificación formal inmediata para reprogramación o cumplimiento tardío.</p>
                    </div>
                  </div>
                )}
                {statsAdmin.plazosCriticos24h > 0 && (
                  <div className="p-4 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-rose-500/20 flex gap-3 shadow-[0_4px_16px_rgba(244,63,94,0.1)]">
                    <div className="w-1.5 bg-rose-500 rounded-full shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-400 uppercase">Términos Críticos (&lt; 24 Horas)</h4>
                      <p className="text-sm font-bold text-white mt-1">{statsAdmin.plazosCriticos24h} términos procesales vencen hoy o en menos de 24h.</p>
                      <p className="text-[10px] text-neutral-400 mt-1">Gestión prioritaria obligatoria.</p>
                    </div>
                  </div>
                )}
                {statsAdmin.procesosInactivos.length > 0 && (
                  <div className="p-4 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-rose-500/20 flex gap-3 md:col-span-2 shadow-[0_4px_16px_rgba(244,63,94,0.1)]">
                    <div className="w-1.5 bg-rose-500 rounded-full shrink-0" />
                    <div className="w-full">
                      <h4 className="text-xs font-bold text-rose-400 uppercase">Expedientes Activos Sin Movimiento (&gt; 30 días)</h4>
                      <p className="text-sm font-bold text-white mt-1">Se han detectado {statsAdmin.procesosInactivos.length} procesos activos sin actividad en su historial o documentos.</p>
                      <div className="mt-3 overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-[11px] text-neutral-300">
                          <thead>
                            <tr className="border-b border-white/10 text-neutral-500">
                              <th className="pb-2">Radicado</th>
                              <th className="pb-2">Abogado</th>
                              <th className="pb-2">Cliente</th>
                              <th className="pb-2 text-right">Días Inactivo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {statsAdmin.procesosInactivos.slice(0, 3).map(p => (
                              <tr key={p.id_proceso} className="hover:bg-white/5 transition-colors">
                                <td className="py-2 font-mono font-bold text-rose-400">{p.numero_radicado}</td>
                                <td className="py-2">{p.abogado}</td>
                                <td className="py-2">{p.cliente}</td>
                                <td className="py-2 text-right font-bold text-white">{p.dias_inactivo} días</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {user?.rol !== 'ADMINISTRADOR' && vencimientos.filter(v => new Date(v.fecha_vencimiento) < limit24h).map(v => (
              <div key={v.id_termino} className="p-4 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-rose-500/20 flex gap-3 shadow-[0_4px_16px_rgba(244,63,94,0.1)]">
                <div className="w-1.5 bg-rose-500 rounded-full shrink-0 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold text-rose-400 uppercase">Vencimiento Inminente</h4>
                  <p className="text-xs font-bold text-white mt-1">"{v.nombre}" vence el {new Date(v.fecha_vencimiento).toLocaleString()}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Radicado: {v.proceso.numero_radicado}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas Críticas Recibidas (Notificaciones) */}
      <div id="notificaciones" className="space-y-4">
        <h2 className="text-sm uppercase font-extrabold tracking-wider text-[#DFB971] flex items-center gap-2">
          <Bell size={18} />
          <span>Centro de Notificaciones y Alertas</span>
        </h2>
        
        {notificaciones.length === 0 ? (
          <div className="text-center py-8 rounded-2xl bg-neutral-900/20 border border-neutral-900 shadow-inner">
            <Bell size={24} className="text-neutral-600 mx-auto mb-2 opacity-50" />
            <p className="text-neutral-500 text-sm font-medium">No tienes alertas críticas ni notificaciones en este momento.</p>
            <p className="text-xs text-neutral-600 mt-1">Todo está al día.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {notificaciones.map((notif) => (
              <div
                key={notif.id_notificacion}
                className={`relative overflow-hidden rounded-2xl backdrop-blur-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#DFB971]/50 ${
                  notif.prioridad === 'ALTA' 
                    ? 'border-rose-500/25 bg-rose-950/20' 
                    : 'border-white/10 bg-neutral-950/40 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                    notif.prioridad === 'ALTA' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                      : 'bg-white/5 text-[#DFB971] border border-white/10'
                  }`}>
                    {notif.prioridad === 'ALTA' ? '!' : 'i'}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white leading-relaxed">{notif.titulo}</h4>
                    <p className="text-xs text-neutral-400">{notif.mensaje}</p>
                    <p className="text-[10px] text-neutral-500">
                      Generado el {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleGestionarNotificacion(notif.id_notificacion, notif.groupedIds)}
                  className={`px-3 py-1.5 font-bold rounded-lg text-[10px] transition-all cursor-pointer whitespace-nowrap self-end sm:self-center border ${
                    notif.prioridad === 'ALTA'
                      ? 'bg-rose-950/20 border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-black hover:border-transparent'
                      : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Marcar Leída
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Stat: Clients */}
        <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.6)]">
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
          <div className="w-12 h-12 rounded-xl bg-[#DFB971]/10 text-[#DFB971] flex items-center justify-center border border-[#DFB971]/20 shadow-lg">
            <Users size={22} />
          </div>
        </div>

        {/* Stat: Processes */}
        <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.6)]">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Expedientes en Cargo</p>
            <h3 className="text-3xl font-extrabold text-white">{loading ? '...' : stats.procesos}</h3>
            <button 
              onClick={() => navigate('/procesos')}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors pt-2 cursor-pointer"
            >
              <span>Ver listado</span>
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#DFB971]/10 text-[#DFB971] flex items-center justify-center border border-[#DFB971]/20 shadow-lg">
            <Briefcase size={22} />
          </div>
        </div>

        {/* Stat: Agenda count */}
        <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.6)]">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Agenda Activa</p>
            <h3 className="text-3xl font-extrabold text-white">{loading ? '...' : agenda.length + ' Audiencias'}</h3>
            <button 
              onClick={() => navigate('/procesos')}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors pt-2 cursor-pointer"
            >
              <span>Gestionar expedientes</span>
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#DFB971]/10 text-[#DFB971] flex items-center justify-center border border-[#DFB971]/20 shadow-lg">
            <Calendar size={22} />
          </div>
        </div>

      </div>

      {/* ROLE BASED STATS PANELS */}
      {user?.rol === 'ADMINISTRADOR' && statsAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Workload by Lawyer (Carga de trabajo) */}
          <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4">
              <Award size={20} className="text-[#DFB971]" />
              <span>Distribución y Carga de Trabajo por Abogado</span>
            </h3>
            {statsAdmin.cargaTrabajo.length === 0 ? (
              <p className="text-neutral-500 text-sm">No hay abogados registrados en el tenant.</p>
            ) : (
              <div className="space-y-4">
                {statsAdmin.cargaTrabajo.map(abogado => {
                  const maxVal = Math.max(...statsAdmin.cargaTrabajo.map(c => c.procesos_activos), 1);
                  const percentage = (abogado.procesos_activos / maxVal) * 100;
                  return (
                    <div key={abogado.id_usuario} className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-neutral-200">{abogado.nombre}</span>
                        <span className="text-[#DFB971]">{abogado.procesos_activos} procesos activos</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/10 shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(223,185,113,0.5)]" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Processes by State distribution */}
          <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4">
              <Activity size={20} className="text-[#DFB971]" />
              <span>Estado de Expedientes del Consultorio</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {statsAdmin.procesosPorEstado.map(pe => (
                <div key={pe.estado} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:border-[#DFB971]/30 transition-colors">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{pe.estado}</span>
                  <span className="text-2xl font-extrabold text-white mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{pe._count.id_proceso}</span>
                </div>
              ))}
              {statsAdmin.procesosPorEstado.length === 0 && (
                <p className="text-neutral-500 text-xs col-span-2 text-center py-6">No hay expedientes.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid: Actions & Audit Logs / Assigned deadlines for non-admins */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Actions Panel */}
        <div className="lg:col-span-1 bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4">
            <Activity size={20} className="text-[#DFB971]" />
            <span>Accesos Rápidos</span>
          </h2>
          
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => navigate('/clientes')}
              className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#DFB971]/30 text-left transition-all cursor-pointer group shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#DFB971]/10 text-[#DFB971] flex items-center justify-center border border-[#DFB971]/20 group-hover:scale-110 transition-transform">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#FFF1C6] transition-colors">Nuevo Cliente</h4>
                  <p className="text-[11px] text-neutral-500">Natural o Jurídico</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-[#DFB971] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => navigate('/procesos')}
              className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#DFB971]/30 text-left transition-all cursor-pointer group shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#DFB971]/10 text-[#DFB971] flex items-center justify-center border border-[#DFB971]/20 group-hover:scale-110 transition-transform">
                  <FilePlus size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#FFF1C6] transition-colors">Nuevo Radicado</h4>
                  <p className="text-[11px] text-neutral-500">Expediente Jurídico</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-[#DFB971] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>

        {/* Audit Logs (Admin only) or Deadlines list (Lawyers/Assistants) */}
        <div className="lg:col-span-2 bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield size={20} className="text-[#DFB971]" />
              <span>{user?.rol === 'ADMINISTRADOR' ? 'Bitácora de Auditoría Reciente' : 'Mis Vencimientos y Actuaciones'}</span>
            </h2>
            {user?.rol === 'ADMINISTRADOR' && recentLogs.length > 0 && (
              <button
                onClick={() => navigate('/auditoria')}
                className="text-xs text-[#DFB971] hover:text-[#FFF1C6] transition-colors flex items-center gap-1 cursor-pointer font-bold"
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
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 gap-3 text-xs hover:bg-white/10 transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{log.accion}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#DFB971]/10 text-[#DFB971] border border-[#DFB971]/20 font-bold uppercase tracking-wider text-[9px]">
                          {log.modulo}
                        </span>
                      </div>
                      <p className="text-neutral-400">{log.detalle}</p>
                    </div>

                    <div className="text-right text-neutral-500 shrink-0">
                      <p className="font-bold text-white">{log.usuario?.nombre}</p>
                      <p className="text-[10px] mt-0.5 text-[#DFB971] font-mono">{new Date(log.create_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              {vencimientos.length === 0 ? (
                <div className="p-6 text-center text-neutral-500 text-sm bg-neutral-900/30 rounded-2xl border border-neutral-900">
                  No tienes plazos ni vencimientos pendientes asignados.
                </div>
              ) : (
                vencimientos.slice(0, 5).map(v => {
                  const isOverdue = new Date(v.fecha_vencimiento) < today;
                  const isCrit = v.es_critico || new Date(v.fecha_vencimiento) < limit24h;
                  return (
                    <div 
                      key={v.id_termino}
                      className={`p-4 rounded-2xl border flex justify-between items-center backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.2)] ${
                        isOverdue || isCrit
                          ? 'border-rose-500/25 bg-rose-950/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{v.nombre}</h4>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isOverdue || isCrit 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                              : 'bg-[#DFB971]/10 text-[#DFB971] border border-[#DFB971]/20'
                          }`}>
                            {isOverdue ? 'Vencido' : isCrit ? 'Crítico' : 'Pendiente'}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-neutral-400">Radicado: <span className="text-white">{v.proceso.numero_radicado}</span></p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mb-1">Vence:</span>
                        <span className={`text-xs font-bold font-mono ${isOverdue || isCrit ? 'text-rose-400' : 'text-[#DFB971]'}`}>
                          {new Date(v.fecha_vencimiento).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
