import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Toaster, toast } from 'sonner';
import { CheckCircle2, XCircle, Scale, MailCheck, Loader2 } from 'lucide-react';

export default function VerificacionPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying');
  // Reenvío del correo de verificación: es la salida para quien llega aquí con
  // un enlace caducado. Antes el mensaje decía "intenta registrarte de nuevo",
  // que era imposible: el correo ya figuraba como usado.
  const [email, setEmail] = useState('');
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const navigate = useNavigate();

  const reenviar = async (e) => {
    e.preventDefault();
    try {
      setReenviando(true);
      await api.post('/auth/reenviar-verificacion', { email });
      setReenviado(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo reenviar el correo');
    } finally {
      setReenviando(false);
    }
  };

  useEffect(() => {
    if (!token) {
      // set-state-in-effect: es la carga inicial de la pantalla —decidir qué
      // mostrar según venga o no un token en la dirección—, no una
      // sincronización con un sistema externo, que es lo que la regla persigue.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        await api.get(`/auth/verificar/${token}`);
        setStatus('success');
      } catch (error) {
        setStatus('error');
        toast.error(error.response?.data?.error || 'Token inválido');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4 relative overflow-hidden dark">
      {/* Background decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#DFB971]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 blur-[100px] rounded-full pointer-events-none" />
      
      <Toaster richColors theme="dark" />
      
      <div className="w-full max-w-[420px] z-10 animate-fade-in">
        <div className="text-center mb-8 animate-float">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-4 shadow-[0_0_20px_rgba(223,185,113,0.15)]">
            <Scale size={32} className="text-[#DFB971]" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-widest uppercase mb-1">
            <span className="bg-gradient-to-r from-[#DFB971] via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">SGPA</span>
          </h1>
        </div>

        <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] rounded-3xl p-8 animate-scale-in text-center">
          <div className="flex justify-center mb-6">
            {status === 'verifying' && (
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#DFB971]"></div>
            )}
            {status === 'success' && <CheckCircle2 className="h-16 w-16 text-green-400" />}
            {status === 'error' && <XCircle className="h-16 w-16 text-red-500" />}
          </div>
          
          <h2 className="text-2xl font-semibold text-white mb-3 tracking-wide">
            {status === 'verifying' && 'Verificando tu cuenta…'}
            {status === 'success' && '¡Cuenta verificada!'}
            {status === 'error' && 'No pudimos verificar tu cuenta'}
          </h2>
          
          <p className="text-sm text-neutral-400 mb-8">
            {status === 'verifying' && 'Espera un momento mientras confirmamos tus datos.'}
            {status === 'success' && 'Tu correo fue confirmado. Ya puedes ingresar al sistema.'}
            {status === 'error' && 'El enlace no es válido o ya caducó. Pide uno nuevo indicando tu correo.'}
          </p>
          
          {/* Con el enlace caducado, lo útil es poder pedir otro aquí mismo. */}
          {status === 'error' && !reenviado && (
            <form onSubmit={reenviar} className="space-y-3 mb-6 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Tu correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="El correo con el que te registraste"
                className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
              />
              <button
                type="submit"
                disabled={reenviando}
                className="w-full bg-white/5 border border-white/10 hover:border-[#DFB971] disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-all flex justify-center items-center gap-2 cursor-pointer"
              >
                {reenviando && <Loader2 size={16} className="animate-spin" />}
                {reenviando ? 'Enviando…' : 'Enviarme otro enlace'}
              </button>
            </form>
          )}

          {reenviado && (
            <div className="mb-6 p-4 rounded-xl bg-[#DFB971]/5 border border-[#DFB971]/20 flex gap-3 text-left">
              <MailCheck size={18} className="text-[#DFB971] shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-300">
                Si ese correo corresponde a una cuenta pendiente de activar, recibirás un enlace
                nuevo en unos minutos. <strong className="text-white">Revisa también la carpeta de spam.</strong>
              </p>
            </div>
          )}

          {status !== 'verifying' && (
            <button
              className="w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold shadow-[0_0_15px_rgba(223,185,113,0.3)] hover:shadow-[0_0_25px_rgba(223,185,113,0.5)] transition-all duration-300 rounded-xl py-3.5 uppercase tracking-wider text-sm flex justify-center items-center cursor-pointer"
              onClick={() => navigate('/login')}
            >
              Volver al inicio de sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
