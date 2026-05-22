import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Settings, Shield, Upload, Building2, Phone, MapPin, Mail, User, ShieldCheck, ShieldAlert, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function AjustesPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMINISTRADOR';

  // State for user profile & 2FA
  const [profileLoading, setProfileLoading] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);

  // State for Tenant Profile
  const [tenantLoading, setTenantLoading] = useState(isAdmin);
  const [tenantName, setTenantName] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nit, setNit] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [updatingTenant, setUpdatingTenant] = useState(false);

  // Notification Preferences
  const [canal, setCanal] = useState('AMBOS');
  const [prioridadAudiencia, setPrioridadAudiencia] = useState('MEDIA');
  const [prioridadTermino, setPrioridadTermino] = useState('ALTA');
  const [prioridadTarea, setPrioridadTarea] = useState('BAJA');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [horasOcultar, setHorasOcultar] = useState(48);

  // Load User details
  const fetchUserProfile = async () => {
    try {
      setProfileLoading(true);
      const res = await api.get('/auth/perfil');
      setTwoFactor(res.data.dos_factores);
      setCanal(res.data.preferencia_canal || 'AMBOS');
      setPrioridadAudiencia(res.data.pref_prioridad_audiencia || 'MEDIA');
      setPrioridadTermino(res.data.pref_prioridad_termino || 'ALTA');
      setPrioridadTarea(res.data.pref_prioridad_tarea || 'BAJA');
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la configuración de seguridad y preferencias.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Load Tenant details
  const fetchTenantProfile = async () => {
    if (!isAdmin) return;
    try {
      setTenantLoading(true);
      const res = await api.get('/tenant/perfil');
      const data = res.data;
      setTenantName(data.nombre || '');
      setRazonSocial(data.razon_social || '');
      setNit(data.nit || '');
      setTelefono(data.telefono || '');
      setDireccion(data.direccion || '');
      setCiudad(data.ciudad || '');
      setLogoUrl(data.logo_url || '');
      setLogoPreview(data.logo_url || '');
      setHorasOcultar(data.horas_ocultar_notificaciones ?? 48);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la información del consultorio.');
    } finally {
      setTenantLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchTenantProfile();
  }, []);

  // Handler for 2FA Toggle
  const handle2FAToggle = async () => {
    try {
      setToggling2FA(true);
      const newStatus = !twoFactor;
      const res = await api.post('/auth/2fa/configurar', { enable: newStatus });
      setTwoFactor(newStatus);
      toast.success(res.data.message);
    } catch (error) {
      console.error(error);
      toast.error('Error al configurar la autenticación de dos factores.');
    } finally {
      setToggling2FA(false);
    }
  };

  // Logo file selection handler
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Size limit check: 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El archivo excede el límite de 2MB. Por favor suba una imagen más pequeña.');
      return;
    }

    // Format check: jpeg/png
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      toast.error('Formato no soportado. Solo se permiten imágenes JPG y PNG.');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Handler for Tenant details submission
  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      setUpdatingTenant(true);
      const formData = new FormData();
      formData.append('nombre', tenantName);
      formData.append('razon_social', razonSocial);
      formData.append('nit', nit);
      formData.append('telefono', telefono);
      formData.append('direccion', direccion);
      formData.append('ciudad', ciudad);
      formData.append('horas_ocultar_notificaciones', horasOcultar);
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const res = await api.put('/tenant/perfil', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(res.data.message || 'Perfil de consultorio actualizado con éxito.');
      setLogoUrl(res.data.tenant.logo_url || '');
      setLogoFile(null);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al actualizar el perfil del consultorio.');
    } finally {
      setUpdatingTenant(false);
    }
  };

  // Handler for user Preferences submission
  const handlePreferencesSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingPreferences(true);
      const res = await api.put('/auth/preferencias', {
        preferencia_canal: canal,
        pref_prioridad_audiencia: prioridadAudiencia,
        pref_prioridad_termino: prioridadTermino,
        pref_prioridad_tarea: prioridadTarea
      });
      toast.success(res.data.message || 'Preferencias de alerta actualizadas con éxito.');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al actualizar preferencias de alerta.');
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent flex items-center gap-3">
          <Settings className="text-[#DFB971]" size={32} />
          <span>Configuración del Sistema</span>
        </h1>
        <p className="text-neutral-400 mt-1">
          Administra las opciones de seguridad de tu cuenta y la identidad visual de tu consultorio jurídico.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: General Profile Security info */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* User Info Card */}
          <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <User size={18} className="text-[#DFB971]" />
              Mi Perfil
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 bg-white/5 p-3 rounded-2xl border border-white/10">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#C29B4F] to-[#E5C37A] flex items-center justify-center font-bold text-lg text-black shadow-[0_4px_15px_rgba(223,185,113,0.4)]">
                  {user?.nombre?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm truncate max-w-[150px]">{user?.nombre}</h4>
                  <span className="text-xs bg-[#DFB971]/10 text-[#DFB971] border border-[#DFB971]/20 font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5">
                    {user?.rol}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2FA Card */}
          <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Shield size={18} className="text-[#DFB971]" />
              Seguridad de Cuenta
            </h2>
            <p className="text-xs text-neutral-400 mb-6">
              Aumenta la protección de tus datos habilitando la autenticación de doble factor vía correo electrónico.
            </p>

            {profileLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={24} className="animate-spin text-neutral-500" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-white">Verificación en 2 pasos</span>
                    <p className="text-[11px] text-neutral-400">
                      {twoFactor ? 'Protección activa por correo electrónico' : 'Inactivo. Recomendamos activarlo.'}
                    </p>
                  </div>
                  
                  {/* Switch */}
                  <button
                    type="button"
                    onClick={handle2FAToggle}
                    disabled={toggling2FA}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      twoFactor ? 'bg-[#DFB971]' : 'bg-neutral-800'
                    } ${toggling2FA ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                        twoFactor ? 'translate-x-5 bg-black' : 'translate-x-0 bg-neutral-500'
                      }`}
                    />
                  </button>
                </div>

                <div className={`p-4 rounded-2xl border flex gap-3 text-xs ${
                  twoFactor 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {twoFactor ? (
                    <>
                      <ShieldCheck size={18} className="shrink-0" />
                      <span>
                        Tu cuenta está protegida. Al iniciar sesión, te enviaremos un código de seguridad de 6 dígitos a tu correo.
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={18} className="shrink-0" />
                      <span>
                        Tu cuenta tiene menor protección. Habilita 2FA para proteger la información confidencial de tus expedientes jurídicos.
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preferencias de Alertas Card */}
          <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert size={18} className="text-[#DFB971]" />
              Preferencias de Alertas
            </h2>
            <p className="text-xs text-neutral-400 mb-6">
              Configura por qué canales deseas recibir notificaciones y los niveles de prioridad preferidos por evento.
            </p>

            {profileLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={24} className="animate-spin text-neutral-500" />
              </div>
            ) : (
              <form onSubmit={handlePreferencesSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Canal de Notificaciones
                  </label>
                  <select
                    value={canal}
                    onChange={(e) => setCanal(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white transition-colors cursor-pointer"
                  >
                    <option value="PLATAFORMA" className="bg-neutral-950">Plataforma únicamente</option>
                    <option value="EMAIL" className="bg-neutral-950">Correo Electrónico únicamente</option>
                    <option value="AMBOS" className="bg-neutral-950">Ambos canales (Plataforma y Correo)</option>
                  </select>
                </div>

                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-neutral-300">Prioridad por Tipo de Evento</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-400">Audiencias</label>
                      <select
                        value={prioridadAudiencia}
                        onChange={(e) => setPrioridadAudiencia(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white transition-colors cursor-pointer"
                      >
                        <option value="ALTA" className="bg-neutral-950">Alta</option>
                        <option value="MEDIA" className="bg-neutral-950">Media</option>
                        <option value="BAJA" className="bg-neutral-950">Baja</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-400">Términos</label>
                      <select
                        value={prioridadTermino}
                        onChange={(e) => setPrioridadTermino(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white transition-colors cursor-pointer"
                      >
                        <option value="ALTA" className="bg-neutral-950">Alta</option>
                        <option value="MEDIA" className="bg-neutral-950">Media</option>
                        <option value="BAJA" className="bg-neutral-950">Baja</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-400">Tareas</label>
                    <select
                      value={prioridadTarea}
                      onChange={(e) => setPrioridadTarea(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white transition-colors cursor-pointer"
                    >
                      <option value="ALTA" className="bg-neutral-950">Alta</option>
                      <option value="MEDIA" className="bg-neutral-950">Media</option>
                      <option value="BAJA" className="bg-neutral-950">Baja</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPreferences}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black shadow-[0_4px_20px_rgba(223,185,113,0.3)] font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs transform hover:scale-[1.02] disabled:opacity-50"
                  >
                    {savingPreferences ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Preferencias</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* Right Side: Tenant Administration Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4 justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 size={22} className="text-[#DFB971]" />
                <h2 className="text-xl font-bold text-white">Perfil del Consultorio</h2>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                isAdmin ? 'bg-[#DFB971]/10 text-[#DFB971] border border-[#DFB971]/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {isAdmin ? 'MÓDULO ADMINISTRATIVO' : 'SOLO LECTURA'}
              </span>
            </div>

            {!isAdmin ? (
              <div className="space-y-4 text-center py-8">
                <Building2 className="mx-auto text-neutral-700 mb-3" size={48} />
                <h3 className="text-md font-semibold text-[#DFB971]">Información del Consultorio</h3>
                <p className="text-neutral-500 text-xs max-w-sm mx-auto">
                  La personalización de la marca de la firma (nombre, NIT, dirección, teléfono y logo) está restringida únicamente a usuarios con rol <strong className="text-white">ADMINISTRADOR</strong>.
                </p>
              </div>
            ) : tenantLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={32} className="animate-spin text-neutral-400" />
                <span className="text-xs text-neutral-500">Cargando detalles de firma...</span>
              </div>
            ) : (
              <form onSubmit={handleTenantSubmit} className="space-y-6">
                
                {/* Visual Identity Section */}
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4 shadow-inner">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#DFB971] flex items-center gap-1.5">
                    <Sparkles size={12} /> Identidad Visual
                  </span>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* Logo Preview */}
                    <div className="relative h-28 w-28 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo Consultorio" className="h-full w-full object-contain p-2" />
                      ) : (
                        <Building2 size={36} className="text-neutral-600" />
                      )}
                    </div>

                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-bold text-white">Logotipo de la Firma</h4>
                      <p className="text-xs text-neutral-400">
                        Suba el logotipo de su consultorio jurídico. Este se utilizará para personalizar reportes y documentos. Formatos soportados: JPG y PNG. Tamaño máximo: 2MB.
                      </p>
                      
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
                          <Upload size={14} className="text-[#DFB971]" />
                          <span>Seleccionar Archivo</span>
                          <input type="file" accept="image/jpeg,image/png" onChange={handleLogoChange} className="hidden" />
                        </label>
                        {logoFile && (
                          <span className="text-[11px] text-neutral-400 truncate max-w-[150px]">
                            {logoFile.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Nombre Comercial
                    </label>
                    <input
                      type="text"
                      required
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="Ej. Consultorio Jurídico Central"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Razón Social
                    </label>
                    <input
                      type="text"
                      value={razonSocial}
                      onChange={(e) => setRazonSocial(e.target.value)}
                      placeholder="Ej. Asesorías Jurídicas SAS"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      NIT (Número de Identificación Tributaria)
                    </label>
                    <input
                      type="text"
                      value={nit}
                      onChange={(e) => setNit(e.target.value)}
                      placeholder="Ej. 900123456-7"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Phone size={13} className="text-[#DFB971]" /> Teléfono del Consultorio
                    </label>
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Ej. +57 601 2345678"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <MapPin size={13} className="text-[#DFB971]" /> Dirección
                    </label>
                    <input
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Ej. Calle 100 # 15-20, Piso 5"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Ciudad
                    </label>
                    <input
                      type="text"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      placeholder="Ej. Bogotá D.C."
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Ocultar Alertas Leídas (Horas)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={horasOcultar}
                      onChange={(e) => setHorasOcultar(parseInt(e.target.value, 10) || 0)}
                      placeholder="Ej. 48"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-5 border-t border-white/10">
                  <button
                    type="submit"
                    disabled={updatingTenant}
                    className="flex items-center gap-2 bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold px-6 py-2.5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] cursor-pointer text-sm shadow-[0_4px_20px_rgba(223,185,113,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingTenant ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Cambios</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
