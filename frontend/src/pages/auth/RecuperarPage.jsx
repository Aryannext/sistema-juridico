import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { Toaster, toast } from 'sonner';
import { Scale, Mail, MailCheck, Loader2 } from 'lucide-react';

/**
 * Solicitud de recuperación de contraseña (HU-01).
 *
 * Tras enviar, la pantalla NO dice si el correo estaba registrado. El servidor
 * responde lo mismo en ambos casos a propósito —si no, cualquiera podría
 * averiguar qué direcciones tienen cuenta probándolas—, y la interfaz mantiene
 * esa discreción en lugar de deshacerla con un mensaje distinto.
 */
export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const solicitar = async (e) => {
    e.preventDefault();
    try {
      setEnviando(true);
      await api.post('/auth/recuperar', { email });
      setEnviado(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo procesar la solicitud');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4 relative overflow-hidden dark">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#DFB971]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 blur-[100px] rounded-full pointer-events-none" />

      <Toaster richColors theme="dark" />

      <div className="w-full max-w-[420px] z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-4 shadow-[0_0_20px_rgba(223,185,113,0.15)]">
            <Scale size={32} className="text-[#DFB971]" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-widest uppercase mb-1">
            <span className="bg-gradient-to-r from-[#DFB971] via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">SGPA</span>
          </h1>
        </div>

        <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] rounded-3xl p-8 animate-scale-in">
          {enviado ? (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <MailCheck className="h-16 w-16 text-[#DFB971]" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-3 tracking-wide">Revisa tu correo</h2>
              <p className="text-sm text-neutral-400 mb-2">
                Si <span className="text-white">{email}</span> corresponde a una cuenta registrada,
                recibirás un enlace para elegir una contraseña nueva.
              </p>
              <p className="text-xs text-neutral-500 mb-8">
                El enlace caduca en una hora. <strong className="text-neutral-400">Mira también la carpeta de spam.</strong>
              </p>
              <Link
                to="/login"
                className="block w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold rounded-xl py-3.5 uppercase tracking-wider text-sm transition-all duration-300"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-white mb-2 tracking-wide">Recuperar contraseña</h2>
              <p className="text-sm text-neutral-400 mb-8">
                Escribe el correo con el que entras y te enviaremos un enlace para elegir una nueva.
              </p>

              <form onSubmit={solicitar} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="username"
                      placeholder="Ingresa tu correo"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl pl-9 pr-4 py-3 text-sm text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] disabled:opacity-50 text-black font-semibold rounded-xl py-3.5 uppercase tracking-wider text-sm transition-all duration-300 flex justify-center items-center gap-2 cursor-pointer"
                >
                  {enviando && <Loader2 size={16} className="animate-spin" />}
                  {enviando ? 'Enviando…' : 'Enviar enlace'}
                </button>
              </form>

              <p className="text-center text-xs text-neutral-500 mt-6">
                <Link to="/login" className="hover:text-[#DFB971] transition-colors">
                  Volver al inicio de sesión
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
