import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import { 
  ArrowLeft, User, Building2, Phone, Mail, MapPin, Calendar, FileText, 
  Briefcase, Plus, AlertCircle, Eye, ShieldAlert, Award, FileCode2, X
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClienteFicha() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProcesoModal, setShowProcesoModal] = useState(false);

  // Portal Access States
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [enablingPortal, setEnablingPortal] = useState(false);

  // Form states for creating a Proceso directly for this client
  const [numeroRadicado, setNumeroRadicado] = useState('');
  const [juzgado, setJuzgado] = useState('');
  const [tipoProceso, setTipoProceso] = useState('CIVIL');
  const [claseProceso, setClaseProceso] = useState('');
  const [areaDerecho, setAreaDerecho] = useState('');
  const [fechaRadicado, setFechaRadicado] = useState('');
  const [abogados, setAbogados] = useState([]);
  const [idAbogadoResp, setIdAbogadoResp] = useState('');

  const fetchCliente = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/clientes/${id}`);
      setCliente(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la ficha del cliente');
      navigate('/clientes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAbogados = async () => {
    try {
      // In a real application we would have a GET /usuarios endpoint or similar
      // Since we just registered the admin endpoints, we can fetch from GET /admin/usuarios
      const res = await api.get('/admin/usuarios');
      setAbogados(res.data);
      if (res.data.length > 0) {
        setIdAbogadoResp(res.data[0].id_usuario);
      }
    } catch (error) {
      console.error('No se pudieron obtener abogados, usando el usuario actual:', error);
      // Fallback: the logged in user is the responsible lawyer by default
      const currentUser = JSON.parse(localStorage.getItem('user'));
      if (currentUser) {
        setAbogados([currentUser]);
        setIdAbogadoResp(currentUser.id_usuario);
      }
    }
  };

  useEffect(() => {
    fetchCliente();
    fetchAbogados();
  }, [id]);

  const handleEnablePortalAccess = async (e) => {
    e.preventDefault();
    if (!portalPassword) {
      toast.error('La contraseña es obligatoria');
      return;
    }
    try {
      setEnablingPortal(true);
      const res = await api.post(`/clientes/${id}/portal-access`, { password: portalPassword });
      toast.success(res.data.message || 'Acceso al portal habilitado con éxito.');
      setShowPortalModal(false);
      setPortalPassword('');
      fetchCliente();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al habilitar el acceso al portal.');
    } finally {
      setEnablingPortal(false);
    }
  };

  const handleCreateProceso = async (e) => {
    e.preventDefault();
    try {
      const data = {
        numero_radicado: numeroRadicado,
        juzgado,
        tipo_proceso: tipoProceso,
        clase_proceso: claseProceso,
        area_derecho: areaDerecho,
        fecha_radicado: fechaRadicado || null,
        id_cliente: id,
        id_abogado_resp: idAbogadoResp
      };

      await api.post('/procesos', data);
      toast.success('Expediente creado exitosamente');
      setShowProcesoModal(false);
      
      // Reset form
      setNumeroRadicado('');
      setJuzgado('');
      setClaseProceso('');
      setAreaDerecho('');
      setFechaRadicado('');
      
      // Refresh client data (which includes processes)
      fetchCliente();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al crear el expediente');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-white border-neutral-800 animate-spin" />
        <p className="text-neutral-400 text-sm">Cargando ficha del cliente...</p>
      </div>
    );
  }

  if (!cliente) return null;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/clientes')}
          className="p-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
            Ficha de Cliente
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">
            {cliente.nombre}
          </h1>
        </div>
      </div>

      {/* Grid: Details and Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile Card */}
        <div className="lg:col-span-1 bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] space-y-6">
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 rounded-2xl bg-[#DFB971]/10 border border-[#DFB971]/30 flex items-center justify-center mb-4 text-[#DFB971] shadow-[0_0_15px_rgba(223,185,113,0.15)]">
              {cliente.tipo === 'NATURAL' ? <User size={40} /> : <Building2 size={40} />}
            </div>
            <h2 className="text-xl font-bold text-white">{cliente.nombre}</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold mt-2 ${
              cliente.tipo === 'NATURAL' 
                ? 'bg-white/5 text-white border border-white/10' 
                : 'bg-[#DFB971]/10 text-[#DFB971] border border-[#DFB971]/20'
            }`}>
              {cliente.tipo === 'NATURAL' ? 'Persona Natural' : 'Persona Jurídica'}
            </span>
          </div>

          <div className="border-t border-white/10 pt-6 space-y-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              Información de Identificación
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-400">Documento</span>
                <span className="text-white font-medium">{cliente.tipo_documento} {cliente.numero_documento}</span>
              </div>
              
              {cliente.tipo === 'JURIDICA' && (
                <>
                  {cliente.nit && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-neutral-400">NIT</span>
                      <span className="text-white font-medium">{cliente.nit}</span>
                    </div>
                  )}
                  {cliente.representante && (
                    <div className="flex flex-col text-sm gap-1 pt-1">
                      <span className="text-neutral-400">Representante Legal</span>
                      <span className="text-white font-medium">{cliente.representante}</span>
                    </div>
                  )}
                </>
              )}

              {cliente.tipo === 'NATURAL' && cliente.fecha_nacimiento && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-400">Fecha de Nacimiento</span>
                  <span className="text-white font-medium flex items-center gap-1.5">
                    <Calendar size={14} className="text-neutral-500" />
                    {new Date(cliente.fecha_nacimiento).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 space-y-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              Datos de Contacto
            </h3>
            
            <div className="space-y-3.5 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#DFB971]/5 border border-[#DFB971]/20 flex items-center justify-center text-[#DFB971]">
                  <Phone size={14} />
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Teléfono</p>
                  <p className="text-white font-medium">{cliente.telefono}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#DFB971]/5 border border-[#DFB971]/20 flex items-center justify-center text-[#DFB971]">
                  <Mail size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-500">Correo Electrónico</p>
                  <p className="text-white font-medium truncate">{cliente.email}</p>
                </div>
              </div>

              {cliente.direccion && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#DFB971]/5 border border-[#DFB971]/20 flex items-center justify-center text-[#DFB971]">
                    <MapPin size={14} />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Dirección</p>
                    <p className="text-white font-medium">{cliente.direccion}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Portal Access Trigger */}
          <div className="border-t border-white/10 pt-6 space-y-3">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
              <FileCode2 size={13} />
              Portal del Cliente
            </h3>
            <p className="text-[11px] text-neutral-400">
              Permite al cliente ingresar a su portal para revisar sus procesos, novedades y documentos.
            </p>
            {cliente.tiene_acceso_portal ? (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold px-4 py-2.5 rounded-xl transition-all cursor-not-allowed text-xs"
              >
                <AlertCircle size={14} />
                <span>Acceso al Portal Habilitado</span>
              </button>
            ) : (
              <button
                onClick={() => setShowPortalModal(true)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs shadow-[0_0_15px_rgba(223,185,113,0.3)]"
              >
                <Award size={14} />
                <span>Habilitar Acceso al Portal</span>
              </button>
            )}
          </div>
        </div>

        {/* Processes/Cases section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Briefcase size={22} className="text-[#DFB971]" />
              <h2 className="text-xl font-bold text-white">Expedientes Asociados</h2>
            </div>
            <button
              onClick={() => setShowProcesoModal(true)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-[#DFB971]/50 hover:bg-white/10 text-[#DFB971] text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Abrir Expediente</span>
            </button>
          </div>

          {/* List of Processes */}
          {!cliente.procesos || cliente.procesos.length === 0 ? (
            <div className="text-center py-20 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10">
              <Briefcase className="mx-auto text-neutral-800 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-neutral-300">No hay expedientes activos</h3>
              <p className="text-neutral-500 mt-1 text-sm">Este cliente aún no tiene procesos jurídicos registrados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cliente.procesos.map((proceso) => (
                <div
                  key={proceso.id_proceso}
                  onClick={() => navigate(`/procesos/${proceso.id_proceso}`)}
                  className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 hover:border-[#DFB971]/50 transition-all duration-300 cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white group-hover:text-neutral-200">
                        Radicado: {proceso.numero_radicado}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400">
                        {proceso.estado}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400 line-clamp-1">{proceso.juzgado}</p>
                    <div className="flex gap-4 text-xs text-neutral-500 pt-1">
                      <span>Tipo: {proceso.tipo_proceso}</span>
                      {proceso.area_derecho && <span>Área: {proceso.area_derecho}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500">Ver Detalles</span>
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-[#DFB971] group-hover:border-[#DFB971]/50 transition-colors">
                      <Eye size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal - Create Proceso */}
      {showProcesoModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-neutral-950/90 backdrop-blur-2xl border border-[#DFB971]/30 rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] animate-scale-in my-8">
            <button
              onClick={() => setShowProcesoModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent mb-2">
              Abrir Nuevo Expediente
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Registra un nuevo proceso judicial asignado a <span className="text-white font-semibold">{cliente.nombre}</span>.
            </p>

            <form onSubmit={handleCreateProceso} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
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
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Jurisdicción / Tipo Proceso
                  </label>
                  <select
                    value={tipoProceso}
                    onChange={(e) => setTipoProceso(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                    placeholder="Ej. Comercial, Familia"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Abogado Responsable del Caso
                  </label>
                  <select
                    value={idAbogadoResp}
                    onChange={(e) => setIdAbogadoResp(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                  onClick={() => setShowProcesoModal(false)}
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
        </div>,
        document.body
      )}

      {/* Modal - Habilitar Acceso al Portal */}
      {showPortalModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-neutral-950/90 backdrop-blur-2xl border border-[#DFB971]/30 rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] animate-scale-in">
            <button
              onClick={() => {
                setShowPortalModal(false);
                setPortalPassword('');
              }}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent mb-2">
              Habilitar Acceso al Portal
            </h2>
            <p className="text-xs text-neutral-400 mb-6">
              Se creará una cuenta de usuario exclusiva para <span className="text-white font-medium">{cliente.nombre}</span> utilizando su correo electrónico <span className="text-white font-medium">{cliente.email}</span>.
            </p>

            <form onSubmit={handleEnablePortalAccess} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Contraseña del Cliente
                </label>
                <input
                  type="password"
                  required
                  value={portalPassword}
                  onChange={(e) => setPortalPassword(e.target.value)}
                  placeholder="Ingrese contraseña temporal"
                  className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                />
                <p className="text-[10px] text-neutral-500">
                  Esta contraseña se le debe proporcionar de forma segura al cliente para su primer inicio de sesión.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowPortalModal(false);
                    setPortalPassword('');
                  }}
                  className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enablingPortal}
                  className="bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50 shadow-[0_0_15px_rgba(223,185,113,0.3)]"
                >
                  {enablingPortal ? 'Procesando...' : 'Habilitar Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
