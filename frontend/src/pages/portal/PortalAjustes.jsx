import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Settings, Shield, Bell, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function PortalAjustes() {
  const { user, login } = useAuth();
  const [preferenciaCanal, setPreferenciaCanal] = useState('AMBOS');
  const [enable2FA, setEnable2FA] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreferencias = async () => {
      try {
        const response = await api.get('/auth/perfil');
        setPreferenciaCanal(response.data.preferencia_canal || 'AMBOS');
        setEnable2FA(response.data.dos_factores || false);
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar ajustes');
      } finally {
        setLoading(false);
      }
    };
    fetchPreferencias();
  }, []);

  const handleSaveAlerts = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/preferencias', {
        preferencia_canal: preferenciaCanal
      });
      toast.success('Preferencias de notificación actualizadas');
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar preferencias de notificaciones');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle2FA = async (checked) => {
    try {
      toast.loading(checked ? 'Habilitando 2FA...' : 'Deshabilitando 2FA...', { id: '2fa' });
      await api.post('/auth/2fa/configurar', { enable: checked });
      setEnable2FA(checked);
      toast.success(`Autenticación en dos factores ${checked ? 'habilitada' : 'deshabilitada'} con éxito`, { id: '2fa' });
    } catch (error) {
      console.error(error);
      toast.error('Error al configurar la autenticación en dos factores', { id: '2fa' });
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

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent flex items-center gap-3">
          <Settings className="text-[#DFB971]" size={32} />
          <span>Ajustes y Seguridad del Portal</span>
        </h1>
        <p className="mt-2 text-sm text-neutral-400 font-medium">
          Personaliza cómo interactúas con el consultorio, gestiona tus notificaciones y aumenta la seguridad de tu cuenta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Alerts Settings */}
        <div className="p-6 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4">
            <Bell size={18} className="text-[#DFB971]" />
            Preferencias de Notificaciones
          </h3>
          <p className="text-xs text-neutral-400 font-medium max-w-xl">
            Elige el canal por el cual deseas recibir los recordatorios y las notificaciones oficiales de tus expedientes (audiencias y actuaciones).
          </p>

          <form onSubmit={handleSaveAlerts} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Canal de Notificaciones</label>
              <select
                value={preferenciaCanal}
                onChange={(e) => setPreferenciaCanal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-[#DFB971] transition-colors cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
              >
                <option value="PLATAFORMA" className="bg-neutral-950">Solo Plataforma (en el portal)</option>
                <option value="EMAIL" className="bg-neutral-950">Solo Correo Electrónico</option>
                <option value="AMBOS" className="bg-neutral-950">Ambos Canales (Correo y Plataforma)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-bold text-xs rounded-xl transition-transform transform hover:scale-[1.02] shadow-[0_4px_15px_rgba(223,185,113,0.3)] disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar Preferencias'}
            </button>
          </form>
        </div>

        {/* Security Settings (2FA) */}
        <div className="p-6 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4">
                <Shield size={18} className="text-[#DFB971]" />
                Autenticación en Dos Factores (2FA)
              </h3>
              <p className="text-xs text-neutral-400 font-medium max-w-xl pt-2">
                Al activar la verificación de dos factores, el sistema enviará un código temporal de 6 dígitos a tu correo cada vez que inicies sesión. Esto añade una capa extra de seguridad.
              </p>
            </div>
            
            {/* Toggle switch custom styled */}
            <label className="relative inline-flex items-center cursor-pointer select-none mt-2">
              <input 
                type="checkbox" 
                checked={enable2FA}
                onChange={(e) => handleToggle2FA(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-12 h-6 bg-white/5 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#DFB971] peer-checked:after:bg-black shadow-inner"></div>
            </label>
          </div>

          <div className="p-5 rounded-2xl bg-[#DFB971]/5 border border-[#DFB971]/20 flex gap-3 text-xs text-neutral-400 font-medium shadow-inner">
            <Lock size={16} className="text-[#DFB971] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#DFB971]">¿Por qué es importante?</span>
              <p className="mt-1 leading-relaxed">
                Proteger tu cuenta de accesos no autorizados asegura que nadie pueda descargar o visualizar tus documentos compartidos ni ver los detalles de tu expediente sin tu permiso explícito.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
