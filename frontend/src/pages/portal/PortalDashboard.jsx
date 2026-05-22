import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { Briefcase, Calendar, Clock, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PortalDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/portal/dashboard');
        setData(response.data);
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar la información del portal');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const { cliente, procesos = [], audiencias = [], novedades = [] } = data || {};

  const activosCount = procesos.filter(p => p.estado === 'ACTIVO').length;
  const inactivosCount = procesos.filter(p => p.estado !== 'ACTIVO').length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Greeting */}
      <div className="p-8 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-80 h-80 bg-[#DFB971]/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent sm:text-4xl">
          ¡Bienvenido, {cliente?.nombre}!
        </h1>
        <p className="mt-3 text-sm text-neutral-400 font-medium max-w-xl">
          Desde aquí puedes consultar el estado en tiempo real de tus expedientes, próximas audiencias y descargar documentos compartidos por tu abogado responsable.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] flex items-center gap-4 hover:border-[#DFB971]/30 transition-colors">
          <div className="p-3 bg-[#DFB971]/10 text-[#DFB971] border border-[#DFB971]/20 rounded-xl shadow-[0_4px_15px_rgba(223,185,113,0.2)]">
            <Briefcase size={24} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white">{activosCount}</p>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Expedientes Activos</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] flex items-center gap-4 hover:border-[#DFB971]/30 transition-colors">
          <div className="p-3 bg-white/5 text-neutral-400 border border-white/10 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white">{inactivosCount}</p>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Expedientes Archivados</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] flex items-center gap-4 hover:border-[#DFB971]/30 transition-colors">
          <div className="p-3 bg-[#DFB971]/10 text-[#DFB971] border border-[#DFB971]/20 rounded-xl shadow-[0_4px_15px_rgba(223,185,113,0.2)]">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white">{audiencias.length}</p>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Próximas Audiencias</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Process List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-bold tracking-tight text-white mb-4 border-b border-white/10 pb-3 flex items-center gap-2">
              <Briefcase size={18} className="text-[#DFB971]" />
              Mis Procesos Vinculados
            </h2>
            {procesos.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">
                No tienes expedientes asociados en este momento.
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[#DFB971] text-xs font-bold uppercase tracking-wider bg-white/5 backdrop-blur-sm">
                      <th className="py-4 px-4 rounded-tl-xl">Radicado</th>
                      <th className="py-4 px-4">Tipo de Proceso</th>
                      <th className="py-4 px-4">Área</th>
                      <th className="py-4 px-4">Estado</th>
                      <th className="py-4 px-4 text-right rounded-tr-xl">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {procesos.map(p => (
                      <tr key={p.id_proceso} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 px-4 font-mono text-xs font-bold text-white group-hover:text-[#FFF1C6] transition-colors">{p.numero_radicado}</td>
                        <td className="py-4 px-4 font-medium text-neutral-300">{p.tipo_proceso}</td>
                        <td className="py-4 px-4 text-neutral-500 text-xs">{p.area_derecho || 'No especificado'}</td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider border ${
                            p.estado === 'ACTIVO'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-white/5 text-neutral-400 border-white/10'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${p.estado === 'ACTIVO' ? 'bg-emerald-400' : 'bg-neutral-500'}`}></span>
                            {p.estado}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Link 
                            to={`/portal/procesos/${p.id_proceso}`}
                            className="inline-flex items-center gap-1 text-[#DFB971] hover:text-[#FFF1C6] font-bold text-xs group-hover:translate-x-0.5 transition-all"
                          >
                            Ver Ficha
                            <ArrowRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Audiencias & Novedades */}
        <div className="space-y-8">
          {/* Upcoming Audiencias */}
          <div className="p-6 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-bold tracking-tight text-white mb-4 border-b border-white/10 pb-3 flex items-center gap-2">
              <Calendar size={18} className="text-[#DFB971]" />
              Próximas Audiencias
            </h2>
            {audiencias.length === 0 ? (
              <div className="p-4 text-center text-neutral-500 text-sm">
                No tienes audiencias programadas.
              </div>
            ) : (
              <div className="space-y-4">
                {audiencias.slice(0, 3).map(aud => (
                  <div key={aud.id_audiencia} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 hover:border-[#DFB971]/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold text-white">{aud.nombre}</h4>
                      <span className="text-[9px] px-2 py-0.5 rounded uppercase tracking-widest bg-[#DFB971]/10 border border-[#DFB971]/20 text-[#DFB971] font-bold">
                        {aud.tipo}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-400 font-mono">Radicado: {aud.proceso.numero_radicado}</p>
                    <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} className="text-[#DFB971]" />
                        <span className="text-white">{new Date(aud.fecha_hora).toLocaleDateString('es-CO')}</span> - {new Date(aud.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 bg-neutral-950 p-2 rounded-lg border border-white/5 truncate">
                      Lugar: {aud.lugar}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline Novedades */}
          <div className="p-6 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-bold tracking-tight text-white mb-4 border-b border-white/10 pb-3 flex items-center gap-2">
              <Clock size={18} className="text-[#DFB971]" />
              Últimas Novedades
            </h2>
            {novedades.length === 0 ? (
              <div className="p-4 text-center text-neutral-500 text-sm">
                No hay movimientos registrados recientemente.
              </div>
            ) : (
              <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                {novedades.slice(0, 5).map(nov => (
                  <div key={nov.id_historial} className="relative pl-7 space-y-1">
                    <div className="absolute left-1.5 top-1.5 w-4 h-4 rounded-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] border-4 border-neutral-950"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500 font-bold">{new Date(nov.created_at).toLocaleDateString('es-CO')}</span>
                      <span className="text-[10px] text-[#DFB971] font-mono">#{nov.proceso.numero_radicado.substring(0, 6)}...</span>
                    </div>
                    <p className="text-xs text-white font-semibold">{nov.accion}</p>
                    <p className="text-[10px] text-neutral-400">
                      Cambio en <span className="font-semibold text-neutral-300">{nov.campo_modificado}</span> por {nov.usuario?.nombre || 'Abogado'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
