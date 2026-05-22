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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent flex items-center gap-3">
          <KeyRound className="text-white" size={32} />
          <span>Usuarios y Permisos Granulares</span>
        </h1>
        <p className="text-neutral-400 mt-1">
          Asigna privilegios específicos de lectura, escritura y eliminación por cada módulo a los abogados del consultorio.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Users List */}
        <div className="lg:col-span-1 rounded-2xl bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 p-6 flex flex-col h-[600px] shadow-lg">
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
                const isSelected = selectedUsuario?.id_usuario === userItem.id_usuario;
                return (
                  <div
                    key={userItem.id_usuario}
                    onClick={() => handleSelectUser(userItem)}
                    className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-white border-white text-black shadow-md transform scale-[1.01]'
                        : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 text-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm truncate max-w-[150px]">{userItem.nombre}</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isSelected 
                          ? 'bg-black/10 text-black' 
                          : 'bg-neutral-800 text-neutral-300'
                      }`}>
                        {userItem.rol}
                      </span>
                    </div>

                    <div className={`flex items-center gap-1.5 text-xs ${
                      isSelected ? 'text-neutral-700' : 'text-neutral-400'
                    }`}>
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">{userItem.email}</span>
                    </div>

                    <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-dashed border-current/10">
                      <span className={`text-[10px] flex items-center gap-1 ${
                        isSelected ? 'text-neutral-800' : 'text-neutral-500'
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

        {/* Right Column: Permission Matrix */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 p-8 flex flex-col h-[600px] shadow-lg">
          <div className="flex justify-between items-center mb-6 border-b border-neutral-900 pb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-neutral-400" />
              <h2 className="text-xl font-bold text-white">Matriz de Privilegios</h2>
            </div>
            
            {selectedUsuario && (
              <span className="text-xs text-neutral-400">
                Configurando para: <strong className="text-white">{selectedUsuario.nombre}</strong>
              </span>
            )}
          </div>

          {selectedUsuario?.rol === 'ADMINISTRADOR' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-900/30 rounded-2xl border border-neutral-800/40">
              <UserCheck className="text-white mb-4 animate-pulse" size={56} />
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="text-neutral-300" size={18} />
                Acceso Administrador Total
              </h3>
              <p className="text-neutral-400 text-sm max-w-sm mt-2 leading-relaxed">
                Este usuario posee el rol principal de <strong>ADMINISTRADOR</strong>. El sistema le otorga acceso ilimitado de creación, edición, lectura y borrado en la totalidad de módulos por diseño.
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
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3.5 pl-2">Módulo del Sistema</th>
                      <th className="py-3.5 text-center">Leer</th>
                      <th className="py-3.5 text-center">Crear</th>
                      <th className="py-3.5 text-center">Editar</th>
                      <th className="py-3.5 text-center">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900/60">
                    {permisos.map(p => (
                      <tr key={p.modulo} className="hover:bg-neutral-900/20 transition-colors">
                        <td className="py-4 pl-2 font-semibold text-white">
                          <div>{moduloNombres[p.modulo]}</div>
                          <span className="text-[10px] text-neutral-500 font-mono tracking-tight uppercase">
                            {p.modulo}
                          </span>
                        </td>
                        
                        {/* READ (Leer) */}
                        <td className="py-4 text-center">
                          <input
                            type="checkbox"
                            checked={p.puede_leer}
                            onChange={() => handlePermissionToggle(p.modulo, 'puede_leer')}
                            className="h-4.5 w-4.5 rounded border-neutral-800 bg-neutral-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer accent-white"
                          />
                        </td>

                        {/* CREATE (Crear) */}
                        <td className="py-4 text-center">
                          <input
                            type="checkbox"
                            checked={p.puede_crear}
                            onChange={() => handlePermissionToggle(p.modulo, 'puede_crear')}
                            className="h-4.5 w-4.5 rounded border-neutral-800 bg-neutral-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer accent-white"
                          />
                        </td>

                        {/* EDIT (Editar) */}
                        <td className="py-4 text-center">
                          <input
                            type="checkbox"
                            checked={p.puede_editar}
                            onChange={() => handlePermissionToggle(p.modulo, 'puede_editar')}
                            className="h-4.5 w-4.5 rounded border-neutral-800 bg-neutral-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer accent-white"
                          />
                        </td>

                        {/* DELETE (Eliminar) */}
                        <td className="py-4 text-center">
                          <input
                            type="checkbox"
                            checked={p.puede_eliminar}
                            onChange={() => handlePermissionToggle(p.modulo, 'puede_eliminar')}
                            className="h-4.5 w-4.5 rounded border-neutral-800 bg-neutral-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer accent-white"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Footer */}
              <div className="flex justify-end pt-4 border-t border-neutral-900 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={handleSavePermisos}
                  disabled={savingPermisos}
                  className="flex items-center gap-2 bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all duration-300 transform hover:scale-[1.01] cursor-pointer text-sm shadow-[0_4px_20px_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>

      </div>
    </div>
  );
}
