import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Users, Shield, ShieldCheck, Mail, Calendar, KeyRound, Loader2, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPermisos, setLoadingPermisos] = useState(false);
  const [savingPermisos, setSavingPermisos] = useState(false);
  
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ nombre: '', email: '', password: '', rol: 'ASISTENTE' });
  const [creatingUser, setCreatingUser] = useState(false);

  // Available modules for granular control
  const modulos = ['CLIENTES', 'PROCESOS', 'DOCS', 'AUDIENCIAS', 'TERMINO'];

  // Map Spanish names for cleaner UI
  const moduloNombres = {
    CLIENTES: 'Clientes y Fichas',
    PROCESOS: 'Expedientes Jurídicos',
    DOCS: 'Documentos y Expedientes',
    AUDIENCIAS: 'Agenda de Audiencias',
    TERMINO: 'Control de Términos'
  };

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await api.get('/admin/usuarios');
      setUsuarios(res.data);
      // Automatically select first user if available
      if (res.data.length > 0) {
        handleSelectUser(res.data[0]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la lista de colaboradores.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch permissions for a specific user
  const handleSelectUser = async (user) => {
    setSelectedUsuario(user);
    if (user.rol === 'ADMINISTRADOR') {
      setPermisos([]); // Admins have total permissions by default
      return;
    }

    try {
      setLoadingPermisos(true);
      const res = await api.get(`/admin/permisos/${user.id_usuario}`);
      
      // Initialize full matrix even if database only has partial records
      const fullPermisos = modulos.map(m => {
        const dbPerm = res.data.find(dp => dp.modulo === m);
        return {
          modulo: m,
          puede_leer: dbPerm ? dbPerm.puede_leer : false,
          puede_crear: dbPerm ? dbPerm.puede_crear : false,
          puede_editar: dbPerm ? dbPerm.puede_editar : false,
          puede_eliminar: dbPerm ? dbPerm.puede_eliminar : false
        };
      });
      
      setPermisos(fullPermisos);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar los privilegios del colaborador.');
    } finally {
      setLoadingPermisos(false);
    }
  };

  // Toggle action in the permission matrix local state
  const handlePermissionToggle = (modulo, accion) => {
    if (selectedUsuario?.rol === 'ADMINISTRADOR') return;

    setPermisos(prev =>
      prev.map(p => {
        if (p.modulo === modulo) {
          return {
            ...p,
            [accion]: !p[accion]
          };
        }
        return p;
      })
    );
  };

  // Persist permissions changes to backend
  const handleSavePermisos = async () => {
    if (!selectedUsuario || selectedUsuario.rol === 'ADMINISTRADOR') return;

    try {
      setSavingPermisos(true);
      const res = await api.put(`/admin/permisos/${selectedUsuario.id_usuario}`, {
        permisos: permisos
      });
      toast.success(res.data.message || 'Privilegios actualizados con éxito.');
    } catch (error) {
      console.error(error);
      toast.error('Error al intentar guardar los privilegios.');
    } finally {
      setSavingPermisos(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setCreatingUser(true);
      const res = await api.post('/admin/usuarios', newUser);
      toast.success(res.data.message || 'Colaborador creado con éxito.');
      setShowNewUserForm(false);
      setNewUser({ nombre: '', email: '', password: '', rol: 'ASISTENTE' });
      fetchUsers(); // Refresh list
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al crear el colaborador.');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent flex items-center gap-3">
            <KeyRound className="text-[#DFB971]" size={32} />
            <span>Usuarios y Permisos Granulares</span>
          </h1>
          <p className="text-neutral-400 mt-1">
            Asigna privilegios específicos de lectura, escritura y eliminación por cada módulo a los abogados del consultorio.
          </p>
        </div>
        <button
          onClick={() => setShowNewUserForm(true)}
          className="flex items-center gap-2 bg-[#DFB971] hover:bg-[#c29b4f] text-black font-bold px-5 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(223,185,113,0.3)] hover:scale-105 cursor-pointer"
        >
          <Sparkles size={18} />
          Nuevo Colaborador
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Users List */}
        <div className="lg:col-span-1 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 flex flex-col h-[600px] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users size={18} className="text-neutral-400" />
            Colaboradores de la Firma
          </h2>

          {loadingUsers ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-neutral-500" size={28} />
              <span className="text-xs text-neutral-500">Cargando equipo...</span>
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Users className="text-neutral-700 mb-3" size={36} />
              <span className="text-sm font-semibold text-neutral-400">Sin colaboradores</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {usuarios.map(userItem => {
                const isSelected = selectedUsuario?.id_usuario === userItem.id_usuario && !showNewUserForm;
                return (
                  <div
                    key={userItem.id_usuario}
                    onClick={() => {
                      setShowNewUserForm(false);
                      handleSelectUser(userItem);
                    }}
                    className={`group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-1.5 overflow-hidden ${
                      isSelected
                        ? 'bg-white/10 border-[#DFB971]/50 shadow-[0_0_15px_rgba(223,185,113,0.15)] transform scale-[1.02]'
                        : 'bg-white/5 border-white/10 hover:border-[#DFB971]/30 hover:bg-white/10 text-white'
                    }`}
                  >
                    {/* Decorative gold accent on selection */}
                    <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#C29B4F] to-[#E5C37A] transition-all duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                    
                    <div className="flex justify-between items-start pl-2">
                      <span className={`font-bold text-sm truncate max-w-[150px] transition-colors ${isSelected ? 'text-[#DFB971]' : 'text-white group-hover:text-[#FFF1C6]'}`}>{userItem.nombre}</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        isSelected 
                          ? 'bg-[#DFB971]/10 text-[#DFB971] border-[#DFB971]/20' 
                          : 'bg-white/5 text-neutral-400 border-white/10'
                      }`}>
                        {userItem.rol}
                      </span>
                    </div>

                    <div className={`flex items-center gap-1.5 text-xs pl-2 transition-colors ${
                      isSelected ? 'text-neutral-300' : 'text-neutral-500'
                    }`}>
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">{userItem.email}</span>
                    </div>

                    <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-white/10 pl-2">
                      <span className={`text-[10px] flex items-center gap-1 transition-colors ${
                        isSelected ? 'text-neutral-400' : 'text-neutral-600'
                      }`}>
                        <Calendar size={10} />
                        Creado {new Date(userItem.create_at).toLocaleDateString()}
                      </span>

                      <span className={`h-2 w-2 rounded-full ${
                        userItem.activo ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Permission Matrix or New User Form */}
        <div className="lg:col-span-2 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-4 lg:p-8 flex flex-col h-[600px] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] relative overflow-y-auto custom-scrollbar">
          
          {showNewUserForm ? (
            <div className="flex-1 flex flex-col animate-fade-in">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <UserCheck size={20} className="text-[#DFB971]" />
                  <h2 className="text-xl font-bold text-white">Registrar Nuevo Colaborador</h2>
                </div>
                <button onClick={() => setShowNewUserForm(false)} className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm">
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 max-w-lg mx-auto w-full mt-4">
                <div>
                  <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1 font-semibold">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={newUser.nombre}
                    onChange={(e) => setNewUser({...newUser, nombre: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-[#DFB971] focus:bg-white/10 outline-none rounded-xl px-4 py-3 text-sm transition-all"
                    placeholder="Ej. Ana Martínez"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1 font-semibold">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-[#DFB971] focus:bg-white/10 outline-none rounded-xl px-4 py-3 text-sm transition-all"
                    placeholder="ana@despacho.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1 font-semibold">Contraseña Inicial</label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-[#DFB971] focus:bg-white/10 outline-none rounded-xl px-4 py-3 text-sm transition-all"
                    placeholder="Asignar contraseña"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1 font-semibold">Rol del Sistema</label>
                  <select
                    value={newUser.rol}
                    onChange={(e) => setNewUser({...newUser, rol: e.target.value})}
                    className="w-full bg-[#111] border border-white/10 text-white placeholder-neutral-500 focus:border-[#DFB971] outline-none rounded-xl px-4 py-3 text-sm transition-all cursor-pointer"
                  >
                    <option value="ASISTENTE">Asistente Administrativo</option>
                    <option value="ABOGADO">Abogado Titular</option>
                  </select>
                </div>
                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="w-full bg-[#DFB971] hover:bg-[#c29b4f] text-black font-bold px-5 py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {creatingUser ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {creatingUser ? 'Registrando...' : 'Crear Colaborador'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Shield size={20} className="text-[#DFB971]" />
                  <h2 className="text-xl font-bold text-white">Matriz de Privilegios</h2>
                </div>
                
                {selectedUsuario && (
                  <span className="text-xs text-neutral-400">
                    Configurando para: <strong className="text-white">{selectedUsuario.nombre}</strong>
                  </span>
                )}
              </div>

          {selectedUsuario?.rol === 'ADMINISTRADOR' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
              <UserCheck className="text-[#DFB971] mb-4 animate-pulse drop-shadow-[0_0_10px_rgba(223,185,113,0.4)]" size={56} />
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="text-[#DFB971]" size={18} />
                Acceso Administrador Total
              </h3>
              <p className="text-neutral-400 text-sm max-w-sm mt-2 leading-relaxed">
                Este usuario posee el rol principal de <strong className="text-[#DFB971]">ADMINISTRADOR</strong>. El sistema le otorga acceso ilimitado de creación, edición, lectura y borrado en la totalidad de módulos por diseño.
              </p>
            </div>
          ) : loadingPermisos ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-neutral-400" size={32} />
              <span className="text-xs text-neutral-500">Cargando privilegios del colaborador...</span>
            </div>
          ) : !selectedUsuario ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <ShieldAlert className="text-neutral-700 mb-3" size={48} />
              <span className="text-sm text-neutral-400">Selecciona un colaborador para editar privilegios</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              
              {/* Permission Table */}
              <div className="overflow-auto flex-1 pr-1 custom-scrollbar">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400 text-xs font-semibold uppercase tracking-wider bg-white/5 backdrop-blur-sm">
                      <th className="py-3.5 pl-4 rounded-tl-xl">Módulo del Sistema</th>
                      <th className="py-3.5 text-center">Leer</th>
                      <th className="py-3.5 text-center">Crear</th>
                      <th className="py-3.5 text-center">Editar</th>
                      <th className="py-3.5 text-center rounded-tr-xl">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {permisos.map(p => (
                      <tr key={p.modulo} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 pl-4 font-semibold text-white">
                          <div className="group-hover:text-[#DFB971] transition-colors">{moduloNombres[p.modulo]}</div>
                          <span className="text-[10px] text-neutral-500 font-mono tracking-tight uppercase group-hover:text-neutral-400 transition-colors">
                            {p.modulo}
                          </span>
                        </td>
                        
                        {/* READ (Leer) */}
                        <td className="py-4 text-center">
                          <input
                            type="checkbox"
                            checked={p.puede_leer}
                            onChange={() => handlePermissionToggle(p.modulo, 'puede_leer')}
                            className="h-4.5 w-4.5 rounded border-white/20 bg-white/5 text-[#DFB971] focus:ring-[#DFB971]/50 focus:ring-offset-0 cursor-pointer accent-[#DFB971] transition-all"
                          />
                        </td>

                        {/* CREATE (Crear) */}
                        <td className="py-4 text-center">
                          <input
                            type="checkbox"
                            checked={p.puede_crear}
                            onChange={() => handlePermissionToggle(p.modulo, 'puede_crear')}
                            className="h-4.5 w-4.5 rounded border-white/20 bg-white/5 text-[#DFB971] focus:ring-[#DFB971]/50 focus:ring-offset-0 cursor-pointer accent-[#DFB971] transition-all"
                          />
                        </td>

                        {/* EDIT (Editar) */}
                        <td className="py-4 text-center">
                          <input
                            type="checkbox"
                            checked={p.puede_editar}
                            onChange={() => handlePermissionToggle(p.modulo, 'puede_editar')}
                            className="h-4.5 w-4.5 rounded border-white/20 bg-white/5 text-[#DFB971] focus:ring-[#DFB971]/50 focus:ring-offset-0 cursor-pointer accent-[#DFB971] transition-all"
                          />
                        </td>

                        {/* DELETE (Eliminar) */}
                        <td className="py-4 text-center">
                          <input
                            type="checkbox"
                            checked={p.puede_eliminar}
                            onChange={() => handlePermissionToggle(p.modulo, 'puede_eliminar')}
                            className="h-4.5 w-4.5 rounded border-white/20 bg-white/5 text-rose-500 focus:ring-rose-500/50 focus:ring-offset-0 cursor-pointer accent-rose-500 transition-all"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Footer */}
              <div className="flex justify-end pt-5 border-t border-white/10 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={handleSavePermisos}
                  disabled={savingPermisos}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold px-6 py-2.5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] cursor-pointer text-sm shadow-[0_4px_20px_rgba(223,185,113,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPermisos ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Guardar Privilegios</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}
          </>
        )}
        </div>

      </div>
    </div>
  );
}
