import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import { Briefcase, Calendar, Clock, FileText, ArrowLeft, Download, Shield, User, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function PortalProcesoDetalle() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    const fetchProcesoDetalle = async () => {
      try {
        const response = await api.get(`/portal/procesos/${id}`);
        setData(response.data);
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar la información del expediente');
      } finally {
        setLoading(false);
      }
    };
    fetchProcesoDetalle();
  }, [id]);

  const handleDownload = async (versionId, fileName) => {
    try {
      toast.loading('Generando enlace de descarga seguro...', { id: 'download' });
      const response = await api.get(`/documentos/download/${versionId}`);
      
      const link = document.createElement('a');
      link.href = response.data.url;
      // We set target="_blank" to download without redirecting the app
      link.target = '_blank';
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Descarga iniciada con éxito', { id: 'download' });
    } catch (err) {
      console.error(err);
      toast.error('Error al descargar el archivo', { id: 'download' });
    }
  };

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

  if (!data || !data.proceso) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-neutral-400">Expediente no encontrado o no asignado.</p>
        <Link to="/portal" className="inline-flex items-center gap-2 text-indigo-400 font-semibold">
          <ArrowLeft size={16} />
          Volver a Mis Expedientes
        </Link>
      </div>
    );
  }

  const { proceso, documentos = [], audiencias = [], historial = [] } = data;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header / Back navigation */}
      <div className="space-y-4">
        <Link 
          to="/portal" 
          className="inline-flex items-center gap-2 text-sm text-[#DFB971] hover:text-[#FFF1C6] transition-colors group font-bold"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a mis expedientes
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-8 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] gap-4 relative overflow-hidden">
          <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-[#DFB971]/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="flex items-start gap-4 z-10">
            <div className="p-4 bg-[#DFB971]/10 text-[#DFB971] border border-[#DFB971]/20 rounded-2xl shadow-[0_4px_15px_rgba(223,185,113,0.2)] mt-1">
              <Briefcase size={28} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-mono font-bold text-[#DFB971] bg-[#DFB971]/10 px-2.5 py-1 rounded-md border border-[#DFB971]/20 uppercase tracking-widest">
                Radicado: {proceso.numero_radicado}
              </span>
              <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">{proceso.tipo_proceso}</h1>
              <p className="text-sm text-neutral-400 font-medium">{proceso.juzgado || 'Despacho judicial no especificado'}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 z-10">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border self-start md:self-end uppercase tracking-wider ${
              proceso.estado === 'ACTIVO'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-white/5 text-neutral-400 border-white/10'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${proceso.estado === 'ACTIVO' ? 'bg-emerald-400' : 'bg-neutral-500'}`}></span>
              Estado: {proceso.estado}
            </span>
            <div className="flex items-center gap-2 text-xs text-neutral-300 bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
              <User size={14} className="text-[#DFB971]" />
              <span>Abogado: <strong className="text-white">{proceso.abogado_resp.nombre}</strong> <span className="text-neutral-500">({proceso.abogado_resp.email})</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/10 overflow-x-auto custom-scrollbar">
        <button 
          onClick={() => setActiveTab('info')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all duration-300 whitespace-nowrap ${
            activeTab === 'info' 
              ? 'border-[#DFB971] text-[#DFB971] bg-[#DFB971]/5' 
              : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Información General
        </button>
        <button 
          onClick={() => setActiveTab('documentos')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all duration-300 whitespace-nowrap ${
            activeTab === 'documentos' 
              ? 'border-[#DFB971] text-[#DFB971] bg-[#DFB971]/5' 
              : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Documentos Compartidos ({documentos.length})
        </button>
        <button 
          onClick={() => setActiveTab('audiencias')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all duration-300 whitespace-nowrap ${
            activeTab === 'audiencias' 
              ? 'border-[#DFB971] text-[#DFB971] bg-[#DFB971]/5' 
              : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Historial de Audiencias ({audiencias.length})
        </button>
        <button 
          onClick={() => setActiveTab('historial')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all duration-300 whitespace-nowrap ${
            activeTab === 'historial' 
              ? 'border-[#DFB971] text-[#DFB971] bg-[#DFB971]/5' 
              : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Historial de Actuaciones ({historial.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-b-3xl rounded-tr-3xl p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] min-h-[400px]">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Info size={18} className="text-[#DFB971]" />
                Detalles del Expediente
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 shadow-inner hover:border-[#DFB971]/30 transition-colors">
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Número Radicado</p>
                  <p className="text-sm font-mono font-bold text-white mt-1">{proceso.numero_radicado}</p>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 shadow-inner hover:border-[#DFB971]/30 transition-colors">
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Área del Derecho</p>
                  <p className="text-sm font-bold text-white mt-1">{proceso.area_derecho || 'No especificado'}</p>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 shadow-inner hover:border-[#DFB971]/30 transition-colors">
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Clase de Proceso</p>
                  <p className="text-sm font-bold text-white mt-1">{proceso.clase_proceso || 'No especificado'}</p>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 shadow-inner hover:border-[#DFB971]/30 transition-colors">
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Fecha Radicación</p>
                  <p className="text-sm font-bold text-white mt-1">
                    {proceso.fecha_radicado ? new Date(proceso.fecha_radicado).toLocaleDateString('es-CO') : 'No especificada'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <User size={18} className="text-[#DFB971]" />
                Despacho y Contacto Profesional
              </h3>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-inner space-y-5">
                <div>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Juzgado Competente</p>
                  <p className="text-sm font-bold text-white mt-1">{proceso.juzgado || 'No asignado aún'}</p>
                </div>
                <div className="pt-5 border-t border-white/10">
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Abogado Asignado</p>
                  <p className="text-base font-extrabold text-[#DFB971] mt-1">{proceso.abogado_resp.nombre}</p>
                  <p className="text-xs text-neutral-400 mt-1">{proceso.abogado_resp.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documentos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-[#DFB971]" />
                Documentos Disponibles para Descarga
              </h3>
            </div>
            {documentos.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 text-sm">
                No hay documentos compartidos por tu abogado en este expediente.
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar mt-4">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[#DFB971] text-xs font-bold uppercase tracking-wider bg-white/5">
                      <th className="py-4 px-4 rounded-tl-xl">Nombre</th>
                      <th className="py-4 px-4">Categoría</th>
                      <th className="py-4 px-4">Tamaño</th>
                      <th className="py-4 px-4 text-right rounded-tr-xl">Descargar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {documentos.map(doc => (
                      <tr key={doc.id_documento} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 px-4">
                          <div className="font-bold text-white group-hover:text-[#FFF1C6] transition-colors">{doc.nombre}</div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-1">{doc.version_actual?.nombre_archivo}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-white/5 text-neutral-300 border border-white/10 uppercase tracking-widest">
                            {doc.categoria}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-neutral-400 font-mono text-xs font-bold">
                          {doc.version_actual ? `${(doc.version_actual.tamano_bytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {doc.version_actual ? (
                            <button
                              onClick={() => handleDownload(doc.version_actual.id_version, doc.version_actual.nombre_archivo)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-bold text-xs rounded-xl transition-transform transform hover:scale-[1.02] shadow-[0_4px_15px_rgba(223,185,113,0.3)] cursor-pointer"
                            >
                              <Download size={14} />
                              Descargar
                            </button>
                          ) : (
                            <span className="text-xs text-neutral-600 font-medium">Sin versión activa</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'audiencias' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Calendar size={18} className="text-[#DFB971]" />
              Historial de Audiencias Programadas
            </h3>
            {audiencias.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 text-sm">
                No hay audiencias programadas en este expediente.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {audiencias.map(aud => (
                  <div key={aud.id_audiencia} className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 hover:border-[#DFB971]/30 transition-colors shadow-inner">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-extrabold text-white">{aud.nombre}</h4>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Tipo: {aud.tipo}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                        aud.estado === 'PROGRAMADA'
                          ? 'bg-[#DFB971]/10 border-[#DFB971]/20 text-[#DFB971]'
                          : aud.estado === 'REALIZADA'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-neutral-400'
                      }`}>
                        {aud.estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#DFB971] font-bold font-mono">
                      <Clock size={16} />
                      <span>{new Date(aud.fecha_hora).toLocaleString('es-CO')}</span>
                    </div>
                    <div className="text-xs text-neutral-300 bg-neutral-950 p-3 rounded-xl border border-white/5 break-words font-medium">
                      Lugar: <strong>{aud.lugar}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'historial' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Clock size={18} className="text-[#DFB971]" />
              Historial de Novedades y Actuaciones
            </h3>
            {historial.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 text-sm">
                No hay movimientos ni actuaciones registradas en este expediente.
              </div>
            ) : (
              <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10 mt-6">
                {historial.map(nov => (
                  <div key={nov.id_historial} className="relative pl-10 space-y-2">
                    <div className="absolute left-2 top-1.5 w-4 h-4 rounded-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] border-4 border-neutral-950 shadow-[0_0_10px_rgba(223,185,113,0.5)]"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#DFB971] font-mono font-bold">{new Date(nov.created_at).toLocaleString('es-CO')}</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white">{nov.accion}</h4>
                    <p className="text-xs text-neutral-300 bg-white/5 p-4 rounded-xl border border-white/10 max-w-3xl leading-relaxed shadow-inner font-medium">
                      Se modificó el campo <strong className="text-[#DFB971]">{nov.campo_modificado}</strong> de{' '}
                      <span className="text-neutral-500">"{nov.valor_anterior || 'Vacío'}"</span> a{' '}
                      <span className="text-white">"{nov.valor_nuevo || 'Vacío'}"</span>
                    </p>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Realizado por: {nov.usuario.nombre}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
