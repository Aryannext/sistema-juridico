import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import { 
  Briefcase, Plus, Search, Calendar, User, FileText, 
  ArrowRight, X, UserCheck, ShieldAlert, AlertTriangle, 
  Trash2, Loader2, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProcesosList() {
  const [procesos, setProcesos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [abogados, setAbogados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Multi-filter states
  const [filterEstado, setFilterEstado] = useState('');
  const [filterJurisdiccion, setFilterJurisdiccion] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Cascade delete states (HU-34)
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('user')) || null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProceso, setDeletingProceso] = useState(null);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteJustificacion, setDeleteJustificacion] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  // Form states
  const [numeroRadicado, setNumeroRadicado] = useState('');
  const [juzgado, setJuzgado] = useState('');
  const [tipoProceso, setTipoProceso] = useState('CIVIL');
  const [claseProceso, setClaseProceso] = useState('');
  const [areaDerecho, setAreaDerecho] = useState('');
  const [fechaRadicado, setFechaRadicado] = useState('');
  const [idCliente, setIdCliente] = useState('');
  const [idAbogadoResp, setIdAbogadoResp] = useState('');

  // Fetch paginated processes according to multi-filters (HU-31)
  const fetchProcesos = async () => {
    try {
      const params = {
        page,
        limit: 20
      };
      
      // Auto-trigger search on partial inputs >= 3 characters (HU-31)
      if (search.trim().length >= 3) {
        params.search = search;
      }
      if (filterEstado) {
        params.estado = filterEstado;
      }
      if (filterJurisdiccion) {
        params.tipo_proceso = filterJurisdiccion;
      }

      const res = await api.get('/procesos', { params });
      setProcesos(res.data.procesos || []);
      setPagination(res.data.pagination || null);
    } catch (error) {
      console.error('Error fetching processes:', error);
      toast.error('Error al obtener expedientes filtrados');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientesRes, usuariosRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/admin/usuarios').catch(() => null) // Suppress if not admin
      ]);

      setClientes(clientesRes.data);
      
      if (clientesRes.data.length > 0) {
        setIdCliente(clientesRes.data[0].id_cliente);
      }

      if (usuariosRes && usuariosRes.data) {
        setAbogados(usuariosRes.data);
        if (usuariosRes.data.length > 0) {
          setIdAbogadoResp(usuariosRes.data[0].id_usuario);
        }
      } else {
        const cachedUser = JSON.parse(localStorage.getItem('user'));
        if (cachedUser) {
          setAbogados([cachedUser]);
          setIdAbogadoResp(cachedUser.id_usuario);
        }
      }

      await fetchProcesos();
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la información de expedientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Multi-filtering search listener with debounce
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        // Trigger fetch if search term length is empty OR >= 3 characters
        if (search.trim().length === 0 || search.trim().length >= 3) {
          fetchProcesos();
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [search, filterEstado, filterJurisdiccion, page]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        numero_radicado: numeroRadicado,
        juzgado,
        tipo_proceso: tipoProceso,
        clase_proceso: claseProceso,
        area_derecho: areaDerecho,
        fecha_radicado: fechaRadicado || null,
        id_cliente: idCliente,
        id_abogado_resp: idAbogadoResp
      };

      const res = await api.post('/procesos', data);
      toast.success(res.data.message || 'Expediente creado exitosamente');
      setShowModal(false);
      
      // Reset form
      setNumeroRadicado('');
      setJuzgado('');
      setClaseProceso('');
      setAreaDerecho('');
      setFechaRadicado('');
      
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al crear el expediente');
    }
  };
  const handleDeleteConfirm = async (e) => {
    e.preventDefault();
    if (!deleteJustificacion.trim()) {
      toast.error('Debe ingresar una justificación escrita.');
      return;
    }
    
    try {
      setIsDeleting(true);
      const res = await api.delete(`/procesos/${deletingProceso.id_proceso}`, {
        data: { justificacion: deleteJustificacion }
      });
      toast.success(res.data.message || 'Expediente eliminado definitivamente con éxito.');
      setShowDeleteModal(false);
      setDeletingProceso(null);
      fetchProcesos(); // Reload processes
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al intentar eliminar el expediente.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-fade-in relative items-start pb-16">
      {/* Left Column: List */}
      <div className={`transition-all duration-300 space-y-8 ${showModal ? 'w-full lg:w-2/3' : 'w-full'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">
            Expedientes Jurídicos
          </h1>
          <p className="text-neutral-400 mt-1">
            Administra los radicados, juzgados e historial inmutable de procesos.
          </p>
        </div>
        <button
          onClick={() => {
            if (clientes.length === 0) {
              toast.error('Primero debes registrar al menos un cliente.');
              navigate('/clientes');
              return;
            }
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-[0_4px_20px_rgba(223,185,113,0.3)] cursor-pointer text-sm"
        >
          <Plus size={18} />
          <span>Nuevo Expediente</span>
        </button>
      </div>

      {/* Multi-Filters Bar (HU-31) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Buscar por radicado, cliente, abogado..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset page on new search
            }}
            className="w-full bg-neutral-950/40 backdrop-blur-xl border border-white/10 focus:border-[#DFB971] shadow-[0_4px_16px_rgba(0,0,0,0.4)] focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-neutral-500 transition-colors"
          />
          {search.trim().length > 0 && search.trim().length < 3 && (
            <span className="absolute left-3 -bottom-5 text-[10px] text-neutral-500 animate-pulse">
              Escribe al menos 3 caracteres...
            </span>
          )}
        </div>

        {/* Estado Filter */}
        <div>
          <select
            value={filterEstado}
            onChange={(e) => {
              setFilterEstado(e.target.value);
              setPage(1); // Reset page
            }}
            className="w-full bg-neutral-950/40 backdrop-blur-xl border border-white/10 focus:border-[#DFB971] shadow-[0_4px_16px_rgba(0,0,0,0.4)] focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300 cursor-pointer"
          >
            <option value="">Todos los Estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="ARCHIVADO">Archivado</option>
            <option value="FINALIZADO">Finalizado</option>
          </select>
        </div>

        {/* Jurisdicción Filter */}
        <div>
          <select
            value={filterJurisdiccion}
            onChange={(e) => {
              setFilterJurisdiccion(e.target.value);
              setPage(1); // Reset page
            }}
            className="w-full bg-neutral-950/40 backdrop-blur-xl border border-white/10 focus:border-[#DFB971] shadow-[0_4px_16px_rgba(0,0,0,0.4)] focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300 cursor-pointer"
          >
            <option value="">Todas las Jurisdicciones</option>
            <option value="CIVIL">Civil</option>
            <option value="PENAL">Penal</option>
            <option value="LABORAL">Laboral</option>
            <option value="FAMILIA">Familia</option>
            <option value="ADMINISTRATIVO">Contencioso Administrativo</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : procesos.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10">
          <Briefcase className="mx-auto text-neutral-700 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-neutral-300">No se encontraron expedientes</h3>
          <p className="text-neutral-500 mt-1 text-sm">Pruebe modificando los filtros o cree un expediente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {procesos.map((proceso) => (
            <div
              key={proceso.id_proceso}
              onClick={() => navigate(`/procesos/${proceso.id_proceso}`)}
              className="group relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 hover:border-[#DFB971]/50 transition-all duration-300 cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] animate-fade-in"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold text-white group-hover:text-[#DFB971] transition-colors">
                    Radicado: {proceso.numero_radicado}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    proceso.estado === 'ACTIVO' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : proceso.estado === 'SUSPENDIDO'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-white/5 text-neutral-400 border border-white/10'
                  }`}>
                    {proceso.estado}
                  </span>
                </div>
                <p className="text-sm text-neutral-300 line-clamp-1">{proceso.juzgado}</p>
                
                <div className="flex flex-wrap gap-4 text-xs text-neutral-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-neutral-600" />
                    <span className="text-neutral-400 font-medium">Cliente: {proceso.cliente?.nombre || proceso.cliente?.razon_social}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck size={13} className="text-neutral-600" />
                    <span className="text-neutral-400">Responsable: {proceso.abogado_resp?.nombre}</span>
                  </div>
                  {proceso.fecha_radicado && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-neutral-600" />
                      <span>Radicado el: {new Date(proceso.fecha_radicado).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                {currentUser?.rol === 'ADMINISTRADOR' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Avoid card click navigation!
                      setDeletingProceso(proceso);
                      setDeleteStep(1);
                      setDeleteJustificacion('');
                      setShowDeleteModal(true);
                    }}
                    className="p-2 bg-white/5 border border-white/10 hover:border-rose-500/50 hover:bg-rose-500/10 text-neutral-500 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                    title="Eliminar Expediente Definitivamente"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <span className="text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">Administrar</span>
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-[#DFB971] group-hover:border-[#DFB971]/50 transition-colors">
                  <ArrowRight size={16} />
                </div>
              </div>
              
              {/* Decorative premium card accent */}
              <div className="absolute inset-y-0 left-0 w-[2px] bg-[#DFB971] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-2xl" />
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls (HU-31) */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 pt-6">
          <p className="text-xs text-neutral-500">
            Mostrando página <span className="text-white font-bold">{pagination.page}</span> de <span className="text-white font-bold">{pagination.pages}</span> ({pagination.total} registros en total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-400 hover:text-[#DFB971] disabled:opacity-40 disabled:hover:text-neutral-400 cursor-pointer disabled:cursor-not-allowed transition-all text-xs font-bold flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-400 hover:text-[#DFB971] disabled:opacity-40 disabled:hover:text-neutral-400 cursor-pointer disabled:cursor-not-allowed transition-all text-xs font-bold flex items-center gap-1"
            >
              <span>Siguiente</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Right Column: Side Panel Form */}
      {showModal && (
        <div className="w-full lg:w-1/3 bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] sticky top-0 h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar animate-fade-in">
          <div className="relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-0 right-0 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent mb-6 pr-8">
              Abrir Nuevo Expediente
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-5">
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Cliente del Proceso
                  </label>
                  <select
                    value={idCliente}
                    onChange={(e) => setIdCliente(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 text-white focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm cursor-pointer"
                  >
                    {clientes.map(cli => (
                      <option key={cli.id_cliente} value={cli.id_cliente}>
                        {cli.nombre} ({cli.numero_documento})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Número de Radicado (Único)
                  </label>
                  <input
                    type="text"
                    required
                    value={numeroRadicado}
                    onChange={(e) => setNumeroRadicado(e.target.value)}
                    placeholder="Ej. 110014003002202600123"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Despacho / Juzgado
                  </label>
                  <input
                    type="text"
                    required
                    value={juzgado}
                    onChange={(e) => setJuzgado(e.target.value)}
                    placeholder="Ej. Juzgado 5 Civil Municipal"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Jurisdicción / Tipo Proceso
                  </label>
                  <select
                    value={tipoProceso}
                    onChange={(e) => setTipoProceso(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 text-white focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm cursor-pointer"
                  >
                    <option value="CIVIL">Civil</option>
                    <option value="PENAL">Penal</option>
                    <option value="LABORAL">Laboral</option>
                    <option value="FAMILIA">Familia</option>
                    <option value="ADMINISTRATIVO">Contencioso Administrativo</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Clase de Proceso
                  </label>
                  <input
                    type="text"
                    value={claseProceso}
                    onChange={(e) => setClaseProceso(e.target.value)}
                    placeholder="Ej. Ejecutivo, Ordinario"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Área del Derecho
                  </label>
                  <input
                    type="text"
                    value={areaDerecho}
                    onChange={(e) => setAreaDerecho(e.target.value)}
                    placeholder="Ej. Comercial, Civil"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500"
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
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Abogado Responsable del Caso
                  </label>
                  <select
                    value={idAbogadoResp}
                    onChange={(e) => setIdAbogadoResp(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 text-white focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm cursor-pointer"
                  >
                    {abogados.map(abogado => (
                      <option key={abogado.id_usuario} value={abogado.id_usuario}>
                        {abogado.nombre} ({abogado.rol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Footer */}
              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black shadow-[0_0_15px_rgba(223,185,113,0.3)] font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm"
                >
                  Abrir Expediente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Cascade Delete Proceso (HU-34) */}
      {showDeleteModal && deletingProceso && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950/90 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-8 shadow-[0_0_40px_rgba(225,29,72,0.3)] animate-scale-in my-8">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <ShieldAlert size={36} />
              <h2 className="text-2xl font-bold">
                Eliminación Definitiva
              </h2>
            </div>

            {deleteStep === 1 ? (
              <div className="space-y-6">
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Está a punto de eliminar de forma permanente el expediente con radicado:
                  <br />
                  <strong className="text-white text-base font-bold block mt-1">{deletingProceso.numero_radicado}</strong>
                </p>
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2 text-xs text-rose-400">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Consecuencias del borrado en cascada:</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Se borrarán los co-defensores y colaboradores asignados.</li>
                    <li>Se eliminarán partes procesales, audiencias e historial inmutable.</li>
                    <li>Esta acción quedará registrada permanentemente en la bitácora de auditoría.</li>
                  </ul>
                  <p className="font-semibold mt-2">
                    Nota: El sistema no permitirá la eliminación si el expediente posee documentos soporte activos o términos judiciales pendientes sin gestionar.
                  </p>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm"
                  >
                    Entendido, Continuar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDeleteConfirm} className="space-y-6">
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Justificación Escrita (Obligatoria)
                  </p>
                  <textarea
                    required
                    rows={4}
                    value={deleteJustificacion}
                    onChange={(e) => setDeleteJustificacion(e.target.value)}
                    placeholder="Escriba detalladamente el motivo de la eliminación definitiva para la bitácora de auditoría..."
                    className="w-full bg-white/5 border border-white/10 focus:border-rose-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white resize-none placeholder-neutral-500"
                  />
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeleteStep(1)}
                    className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold disabled:opacity-40"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={isDeleting}
                    className="bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        <span>Eliminar Definitivamente</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
