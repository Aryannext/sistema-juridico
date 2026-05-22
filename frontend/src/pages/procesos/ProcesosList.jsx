import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Briefcase, Plus, Search, Calendar, User, FileText, ArrowRight, X, UserCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function ProcesosList() {
  const [procesos, setProcesos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [abogados, setAbogados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [procesosRes, clientesRes, usuariosRes] = await Promise.all([
        api.get('/procesos'),
        api.get('/clientes'),
        api.get('/admin/usuarios').catch(() => null) // Suppress if not admin
      ]);

      setProcesos(procesosRes.data);
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
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser) {
          setAbogados([currentUser]);
          setIdAbogadoResp(currentUser.id_usuario);
        }
      }
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

  const filteredProcesos = procesos.filter(proceso => {
    const term = search.toLowerCase();
    const matchRadicado = proceso.numero_radicado?.includes(term);
    const matchJuzgado = proceso.juzgado?.toLowerCase().includes(term);
    const matchCliente = proceso.cliente?.nombre?.toLowerCase().includes(term) || proceso.cliente?.razon_social?.toLowerCase().includes(term);
    const matchAbogado = proceso.abogado_resp?.nombre?.toLowerCase().includes(term);
    return matchRadicado || matchJuzgado || matchCliente || matchAbogado;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
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
          className="flex items-center justify-center gap-2 bg-white hover:bg-neutral-200 text-black font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-[0_4px_20px_rgba(255,255,255,0.15)] cursor-pointer text-sm"
        >
          <Plus size={18} />
          <span>Nuevo Expediente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Buscar por radicado, cliente, abogado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-neutral-500 transition-colors"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-neutral-950 border border-neutral-900 animate-pulse" />
          ))}
        </div>
      ) : filteredProcesos.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-neutral-950/50 border border-neutral-900">
          <Briefcase className="mx-auto text-neutral-700 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-neutral-300">No se encontraron expedientes</h3>
          <p className="text-neutral-500 mt-1 text-sm">Crea tu primer expediente jurídico haciendo clic en "Nuevo Expediente".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProcesos.map((proceso) => (
            <div
              key={proceso.id_proceso}
              onClick={() => navigate(`/procesos/${proceso.id_proceso}`)}
              className="group relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-b from-neutral-950 to-neutral-900/60 border border-neutral-800 hover:border-neutral-700 transition-all duration-300 cursor-pointer shadow-lg"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold text-white group-hover:text-neutral-200 transition-colors">
                    Radicado: {proceso.numero_radicado}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    proceso.estado === 'ACTIVO' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
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
                <span className="text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">Administrar</span>
                <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors">
                  <ArrowRight size={16} />
                </div>
              </div>
              
              {/* Decorative premium card accent */}
              <div className="absolute inset-y-0 left-0 w-[2px] bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-2xl" />
            </div>
          ))}
        </div>
      )}

      {/* Modal - Create Proceso */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-6">
              Abrir Nuevo Expediente
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Cliente del Proceso
                  </label>
                  <select
                    value={idCliente}
                    onChange={(e) => setIdCliente(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Jurisdicción / Tipo Proceso
                  </label>
                  <select
                    value={tipoProceso}
                    onChange={(e) => setTipoProceso(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
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

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Abogado Responsable del Caso
                  </label>
                  <select
                    value={idAbogadoResp}
                    onChange={(e) => setIdAbogadoResp(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
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
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm"
                >
                  Abrir Expediente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
