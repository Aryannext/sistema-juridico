import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Plus, Search, User, Building2, Phone, Mail, FileText, ArrowRight, X, Calendar, MapPin, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientesList() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  // Form states
  const [tipo, setTipo] = useState('NATURAL');
  const [nombre, setNombre] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [nit, setNit] = useState('');
  const [representante, setRepresentante] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/clientes');
      setClientes(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la lista de clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        tipo,
        nombre: tipo === 'NATURAL' ? nombre : (razonSocial || nombre),
        razon_social: tipo === 'JURIDICA' ? razonSocial : null,
        tipo_documento: tipo === 'NATURAL' ? tipoDocumento : 'NIT',
        numero_documento: tipo === 'NATURAL' ? numeroDocumento : nit,
        nit: tipo === 'JURIDICA' ? nit : null,
        representante: tipo === 'JURIDICA' ? representante : null,
        telefono,
        email,
        direccion,
        fecha_nacimiento: tipo === 'NATURAL' && fechaNacimiento ? fechaNacimiento : null,
      };

      const res = await api.post('/clientes', data);
      toast.success(res.data.message || 'Cliente creado exitosamente');
      setShowModal(false);
      
      // Reset form
      setNombre('');
      setRazonSocial('');
      setNumeroDocumento('');
      setNit('');
      setRepresentante('');
      setTelefono('');
      setEmail('');
      setDireccion('');
      setFechaNacimiento('');
      
      fetchClientes();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al crear el cliente');
    }
  };

  const filteredClientes = clientes.filter(cliente => {
    const term = search.toLowerCase();
    const matchNombre = cliente.nombre?.toLowerCase().includes(term);
    const matchRazon = cliente.razon_social?.toLowerCase().includes(term);
    const matchDoc = cliente.numero_documento?.includes(term);
    const matchEmail = cliente.email?.toLowerCase().includes(term);
    return matchNombre || matchRazon || matchDoc || matchEmail;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
            Gestión de Clientes
          </h1>
          <p className="text-neutral-400 mt-1">
            Administra los expedientes de personas naturales y jurídicas de tu consultorio.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-white hover:bg-neutral-200 text-black font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-[0_4px_20px_rgba(255,255,255,0.15)] cursor-pointer"
        >
          <Plus size={20} />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Buscar por nombre, documento o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-neutral-500 transition-colors"
        />
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-48 rounded-2xl bg-neutral-950 border border-neutral-900 animate-pulse" />
          ))}
        </div>
      ) : filteredClientes.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-neutral-950/50 border border-neutral-900">
          <User className="mx-auto text-neutral-700 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-neutral-300">No se encontraron clientes</h3>
          <p className="text-neutral-500 mt-1 text-sm">Prueba registrando un nuevo cliente en el botón superior.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClientes.map((cliente) => (
            <div
              key={cliente.id_cliente}
              onClick={() => navigate(`/clientes/${cliente.id_cliente}`)}
              className="group relative rounded-2xl bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 hover:border-neutral-700 p-6 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  cliente.tipo === 'NATURAL' 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {cliente.tipo === 'NATURAL' ? 'Persona Natural' : 'Persona Jurídica'}
                </span>
                <span className="text-neutral-500 group-hover:text-white transition-colors">
                  <ArrowRight size={18} />
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-neutral-200 transition-colors">
                {cliente.nombre}
              </h3>
              
              <div className="space-y-2.5 text-sm text-neutral-400 mt-4">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-neutral-500" />
                  <span>{cliente.tipo_documento}: {cliente.numero_documento}</span>
                </div>
                {cliente.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-neutral-500" />
                    <span>{cliente.telefono}</span>
                  </div>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-neutral-500" />
                    <span className="truncate">{cliente.email}</span>
                  </div>
                )}
              </div>
              
              {/* Decorative premium card accent */}
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-neutral-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          ))}
        </div>
      )}

      {/* Modal - Create Cliente */}
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
              Registrar Nuevo Cliente
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Cliente Select */}
              <div className="grid grid-cols-2 gap-4 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setTipo('NATURAL')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    tipo === 'NATURAL' 
                      ? 'bg-neutral-800 text-white shadow-sm' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <User size={16} />
                  <span>Persona Natural</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('JURIDICA')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    tipo === 'JURIDICA' 
                      ? 'bg-neutral-800 text-white shadow-sm' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Building2 size={16} />
                  <span>Persona Jurídica</span>
                </button>
              </div>

              {/* Dynamic Inputs depending on type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tipo === 'NATURAL' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        required
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Tipo de Documento
                      </label>
                      <select
                        value={tipoDocumento}
                        onChange={(e) => setTipoDocumento(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                      >
                        <option value="CC">Cédula de Ciudadanía</option>
                        <option value="CE">Cédula de Extranjería</option>
                        <option value="PASAPORTE">Pasaporte</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Número de Documento
                      </label>
                      <input
                        type="text"
                        required
                        value={numeroDocumento}
                        onChange={(e) => setNumeroDocumento(e.target.value)}
                        placeholder="Ej. 10293847"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                        <Calendar size={14} /> Fecha de Nacimiento
                      </label>
                      <input
                        type="date"
                        value={fechaNacimiento}
                        onChange={(e) => setFechaNacimiento(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Razón Social
                      </label>
                      <input
                        type="text"
                        required
                        value={razonSocial}
                        onChange={(e) => setRazonSocial(e.target.value)}
                        placeholder="Ej. Inversiones SAS"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        NIT (con dígito de verificación)
                      </label>
                      <input
                        type="text"
                        required
                        value={nit}
                        onChange={(e) => setNit(e.target.value)}
                        placeholder="Ej. 900.123.456-7"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Representante Legal
                      </label>
                      <input
                        type="text"
                        required
                        value={representante}
                        onChange={(e) => setRepresentante(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                      />
                    </div>
                  </>
                )}

                {/* Common Fields */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. 3001234567"
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <MapPin size={14} /> Dirección de correspondencia
                  </label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle 123 # 45 - 67, Oficina 101"
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm"
                  />
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
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
