import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { 
  ArrowLeft, Briefcase, Calendar, User, Building2, MapPin, 
  Clock, Edit3, X, Save, AlertCircle, FileText, CheckCircle, ListTodo
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProcesoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proceso, setProceso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit form states
  const [juzgado, setJuzgado] = useState('');
  const [claseProceso, setClaseProceso] = useState('');
  const [areaDerecho, setAreaDerecho] = useState('');
  const [fechaRadicado, setFechaRadicado] = useState('');

  const fetchProceso = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/procesos/${id}`);
      setProceso(res.data);
      
      // Seed edit form
      setJuzgado(res.data.juzgado || '');
      setClaseProceso(res.data.clase_proceso || '');
      setAreaDerecho(res.data.area_derecho || '');
      setFechaRadicado(res.data.fecha_radicado ? res.data.fecha_radicado.split('T')[0] : '');
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar los detalles del expediente');
      navigate('/procesos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProceso();
  }, [id]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        juzgado,
        clase_proceso: claseProceso,
        area_derecho: areaDerecho,
        fecha_radicado: fechaRadicado || null
      };

      const res = await api.put(`/procesos/${id}`, data);
      toast.success(res.data.message || 'Expediente actualizado exitosamente');
      setShowEditModal(false);
      fetchProceso(); // Reload with new history entry!
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al actualizar el expediente');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-white border-neutral-800 animate-spin" />
        <p className="text-neutral-400 text-sm">Cargando detalles del expediente...</p>
      </div>
    );
  }

  if (!proceso) return null;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Back button and title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/procesos')}
            className="p-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
              Detalle de Expediente
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              Radicado: {proceso.numero_radicado}
            </h1>
          </div>
        </div>

        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all cursor-pointer text-sm"
        >
          <Edit3 size={16} />
          <span>Editar Expediente</span>
        </button>
      </div>

      {/* Grid: Case Details and Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: General Information */}
          <div className="bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase size={20} className="text-neutral-400" />
              <span>Información General del Proceso</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-1">
                <p className="text-neutral-500 font-medium">Despacho Judicial</p>
                <p className="text-white font-semibold text-base">{proceso.juzgado || 'No especificado'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-neutral-500 font-medium">Jurisdicción / Tipo de Proceso</p>
                <p className="text-white font-semibold text-base">{proceso.tipo_proceso}</p>
              </div>

              <div className="space-y-1">
                <p className="text-neutral-500 font-medium">Clase de Proceso</p>
                <p className="text-white font-semibold text-base">{proceso.clase_proceso || 'No especificada'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-neutral-500 font-medium">Área del Derecho</p>
                <p className="text-white font-semibold text-base">{proceso.area_derecho || 'No especificada'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-neutral-500 font-medium">Estado del Proceso</p>
                <span className="inline-block mt-1 px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                  {proceso.estado}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-neutral-500 font-medium">Fecha de Radicación</p>
                <p className="text-white font-semibold text-base flex items-center gap-1.5 mt-1">
                  <Calendar size={15} className="text-neutral-500" />
                  {proceso.fecha_radicado 
                    ? new Date(proceso.fecha_radicado).toLocaleDateString()
                    : 'No registrada'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Card: Client & Lawyer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Client Profile Summary */}
            <div 
              onClick={() => navigate(`/clientes/${proceso.id_cliente}`)}
              className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 p-6 rounded-3xl cursor-pointer transition-colors shadow-lg group"
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">
                Cliente Asociado
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center text-white">
                  {proceso.cliente?.tipo === 'NATURAL' ? <User size={22} /> : <Building2 size={22} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold group-hover:text-neutral-300 transition-colors truncate">
                    {proceso.cliente?.nombre || proceso.cliente?.razon_social}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5 truncate">
                    {proceso.cliente?.tipo_documento}: {proceso.cliente?.numero_documento}
                  </p>
                </div>
              </div>
            </div>

            {/* Abogado Responsable */}
            <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-3xl shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">
                Abogado Responsable
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center text-neutral-400">
                  <User size={22} />
                </div>
                <div>
                  <p className="text-white font-bold">{proceso.abogado_resp?.nombre}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{proceso.abogado_resp?.email}</p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Change History Timeline (HU-33) */}
        <div className="lg:col-span-1 bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock size={20} className="text-neutral-400" />
            <span>Línea del Tiempo / Cambios</span>
          </h2>

          {!proceso.historial || proceso.historial.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-neutral-900/40 border border-neutral-900/80">
              <AlertCircle className="mx-auto text-neutral-700 mb-2" size={32} />
              <p className="text-neutral-400 text-xs">No hay modificaciones registradas en el expediente.</p>
            </div>
          ) : (
            <div className="relative border-l border-neutral-800 pl-4 ml-2 space-y-6">
              {proceso.historial.map((hist, idx) => (
                <div key={hist.id_historial} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-neutral-700 group-hover:bg-white transition-colors" />
                  
                  <div className="space-y-1">
                    <span className="text-[10px] text-neutral-500 font-bold">
                      {new Date(hist.created_at).toLocaleString()}
                    </span>
                    <p className="text-xs text-white font-semibold">
                      Modificación por: {hist.usuario?.nombre}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Campos editados: <span className="text-white bg-neutral-900 px-1.5 py-0.5 rounded text-[10px]">{hist.campo_modificado}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Modal - Edit Proceso */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Editar Datos del Expediente
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Actualiza los datos clave. Cualquier cambio generará una bitácora inmutable en el historial.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="space-y-4">
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Despacho / Juzgado
                  </label>
                  <input
                    type="text"
                    required
                    value={juzgado}
                    onChange={(e) => setJuzgado(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Clase de Proceso
                  </label>
                  <input
                    type="text"
                    required
                    value={claseProceso}
                    onChange={(e) => setClaseProceso(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Área del Derecho
                  </label>
                  <input
                    type="text"
                    required
                    value={areaDerecho}
                    onChange={(e) => setAreaDerecho(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Fecha de Radicación
                  </label>
                  <input
                    type="date"
                    value={fechaRadicado}
                    onChange={(e) => setFechaRadicado(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  />
                </div>

              </div>

              {/* Submit Footer */}
              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
