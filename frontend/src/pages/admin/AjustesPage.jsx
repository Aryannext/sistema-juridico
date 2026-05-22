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

  // Load User details
  const fetchUserProfile = async () => {
    try {
      setProfileLoading(true);
      const res = await api.get('/auth/perfil');
      setTwoFactor(res.data.dos_factores);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la configuración de seguridad.');
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

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent flex items-center gap-3">
          <Settings className="text-white" size={32} />
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
          <div className="rounded-2xl bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 p-6 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <User size={18} className="text-neutral-400" />
              Mi Perfil
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/40">
                <div className="h-11 w-11 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-lg text-white border border-neutral-700">
                  {user?.nombre?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm truncate max-w-[150px]">{user?.nombre}</h4>
                  <span className="text-xs bg-white/10 text-neutral-300 font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5">
                    {user?.rol}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2FA Card */}
          <div className="rounded-2xl bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 p-6 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Shield size={18} className="text-neutral-400" />
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
                <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900 border border-neutral-800/60">
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
                      twoFactor ? 'bg-white' : 'bg-neutral-800'
                    } ${toggling2FA ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                        twoFactor ? 'translate-x-5 bg-black' : 'translate-x-0 bg-neutral-500'
                      }`}
                    />
                  </button>
                </div>

                <div className={`p-4 rounded-xl border flex gap-3 text-xs ${
                  twoFactor 
                    ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' 
                    : 'bg-amber-500/5 border-amber-500/10 text-amber-400'
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

        </div>

        {/* Right Side: Tenant Administration Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 p-8 shadow-lg">
            <div className="flex items-center gap-2 mb-6 border-b border-neutral-900 pb-4 justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 size={22} className="text-neutral-400" />
                <h2 className="text-xl font-bold text-white">Perfil del Consultorio</h2>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                isAdmin ? 'bg-white/10 text-white' : 'bg-red-500/10 text-red-400'
              }`}>
                {isAdmin ? 'MÓDULO ADMINISTRATIVO' : 'SOLO LECTURA'}
              </span>
            </div>

            {!isAdmin ? (
              <div className="space-y-4 text-center py-8">
                <Building2 className="mx-auto text-neutral-700 mb-3" size={48} />
                <h3 className="text-md font-semibold text-neutral-400">Información del Consultorio</h3>
                <p className="text-neutral-500 text-xs max-w-sm mx-auto">
                  La personalización de la marca de la firma (nombre, NIT, dirección, teléfono y logo) está restringida únicamente a usuarios con rol <strong>ADMINISTRADOR</strong>.
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
                <div className="bg-neutral-900/50 p-6 rounded-xl border border-neutral-800/60 space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <Sparkles size={12} /> Identidad Visual
                  </span>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* Logo Preview */}
                    <div className="relative h-28 w-28 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo Consultorio" className="h-full w-full object-contain p-2" />
                      ) : (
                        <Building2 size={36} className="text-neutral-700" />
                      )}
                    </div>

                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-bold text-white">Logotipo de la Firma</h4>
                      <p className="text-xs text-neutral-400">
                        Suba el logotipo de su consultorio jurídico. Este se utilizará para personalizar reportes y documentos. Formatos soportados: JPG y PNG. Tamaño máximo: 2MB.
                      </p>
                      
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer">
                          <Upload size={14} />
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
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
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
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
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
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Phone size={13} /> Teléfono del Consultorio
                    </label>
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Ej. +57 601 2345678"
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <MapPin size={13} /> Dirección
                    </label>
                    <input
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Ej. Calle 100 # 15-20, Piso 5"
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
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
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-neutral-900">
                  <button
                    type="submit"
                    disabled={updatingTenant}
                    className="flex items-center gap-2 bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all duration-300 transform hover:scale-[1.01] cursor-pointer text-sm shadow-[0_4px_20px_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
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
