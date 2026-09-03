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

  // Avisos del panel: expedientes incompletos (RF17.3) e inactivos (RF40.3).
  const [atencion, setAtencion] = useState({ dias_umbral: 30, inactivos: [], incompletos: [] });

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
      const esAdmin = user?.rol === 'ADMINISTRADOR';

      try {
        setLoading(true);
        if (esAdmin) setLoadingAdmin(true);

        // TODAS las peticiones salen a la vez. Antes iban en tres tandas: el
        // Promise.all de las cuatro colecciones, después un `await` para la
        // auditoría y después otro para las estadísticas. Ninguna de las dos
        // últimas necesita el resultado de las anteriores, así que encadenarlas
        // solo servía para pagar tres viajes de ida y vuelta en lugar de uno.
        //
        // En local no se notaba (el servidor responde en 10 ms), pero contra el
        // VPS cada viaje cuesta unos 350 ms: tres tandas eran ~1 segundo de
        // espera en blanco cada vez que se abría el panel.
        const [clientesRes, procesosRes, agendaRes, vencimientosRes, logsRes, adminRes, atencionRes] =
          await Promise.all([
            api.get('/clientes'),
            api.get('/procesos'),
            api.get('/audiencias').catch(() => ({ data: [] })),
            api.get('/terminos/vencimientos').catch(() => ({ data: [] })),
            esAdmin ? api.get('/admin/auditoria').catch(() => null) : null,
            esAdmin ? api.get('/reportes/stats').catch(() => null) : null,
            api.get('/procesos/atencion').catch(() => null)
          ]);

        const logs = logsRes ? logsRes.data.slice(0, 5) : [];

        setStats({
          clientes: clientesRes.data.length,
          procesos: procesosRes.data.length,
          logsCount: logs.length
        });
        setRecentLogs(logs);
        setAgenda(agendaRes.data);
        setVencimientos(vencimientosRes.data);
        if (adminRes) setStatsAdmin(adminRes.data);
        if (atencionRes) setAtencion(atencionRes.data);

      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
        setLoadingAdmin(false);
      }
    };

    fetchDashboardData();
    fetchNotificaciones();
  }, [user]);

  // Compute local semaphores for lawyers
  const today = new Date();
  const limit24h = new Date(Date.now() + 24 * 60 * 60 * 1000);


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

            {/* RF40.3 — Inactividad para quien no es Administrador. El
                Administrador ya la recibe arriba desde /reportes/stats. */}
            {user?.rol !== 'ADMINISTRADOR' && atencion.inactivos.length > 0 && (
              <div className="p-4 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-rose-500/20 flex gap-3 md:col-span-2 shadow-[0_4px_16px_rgba(244,63,94,0.1)]">
                <div className="w-1.5 bg-rose-500 rounded-full shrink-0" />
                <div className="w-full">
                  <h4 className="text-xs font-bold text-rose-400 uppercase">Tus Expedientes Sin Movimiento (&gt; {atencion.dias_umbral} días)</h4>
                  <p className="text-sm font-bold text-white mt-1">{atencion.inactivos.length} expediente(s) a tu cargo llevan más de {atencion.dias_umbral} días sin actividad.</p>
                  <div className="mt-2 space-y-1">
                    {atencion.inactivos.slice(0, 3).map(p => (
                      <button
                        key={p.id_proceso}
                        onClick={() => navigate(`/procesos/${p.id_proceso}`)}
                        className="w-full flex items-center justify-between text-[11px] py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left"
                      >
                        <span className="font-mono font-bold text-rose-400">{p.numero_radicado}</span>
                        <span className="text-neutral-400 truncate px-2">{p.cliente}</span>
                        <span className="font-bold text-white shrink-0">{p.dias_inactivo} días</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RF17.3 — Expedientes incompletos. El aviso existía en la ficha del
          expediente, pero no en el panel, que es donde el requisito lo pide:
          nadie abre un expediente para enterarse de que le faltan partes.
          Va en ámbar y no en rojo porque es una conformación pendiente, no un
          riesgo procesal: mezclarlo con lo urgente le restaría fuerza a lo urgente. */}
      {atencion.incompletos.length > 0 && (
        <div className="p-6 rounded-3xl bg-amber-950/20 border border-amber-500/30 shadow-[0_8px_32px_0_rgba(245,158,11,0.1)] space-y-4">
          <h2 className="text-sm uppercase font-extrabold tracking-wider text-amber-500 flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>Expedientes Incompletos ({atencion.incompletos.length})</span>
          </h2>
          <p className="text-xs text-neutral-400 -mt-2">
            Les falta registrar las partes procesales obligatorias para completar la conformación básica.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {atencion.incompletos.slice(0, 4).map(p => (
              <button
                key={p.id_proceso}
                onClick={() => navigate(`/procesos/${p.id_proceso}`)}
                className="p-3 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-amber-500/20 flex gap-3 text-left hover:border-amber-500/40 transition-colors cursor-pointer"
              >
                <div className="w-1.5 bg-amber-500 rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-amber-400 truncate">{p.numero_radicado}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{p.cliente}</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Falta: {p.falta.join(' y ')}</p>
                </div>
              </button>
            ))}
          </div>
          {atencion.incompletos.length > 4 && (
            <p className="text-[11px] text-neutral-500">y {atencion.incompletos.length - 4} más.</p>
          )}
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
